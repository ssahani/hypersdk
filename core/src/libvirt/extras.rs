//! Extra features: ISO/disk browser, USB passthrough, cloud-init, VM import, live resize, tags, PCI listing.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use virt::connect::Connect;

use super::domain::lookup_domain;
use crate::LibvirtError;

// ── ISO / Disk Image Browser ───────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageFile {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
    pub format: String, // iso, qcow2, raw, vmdk, img
}

/// Scan common directories for ISO files.
pub fn list_iso_files() -> Vec<ImageFile> {
    let dirs = [
        "/var/lib/libvirt/images",
        "/var/lib/virtspawn/images",
        "/home",
        "/root",
        "/tmp",
    ];
    let mut files = Vec::new();
    for dir in &dirs {
        scan_dir_for_extension(Path::new(dir), &["iso"], &mut files, 2);
    }
    files.sort_by(|a, b| a.name.cmp(&b.name));
    files
}

/// Scan common directories for disk images (qcow2, raw, vmdk, img).
pub fn list_disk_images() -> Vec<ImageFile> {
    let dirs = [
        "/var/lib/libvirt/images",
        "/var/lib/virtspawn/images",
    ];
    let mut files = Vec::new();
    for dir in &dirs {
        scan_dir_for_extension(Path::new(dir), &["qcow2", "raw", "img", "vmdk"], &mut files, 1);
    }
    files.sort_by(|a, b| a.name.cmp(&b.name));
    files
}

fn scan_dir_for_extension(dir: &Path, extensions: &[&str], files: &mut Vec<ImageFile>, max_depth: u32) {
    scan_dir_recursive(dir, extensions, files, 0, max_depth);
}

fn scan_dir_recursive(dir: &Path, extensions: &[&str], files: &mut Vec<ImageFile>, depth: u32, max_depth: u32) {
    if depth > max_depth { return; }
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() && depth < max_depth {
            scan_dir_recursive(&path, extensions, files, depth + 1, max_depth);
        } else if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                let ext_lower = ext.to_lowercase();
                if extensions.iter().any(|e| *e == ext_lower) {
                    let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                    files.push(ImageFile {
                        path: path.to_string_lossy().to_string(),
                        name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                        size_bytes: size,
                        format: ext_lower,
                    });
                }
            }
        }
    }
}

// ── USB Passthrough ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsbDevice {
    pub bus: String,
    pub device: String,
    pub vendor_id: String,
    pub product_id: String,
    pub description: String,
}

/// List host USB devices via lsusb.
pub fn list_usb_devices() -> Result<Vec<UsbDevice>, LibvirtError> {
    let output = Command::new("lsusb")
        .output()
        .map_err(LibvirtError::map_op("Failed to run lsusb"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut devices = Vec::new();

    for line in stdout.lines() {
        // Format: Bus 001 Device 002: ID 1234:5678 Description
        let parts: Vec<&str> = line.splitn(7, ' ').collect();
        if parts.len() >= 7 {
            let bus = parts[1].to_string();
            let device = parts[3].trim_end_matches(':').to_string();
            let id = parts[5];
            let id_parts: Vec<&str> = id.split(':').collect();
            if id_parts.len() == 2 {
                devices.push(UsbDevice {
                    bus,
                    device,
                    vendor_id: id_parts[0].to_string(),
                    product_id: id_parts[1].to_string(),
                    description: parts[6..].join(" "),
                });
            }
        }
    }

    Ok(devices)
}

/// Attach a USB device to a VM by vendor:product ID.
pub fn attach_usb(conn: &Connect, vm_name: &str, vendor_id: &str, product_id: &str) -> Result<(), LibvirtError> {
    // Validate hex IDs
    if vendor_id.len() != 4 || product_id.len() != 4
        || !vendor_id.chars().all(|c| c.is_ascii_hexdigit())
        || !product_id.chars().all(|c| c.is_ascii_hexdigit())
    {
        return Err(LibvirtError::Invalid("Invalid USB vendor/product ID format".to_string()));
    }

    let domain = lookup_domain(conn, vm_name)?;
    let xml = format!(
        r#"<hostdev mode='subsystem' type='usb' managed='yes'>
  <source>
    <vendor id='0x{vendor_id}'/>
    <product id='0x{product_id}'/>
  </source>
</hostdev>"#,
    );

    let flags = super::device::get_domain_flags_pub(&domain);
    domain
        .attach_device_flags(&xml, flags)
        .map_err(LibvirtError::map_op("Failed to attach USB device"))?;
    Ok(())
}

/// Detach a USB device from a VM.
pub fn detach_usb(conn: &Connect, vm_name: &str, vendor_id: &str, product_id: &str) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, vm_name)?;
    let xml = format!(
        r#"<hostdev mode='subsystem' type='usb' managed='yes'>
  <source>
    <vendor id='0x{vendor_id}'/>
    <product id='0x{product_id}'/>
  </source>
</hostdev>"#,
    );

    let flags = super::device::get_domain_flags_pub(&domain);
    domain
        .detach_device_flags(&xml, flags)
        .map_err(LibvirtError::map_op("Failed to detach USB device"))?;
    Ok(())
}

