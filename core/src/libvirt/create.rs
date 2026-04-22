use std::path::Path;
use std::process::Command;

use virt::connect::Connect;
use virt::domain::Domain;
use virt::storage_pool::StoragePool;

use crate::config::{LibvirtConfig, VmCreateBackend};
use crate::state::CreateVmRequest;
use crate::LibvirtError;

/// Define a new VM using either native libvirt XML or external `virt-install` (see `[libvirt] create_backend`).
pub fn create_vm(
    conn: &Connect,
    req: &CreateVmRequest,
    backend: VmCreateBackend,
    libvirt_uri: &str,
    libvirt_cfg: &LibvirtConfig,
) -> Result<(), LibvirtError> {
    crate::validate::validate_name(&req.name)?;
    let mut req = req.clone();
    super::template_apply::apply_saved_template(conn, &mut req)?;
    super::mkosi::materialize_mkosi_if_requested(conn, &mut req, libvirt_cfg)?;
    super::virt_builder::materialize_virt_builder_if_requested(conn, &mut req, libvirt_cfg)?;
    match backend {
        VmCreateBackend::VirtInstall => {
            super::virt_install::create_vm_virt_install(&req, libvirt_uri)
        }
        VmCreateBackend::LibvirtXml => create_vm_libvirt_xml(conn, &req),
    }
}

fn create_vm_libvirt_xml(conn: &Connect, req: &CreateVmRequest) -> Result<(), LibvirtError> {
    // Validate inputs (VM name validated in create_vm before template / virt-builder).
    crate::validate::validate_vcpus(req.vcpus)?;
    crate::validate::validate_memory_mb(req.memory_mb)?;

    // Validate and normalize firmware
    let firmware = if req.firmware.is_empty() { "bios" } else { &req.firmware };
    if firmware != "bios" && firmware != "uefi" {
        return Err(LibvirtError::Invalid("Firmware must be 'bios' or 'uefi'".to_string()));
    }

    let gl = req.graphics_listen.trim();
    let gl = if gl.is_empty() { "127.0.0.1" } else { gl };
    crate::validate::validate_graphics_listen(gl)?;

    let gt = req.graphics_type.trim();
    let gt = if gt.is_empty() { "vnc" } else { gt };
    crate::validate::validate_graphics_type(gt)?;

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

    let resolved_cloud_init: Option<std::path::PathBuf> = if !req.cloud_init_iso.is_empty() {
        let p = std::path::Path::new(&req.cloud_init_iso);
        if !p.is_absolute() {
            return Err(LibvirtError::Invalid(
                "cloud_init_iso path must be absolute".to_string(),
            ));
        }
        let p = p
            .canonicalize()
            .map_err(|e| LibvirtError::Invalid(format!("Cannot resolve cloud_init_iso path: {e}")))?;
        if !p.is_file() {
            return Err(LibvirtError::Operation(format!(
                "cloud_init_iso not found or not a file: {}",
                p.display()
            )));
        }
        Some(p)
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
    let cloud_str = resolved_cloud_init
        .as_ref()
        .map(|p| p.display().to_string())
        .unwrap_or_default();
    let xml = generate_domain_xml(req, &disk_path, disk_driver, firmware, &iso_str, &cloud_str, gl, gt);

    // Define the domain
    Domain::define_xml(conn, &xml)
        .map_err(|e| LibvirtError::Operation(format!("Failed to define VM '{}': {e}", req.name)))?;

    Ok(())
}

pub(crate) fn find_disk_path(conn: &Connect, vm_name: &str) -> Result<String, LibvirtError> {
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
        "/usr/share/edk2/ovmf/x64/OVMF_CODE.fd",      // RHEL 9 / hyper2kvm-style path
        "/usr/share/OVMF/OVMF_CODE.fd",               // Ubuntu/Debian
        "/usr/share/edk2/x64/OVMF_CODE.fd",           // Arch
        "/usr/share/qemu/OVMF_CODE.fd",               // openSUSE
        "/usr/share/edk2/ovmf/OVMF_CODE.secboot.fd",   // Secure boot variant
        "/usr/share/edk2/ovmf/x64/OVMF_CODE.secboot.fd",
        "/usr/share/OVMF/OVMF_CODE_4M.fd",            // Ubuntu newer
    ];
    for path in &candidates {
        if Path::new(path).is_file() {
            return Some(path.to_string());
        }
    }
    None
}

fn generate_domain_xml(
    req: &CreateVmRequest,
    disk_path: &str,
    disk_driver: &str,
    firmware: &str,
    iso_path: &str,
    cloud_init_iso_path: &str,
    graphics_listen: &str,
    graphics_type: &str,
) -> String {
    let memory_kib = req.memory_mb * 1024;
    let name = crate::xml::escape(&req.name);
    let network = crate::xml::escape(&req.network);
    let disk_path = crate::xml::escape(disk_path);
    let disk_driver = crate::xml::escape(disk_driver);
    let graphics_listen = crate::xml::escape(graphics_listen);

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

    let cloud_init_cdrom_xml = if !cloud_init_iso_path.is_empty() {
        format!(
            r#"
    <disk type='file' device='cdrom'>
      <driver name='qemu' type='raw' cache='none'/>
      <source file='{}'/>
      <target dev='sdc' bus='sata'/>
      <readonly/>
    </disk>"#,
            crate::xml::escape(cloud_init_iso_path)
        )
    } else {
        String::new()
    };

    let boot_dev = if iso_path.is_empty() { "hd" } else { "cdrom" };

    let gtype = if graphics_type.eq_ignore_ascii_case("spice") {
        "spice"
    } else {
        "vnc"
    };
    let video_model = if gtype == "spice" { "qxl" } else { "virtio" };

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
  <currentMemory unit='KiB'>{memory_kib}</currentMemory>
  <vcpu placement='static'>{vcpus}</vcpu>
  {os_xml}
  <features>
    <acpi/>
    <apic/>
    <vmport state='off'/>
  </features>
  <cpu mode='host-passthrough' check='none'/>
  <clock offset='utc'>
    <timer name='rtc' tickpolicy='catchup'/>
    <timer name='pit' tickpolicy='delay'/>
    <timer name='hpet' present='no'/>
  </clock>
  <on_poweroff>destroy</on_poweroff>
  <on_reboot>restart</on_reboot>
  <on_crash>restart</on_crash>
  <devices>
    <emulator>/usr/bin/qemu-system-x86_64</emulator>
    <disk type='file' device='disk'>
      <driver name='qemu' type='{disk_driver}'/>
      <source file='{disk_path}'/>
      <target dev='vda' bus='virtio'/>
    </disk>{cdrom_xml}{cloud_init_cdrom_xml}
    <interface type='network'>
      <source network='{network}'/>
      <model type='virtio'/>
    </interface>
    <serial type='pty'>
      <target port='0'/>
    </serial>
    <console type='pty'>
      <target type='serial' port='0'/>
    </console>
    <channel type='unix'>
      <target type='virtio' name='org.qemu.guest_agent.0'/>
    </channel>
    <!-- VNC: noVNC + /ws/v1/vnc/{{name}}. SPICE: spice-html5 + /ws/v1/spice/{{name}}. -->
    <graphics type='{gtype}' port='-1' autoport='yes' listen='{graphics_listen}'/>
    <video>
      <model type='{video_model}' heads='1'/>
    </video>
    <controller type='usb' index='0' model='qemu-xhci'/>
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
        cloud_init_cdrom_xml = cloud_init_cdrom_xml,
        network = network,
        graphics_listen = graphics_listen,
        gtype = gtype,
        video_model = video_model,
    )
}
