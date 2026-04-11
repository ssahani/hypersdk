use std::path::Path;
use std::process::Command;

use virt::connect::Connect;
use virt::domain::Domain;
use virt::storage_pool::StoragePool;

use crate::state::CreateVmRequest;
use crate::LibvirtError;

pub fn create_vm(conn: &Connect, req: &CreateVmRequest) -> Result<(), LibvirtError> {
    // Validate inputs
    crate::validate::validate_name(&req.name)?;
    crate::validate::validate_vcpus(req.vcpus)?;
    crate::validate::validate_memory_mb(req.memory_mb)?;

    // Validate and normalize firmware
    let firmware = if req.firmware.is_empty() { "bios" } else { &req.firmware };
    if firmware != "bios" && firmware != "uefi" {
        return Err(LibvirtError::Invalid("Firmware must be 'bios' or 'uefi'".to_string()));
    }
    if firmware == "uefi" {
        let ovmf_path = find_ovmf_code();
        if ovmf_path.is_none() {
            return Err(LibvirtError::Operation(
                "UEFI firmware (OVMF) not found. Install edk2-ovmf (Fedora/RHEL) or ovmf (Debian/Ubuntu).".to_string()
            ));
        }
    }

    // Validate ISO path if provided
    let resolved_iso: Option<std::path::PathBuf> = if !req.iso.is_empty() {
        let iso_path = std::path::Path::new(&req.iso);
        if !iso_path.is_absolute() {
            return Err(LibvirtError::Invalid("ISO path must be absolute".to_string()));
        }
        let iso_path = iso_path.canonicalize()
            .map_err(|e| LibvirtError::Invalid(format!("Cannot resolve ISO path: {e}")))?;
        if !iso_path.is_file() {
            return Err(LibvirtError::Operation(format!("ISO file not found or is not a file: {}", iso_path.display())));
        }
        Some(iso_path)
    } else {
        None
    };

    let disk_path = if !req.existing_disk.is_empty() {
        // Use existing disk image
        let disk = std::path::Path::new(&req.existing_disk);
        if !disk.is_absolute() {
            return Err(LibvirtError::Invalid("Existing disk path must be absolute".to_string()));
        }
        if !disk.is_file() {
            return Err(LibvirtError::Operation(format!("Disk image not found: {}", req.existing_disk)));
        }
        req.existing_disk.clone()
    } else {
        // Create new disk
        crate::validate::validate_disk_gb(req.disk_gb)?;
        let path = find_disk_path(conn, &req.name)?;
        create_qcow2_disk(&path, req.disk_gb)?;
        path
    };

    // Detect disk driver from extension
    let disk_driver = if disk_path.ends_with(".raw") || disk_path.ends_with(".img") {
        "raw"
    } else {
        "qcow2"
    };

    // Generate domain XML
    let iso_str = resolved_iso.as_ref().map(|p| p.display().to_string()).unwrap_or_default();
    let xml = generate_domain_xml(req, &disk_path, disk_driver, firmware, &iso_str);

    // Define the domain
    Domain::define_xml(conn, &xml)
        .map_err(|e| LibvirtError::Operation(format!("Failed to define VM '{}': {e}", req.name)))?;

    Ok(())
}

fn find_disk_path(conn: &Connect, vm_name: &str) -> Result<String, LibvirtError> {
    // Try to use the "default" storage pool path
    if let Ok(pool) = StoragePool::lookup_by_name(conn, "default") {
        if let Ok(xml) = pool.get_xml_desc(0) {
            if let Some(path) = extract_pool_path(&xml) {
                return Ok(format!("{}/{}.qcow2", path, vm_name));
            }
        }
    }

    // Fallback to /var/lib/libvirt/images
    Ok(format!("/var/lib/libvirt/images/{}.qcow2", vm_name))
}

fn extract_pool_path(xml: &str) -> Option<String> {
    crate::xml::extract_simple_text(xml, "path")
}