// ── Cloud-init ─────────────────────────────────────────────────────

/// Generate a cloud-init ISO with user-data and meta-data.
pub fn generate_cloud_init_iso(
    output_path: &str,
    hostname: &str,
    username: &str,
    password: &str,
    ssh_key: &str,
) -> Result<String, LibvirtError> {
    let tmp_dir = PathBuf::from("/tmp/virtspawn-cloud-init");
    let _ = std::fs::create_dir_all(&tmp_dir);

    // meta-data
    let meta_data = format!("instance-id: {hostname}\nlocal-hostname: {hostname}\n");
    std::fs::write(tmp_dir.join("meta-data"), &meta_data)
        .map_err(|e| LibvirtError::Operation(format!("Failed to write meta-data: {e}")))?;

    // user-data
    let mut user_data = String::from("#cloud-config\n");
    if !username.is_empty() {
        user_data.push_str(&format!(
            "users:\n  - name: {username}\n    sudo: ALL=(ALL) NOPASSWD:ALL\n    shell: /bin/bash\n"
        ));
        if !password.is_empty() {
            user_data.push_str(&format!("    lock_passwd: false\n    plain_text_passwd: {password}\n"));
        }
        if !ssh_key.is_empty() {
            user_data.push_str(&format!("    ssh_authorized_keys:\n      - {ssh_key}\n"));
        }
    }
    if !password.is_empty() {
        user_data.push_str("ssh_pwauth: true\n");
    }

    std::fs::write(tmp_dir.join("user-data"), &user_data)
        .map_err(|e| LibvirtError::Operation(format!("Failed to write user-data: {e}")))?;

    // Generate ISO (try genisoimage, then mkisofs, then xorriso)
    let iso_path = if output_path.is_empty() {
        format!("/var/lib/libvirt/images/{hostname}-cloud-init.iso")
    } else {
        output_path.to_string()
    };

    let cmds = [
        ("genisoimage", vec!["-output", &iso_path, "-V", "cidata", "-r", "-J",
            tmp_dir.to_str().unwrap_or("/tmp/virtspawn-cloud-init")]),
        ("mkisofs", vec!["-output", &iso_path, "-V", "cidata", "-r", "-J",
            tmp_dir.to_str().unwrap_or("/tmp/virtspawn-cloud-init")]),
    ];

    let mut success = false;
    for (cmd, args) in &cmds {
        if let Ok(output) = Command::new(cmd).args(args).output() {
            if output.status.success() {
                success = true;
                break;
            }
        }
    }

    // Cleanup
    let _ = std::fs::remove_dir_all(&tmp_dir);

    if !success {
        return Err(LibvirtError::Operation(
            "Failed to create cloud-init ISO. Install genisoimage or mkisofs.".to_string()
        ));
    }

    Ok(iso_path)
}

// ── VM Import ──────────────────────────────────────────────────────

