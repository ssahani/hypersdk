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
    crate::validate::validate_disk_gb(req.disk_gb)?;

    // Validate ISO path if provided
    if !req.iso.is_empty() {
        let iso_path = std::path::Path::new(&req.iso);
        if !iso_path.is_absolute() {
            return Err(LibvirtError::Operation("ISO path must be absolute".to_string()));
        }
        if !iso_path.exists() {
            return Err(LibvirtError::Operation(format!("ISO file not found: {}", req.iso)));
        }
    }

    // Determine storage pool path for disk
    let disk_path = find_disk_path(conn, &req.name)?;

    // Create qcow2 disk image
    create_qcow2_disk(&disk_path, req.disk_gb)?;

    // Generate domain XML
    let xml = generate_domain_xml(req, &disk_path);

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

fn generate_domain_xml(req: &CreateVmRequest, disk_path: &str) -> String {
    let memory_kib = req.memory_mb * 1024;
    let name = crate::xml::escape(&req.name);
    let network = crate::xml::escape(&req.network);
    let disk_path = crate::xml::escape(disk_path);

    let cdrom_xml = if !req.iso.is_empty() {
        format!(
            r#"
    <disk type='file' device='cdrom'>
      <driver name='qemu' type='raw'/>
      <source file='{}'/>
      <target dev='sda' bus='sata'/>
      <readonly/>
    </disk>"#,
            crate::xml::escape(&req.iso)
        )
    } else {
        String::new()
    };

    let boot_dev = if req.iso.is_empty() { "hd" } else { "cdrom" };

    format!(
        r#"<domain type='kvm'>
  <name>{name}</name>
  <memory unit='KiB'>{memory_kib}</memory>
  <vcpu placement='static'>{vcpus}</vcpu>
  <os>
    <type arch='x86_64' machine='pc-q35-9.0'>hvm</type>
    <boot dev='{boot_dev}'/>
  </os>
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
      <driver name='qemu' type='qcow2'/>
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
        boot_dev = boot_dev,
        disk_path = disk_path,
        cdrom_xml = cdrom_xml,
        network = network,
    )
}