fn create_qcow2_disk(path: &str, size_gb: u64) -> Result<(), LibvirtError> {
    if Path::new(path).exists() {
        return Err(LibvirtError::Operation(format!(
            "Disk image already exists: {path}"
        )));
    }

    let output = Command::new("qemu-img")
        .args(["create", "-f", "qcow2", path, &format!("{size_gb}G")])
        .output()
        .map_err(LibvirtError::map_op("Failed to run qemu-img"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(LibvirtError::Operation(format!(
            "qemu-img failed: {stderr}"
        )));
    }

    Ok(())
}

/// Search common OVMF firmware locations across distros.
fn find_ovmf_code() -> Option<String> {
    let candidates = [
        "/usr/share/edk2/ovmf/OVMF_CODE.fd",           // Fedora/RHEL
        "/usr/share/OVMF/OVMF_CODE.fd",                 // Ubuntu/Debian
        "/usr/share/edk2/x64/OVMF_CODE.fd",             // Arch
        "/usr/share/qemu/OVMF_CODE.fd",                 // openSUSE
        "/usr/share/edk2/ovmf/OVMF_CODE.secboot.fd",    // Secure boot variant
        "/usr/share/OVMF/OVMF_CODE_4M.fd",              // Ubuntu newer
    ];
    for path in &candidates {
        if Path::new(path).is_file() {
            return Some(path.to_string());
        }
    }
    None
}

fn generate_domain_xml(req: &CreateVmRequest, disk_path: &str, disk_driver: &str, firmware: &str, iso_path: &str) -> String {
    let memory_kib = req.memory_mb * 1024;
    let name = crate::xml::escape(&req.name);
    let network = crate::xml::escape(&req.network);
    let disk_path = crate::xml::escape(disk_path);
    let disk_driver = crate::xml::escape(disk_driver);

    let cdrom_xml = if !iso_path.is_empty() {
        format!(
            r#"
    <disk type='file' device='cdrom'>
      <driver name='qemu' type='raw'/>
      <source file='{}'/>
      <target dev='sda' bus='sata'/>
      <readonly/>
    </disk>"#,
            crate::xml::escape(iso_path)
        )
    } else {
        String::new()
    };

    let boot_dev = if iso_path.is_empty() { "hd" } else { "cdrom" };

    // UEFI firmware support
    let os_xml = if firmware == "uefi" {
        let ovmf_path = find_ovmf_code().unwrap_or_else(|| "/usr/share/edk2/ovmf/OVMF_CODE.fd".to_string());
        format!(
            r#"<os>
    <type arch='x86_64' machine='pc-q35-9.0'>hvm</type>
    <loader readonly='yes' type='pflash'>{ovmf_path}</loader>
    <nvram>/var/lib/libvirt/qemu/nvram/{name}_VARS.fd</nvram>
    <boot dev='{boot_dev}'/>
  </os>"#,
            ovmf_path = crate::xml::escape(&ovmf_path),
            name = name,
            boot_dev = boot_dev,
        )
    } else {
        format!(
            r#"<os>
    <type arch='x86_64' machine='pc-q35-9.0'>hvm</type>
    <boot dev='{boot_dev}'/>
  </os>"#,
            boot_dev = boot_dev,
        )
    };

    format!(
        r#"<domain type='kvm'>
  <name>{name}</name>
  <memory unit='KiB'>{memory_kib}</memory>
  <vcpu placement='static'>{vcpus}</vcpu>
  {os_xml}
  <features>
    <acpi/>
    <apic/>
  </features>
  <cpu mode='host-passthrough' check='none'/>
  <clock offset='utc'/>
  <on_poweroff>destroy</on_poweroff>
  <on_reboot>restart</on_reboot>
  <on_crash>destroy</on_crash>
  <devices>
    <emulator>/usr/bin/qemu-system-x86_64</emulator>
    <disk type='file' device='disk'>
      <driver name='qemu' type='{disk_driver}'/>
      <source file='{disk_path}'/>
      <target dev='vda' bus='virtio'/>
    </disk>{cdrom_xml}
    <interface type='network'>
      <source network='{network}'/>
      <model type='virtio'/>
    </interface>
    <console type='pty'>
      <target type='serial' port='0'/>
    </console>
    <channel type='unix'>
      <target type='virtio' name='org.qemu.guest_agent.0'/>
    </channel>
    <!-- CRITICAL: Must be type='vnc', not 'spice'. The web UI console uses noVNC which
         only speaks VNC protocol. SPICE graphics will not work with the browser console.
         Do NOT change this to spice. -->
    <graphics type='vnc' port='-1' autoport='yes' listen='127.0.0.1'/>
    <video>
      <model type='virtio' heads='1'/>
    </video>
    <input type='tablet' bus='usb'/>
    <memballoon model='virtio'/>
    <rng model='virtio'>
      <backend model='random'>/dev/urandom</backend>
    </rng>
  </devices>
</domain>"#,
        name = name,
        memory_kib = memory_kib,
        vcpus = req.vcpus,
        os_xml = os_xml,
        disk_driver = disk_driver,
        disk_path = disk_path,
        cdrom_xml = cdrom_xml,
        network = network,
    )
}