/// Import a disk image by converting it to qcow2 if needed.
pub fn import_disk_image(source: &str, dest_name: &str) -> Result<String, LibvirtError> {
    let source_path = Path::new(source);
    if !source_path.is_file() {
        return Err(LibvirtError::Operation(format!("Source file not found: {source}")));
    }

    let ext = source_path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    let dest_path = format!("/var/lib/libvirt/images/{dest_name}.qcow2");

    if Path::new(&dest_path).exists() {
        return Err(LibvirtError::Operation(format!("Destination already exists: {dest_path}")));
    }

    match ext.as_str() {
        "qcow2" => {
            // Already qcow2, just copy
            std::fs::copy(source, &dest_path)
                .map_err(|e| LibvirtError::Operation(format!("Copy failed: {e}")))?;
        }
        "vmdk" | "vdi" | "raw" | "img" | "vpc" | "vhd" => {
            // Convert with qemu-img
            let output = Command::new("qemu-img")
                .args(["convert", "-f", &ext, "-O", "qcow2", source, &dest_path])
                .output()
                .map_err(LibvirtError::map_op("qemu-img convert"))?;
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(LibvirtError::Operation(format!("qemu-img convert failed: {stderr}")));
            }
        }
        _ => {
            return Err(LibvirtError::Invalid(format!("Unsupported format: {ext}")));
        }
    }

    Ok(dest_path)
}

// ── Live Resize ────────────────────────────────────────────────────

/// Hot-add vCPUs to a running VM.
pub fn live_set_vcpus(conn: &Connect, name: &str, vcpus: u32) -> Result<(), LibvirtError> {
    crate::validate::validate_vcpus(vcpus)?;
    let domain = lookup_domain(conn, name)?;

    // Set both live and config
    domain
        .set_vcpus_flags(vcpus, virt::sys::VIR_DOMAIN_AFFECT_LIVE | virt::sys::VIR_DOMAIN_AFFECT_CONFIG)
        .map_err(|e| LibvirtError::Operation(format!("Failed to live-set vCPUs for '{name}': {e}")))?;
    Ok(())
}

/// Hot-set memory on a running VM (requires balloon driver).
pub fn live_set_memory(conn: &Connect, name: &str, memory_mb: u64) -> Result<(), LibvirtError> {
    crate::validate::validate_memory_mb(memory_mb)?;
    let domain = lookup_domain(conn, name)?;

    domain
        .set_memory_flags(memory_mb * 1024, virt::sys::VIR_DOMAIN_AFFECT_LIVE)
        .map_err(|e| LibvirtError::Operation(format!("Failed to live-set memory for '{name}': {e}")))?;
    Ok(())
}

// ── VM Tags ───────────────────────────────────────────────────────

const TAGS_FILE: &str = "/var/lib/virtspawn/tags.json";

/// Tag map: vm_name -> list of tags.
pub type TagMap = HashMap<String, Vec<String>>;

/// Load tags from the JSON file. Returns empty map if file doesn't exist.
pub fn load_tags() -> TagMap {
    match std::fs::read_to_string(TAGS_FILE) {
        Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
        Err(_) => HashMap::new(),
    }
}

/// Save tags to the JSON file.
pub fn save_tags(tags: &TagMap) -> Result<(), LibvirtError> {
    let dir = Path::new(TAGS_FILE).parent().unwrap_or(Path::new("/var/lib/virtspawn"));
    let _ = std::fs::create_dir_all(dir);
    let data = serde_json::to_string_pretty(tags)
        .map_err(|e| LibvirtError::Operation(format!("Failed to serialize tags: {e}")))?;
    std::fs::write(TAGS_FILE, data)
        .map_err(|e| LibvirtError::Operation(format!("Failed to write tags file: {e}")))?;
    Ok(())
}

/// Set tags for a specific VM (replaces existing tags).
pub fn set_vm_tags(vm_name: &str, tags: Vec<String>) -> Result<(), LibvirtError> {
    let mut map = load_tags();
    if tags.is_empty() {
        map.remove(vm_name);
    } else {
        map.insert(vm_name.to_string(), tags);
    }
    save_tags(&map)
}

/// Get tags for a specific VM.
pub fn get_vm_tags(vm_name: &str) -> Vec<String> {
    let map = load_tags();
    map.get(vm_name).cloned().unwrap_or_default()
}

// ── Host System Stats ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostStats {
    pub cpu_percent: f64,
    pub memory_total_mb: u64,
    pub memory_used_mb: u64,
    pub memory_percent: f64,
    pub swap_total_mb: u64,
    pub swap_used_mb: u64,
    pub disk_total_gb: f64,
    pub disk_used_gb: f64,
    pub disk_percent: f64,
    pub load_1: f64,
    pub load_5: f64,
    pub load_15: f64,
    pub uptime_secs: u64,
    pub processes: u32,
}

pub fn get_host_stats() -> HostStats {
    let cpu_percent = parse_cpu_percent();
    let (mem_total, mem_used, swap_total, swap_used) = parse_meminfo();
    let (disk_total, disk_used) = parse_disk_usage("/");
    let (l1, l5, l15) = parse_loadavg();
    let uptime = parse_uptime();
    let procs = std::fs::read_dir("/proc")
        .map(|d| d.filter(|e| e.as_ref().ok().and_then(|e| e.file_name().to_str().map(|s| s.chars().all(|c| c.is_ascii_digit()))).unwrap_or(false)).count() as u32)
        .unwrap_or(0);

    let mem_pct = if mem_total > 0 { (mem_used as f64 / mem_total as f64 * 100.0).min(100.0) } else { 0.0 };
    let disk_pct = if disk_total > 0.0 { (disk_used / disk_total * 100.0).min(100.0) } else { 0.0 };

    HostStats {
        cpu_percent, memory_total_mb: mem_total, memory_used_mb: mem_used, memory_percent: mem_pct,
        swap_total_mb: swap_total, swap_used_mb: swap_used,
        disk_total_gb: disk_total, disk_used_gb: disk_used, disk_percent: disk_pct,
        load_1: l1, load_5: l5, load_15: l15, uptime_secs: uptime, processes: procs,
    }
}

fn parse_cpu_percent() -> f64 {
    // Read /proc/stat for cpu line
    let stat = std::fs::read_to_string("/proc/stat").unwrap_or_default();
    let line = stat.lines().next().unwrap_or("");
    let vals: Vec<u64> = line.split_whitespace().skip(1).filter_map(|s| s.parse().ok()).collect();
    if vals.len() >= 4 {
        let total: u64 = vals.iter().sum();
        let idle = vals[3];
        if total > 0 { ((total - idle) as f64 / total as f64 * 100.0).min(100.0) } else { 0.0 }
    } else { 0.0 }
}

fn parse_meminfo() -> (u64, u64, u64, u64) {
    let content = std::fs::read_to_string("/proc/meminfo").unwrap_or_default();
    let mut total: u64 = 0;
    let mut available: u64 = 0;
    let mut swap_total: u64 = 0;
    let mut swap_free: u64 = 0;
    for line in content.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            let val: u64 = parts[1].parse().unwrap_or(0);
            match parts[0] {
                "MemTotal:" => total = val / 1024,
                "MemAvailable:" => available = val / 1024,
                "SwapTotal:" => swap_total = val / 1024,
                "SwapFree:" => swap_free = val / 1024,
                _ => {}
            }
        }
    }
    (total, total.saturating_sub(available), swap_total, swap_total.saturating_sub(swap_free))
}

fn parse_disk_usage(path: &str) -> (f64, f64) {
    let output = Command::new("df").args(["-BG", path]).output().ok();
    if let Some(out) = output {
        let stdout = String::from_utf8_lossy(&out.stdout);
        if let Some(line) = stdout.lines().nth(1) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 4 {
                let total: f64 = parts[1].trim_end_matches('G').parse().unwrap_or(0.0);
                let used: f64 = parts[2].trim_end_matches('G').parse().unwrap_or(0.0);
                return (total, used);
            }
        }
    }
    (0.0, 0.0)
}

fn parse_loadavg() -> (f64, f64, f64) {
    let content = std::fs::read_to_string("/proc/loadavg").unwrap_or_default();
    let parts: Vec<f64> = content.split_whitespace().take(3).filter_map(|s| s.parse().ok()).collect();
    if parts.len() >= 3 { (parts[0], parts[1], parts[2]) } else { (0.0, 0.0, 0.0) }
}

fn parse_uptime() -> u64 {
    let content = std::fs::read_to_string("/proc/uptime").unwrap_or_default();
    content.split_whitespace().next().and_then(|s| s.parse::<f64>().ok()).map(|f| f as u64).unwrap_or(0)
}

// ── Save VM as Template ──────────────────────────────────────────

/// Save a VM's configuration as a reusable template.
pub fn save_vm_as_template(conn: &Connect, vm_name: &str, template_name: &str) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, vm_name)?;
    let info = domain.get_info().map_err(LibvirtError::map_op("Failed to get VM info"))?;

    let template = serde_json::json!({
        "name": template_name,
        "description": format!("Saved from VM '{}'", vm_name),
        "vcpus": info.nr_virt_cpu,
        "memory_mb": info.memory / 1024,
        "disk_gb": 20,
        "os_variant": "linux2022",
    });

    let templates_dir = "/var/lib/virtspawn/templates";
    let _ = std::fs::create_dir_all(templates_dir);
    let path = format!("{}/{}.json", templates_dir, template_name);
    std::fs::write(&path, serde_json::to_string_pretty(&template).unwrap_or_default())
        .map_err(|e| LibvirtError::Operation(format!("Failed to save template: {e}")))?;

    Ok(())
}

// ── DHCP Leases ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DhcpLease {
    pub network: String,
    pub mac: String,
    pub ip: String,
    pub hostname: String,
    pub expiry: String,
}

/// Get DHCP leases from all active libvirt networks via virsh.
pub fn list_dhcp_leases(conn: &Connect) -> Result<Vec<DhcpLease>, LibvirtError> {
    let networks = conn.list_all_networks(0)
        .map_err(LibvirtError::map_op("Failed to list networks"))?;

    let mut leases = Vec::new();
    for net in networks {
        let net_name = net.get_name().unwrap_or_default();
        if !net.is_active().unwrap_or(false) { continue; }

        // Use virsh net-dhcp-leases to get lease info
        if let Ok(output) = Command::new("virsh").args(["net-dhcp-leases", &net_name]).output() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines().skip(2) {
                // Format: Expiry  MAC  Protocol  IP  Hostname  ClientID
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 5 && parts[0] != "-" {
                    // Expiry is "YYYY-MM-DD HH:MM:SS" (2 columns) or "-"
                    let (expiry, rest) = if parts[0].contains('-') && parts.len() >= 6 {
                        (format!("{} {}", parts[0], parts[1]), &parts[2..])
                    } else {
                        (parts[0].to_string(), &parts[1..])
                    };
                    if rest.len() >= 4 {
                        leases.push(DhcpLease {
                            network: net_name.clone(),
                            mac: rest[0].to_string(),
                            ip: rest[2].to_string(),
                            hostname: if rest.len() > 3 && rest[3] != "-" { rest[3].to_string() } else { String::new() },
                            expiry,
                        });
                    }
                }
            }
        }
    }
    Ok(leases)
}

fn format_lease_expiry(epoch: i64) -> String {
    if epoch <= 0 { return "static".to_string(); }
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let remaining = epoch - now;
    if remaining <= 0 { return "expired".to_string(); }
    let hours = remaining / 3600;
    let mins = (remaining % 3600) / 60;
    format!("{hours}h {mins}m")
}

// ── PCI / IOMMU Passthrough Listing ───────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PciDevice {
    pub slot: String,
    pub class: String,
    pub vendor: String,
    pub device: String,
    pub iommu_group: String,
}

/// List host PCI devices by parsing `lspci -vmm` output.
pub fn list_pci_devices() -> Result<Vec<PciDevice>, LibvirtError> {
    let output = Command::new("lspci")
        .args(["-vmm"])
        .output()
        .map_err(LibvirtError::map_op("Failed to run lspci"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut devices = Vec::new();
    let mut slot = String::new();
    let mut class = String::new();
    let mut vendor = String::new();
    let mut device = String::new();
    let mut iommu = String::new();

    for line in stdout.lines() {
        if line.trim().is_empty() {
            if !slot.is_empty() {
                devices.push(PciDevice {
                    slot: slot.clone(),
                    class: class.clone(),
                    vendor: vendor.clone(),
                    device: device.clone(),
                    iommu_group: iommu.clone(),
                });
            }
            slot.clear();
            class.clear();
            vendor.clear();
            device.clear();
            iommu.clear();
            continue;
        }
        if let Some((key, val)) = line.split_once(':') {
            let key = key.trim();
            let val = val.trim().to_string();
            match key {
                "Slot" => slot = val,
                "Class" => class = val,
                "Vendor" => vendor = val,
                "Device" => device = val,
                "IOMMUGroup" => iommu = val,
                _ => {}
            }
        }
    }
    // Flush last entry
    if !slot.is_empty() {
        devices.push(PciDevice {
            slot,
            class,
            vendor,
            device,
            iommu_group: iommu,
        });
    }

    Ok(devices)
}
