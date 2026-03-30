use virt::connect::Connect;
use virt::domain::Domain;

use super::domain::lookup_domain;
use crate::state::AttachDiskRequest;
use crate::LibvirtError;

pub fn get_domain_flags_pub(domain: &Domain) -> u32 {
    get_domain_flags(domain)
}

fn get_domain_flags(domain: &Domain) -> u32 {
    domain.get_info()
        .map(|info| {
            if info.state == 1 /* VIR_DOMAIN_RUNNING */ {
                virt::sys::VIR_DOMAIN_AFFECT_LIVE | virt::sys::VIR_DOMAIN_AFFECT_CONFIG
            } else {
                virt::sys::VIR_DOMAIN_AFFECT_CONFIG
            }
        })
        .unwrap_or(virt::sys::VIR_DOMAIN_AFFECT_CONFIG)
}

pub fn attach_disk(conn: &Connect, vm_name: &str, req: &AttachDiskRequest) -> Result<(), LibvirtError> {
    let source_path = std::path::Path::new(&req.source);
    if !source_path.is_absolute() {
        return Err(LibvirtError::Invalid("Disk source path must be absolute".to_string()));
    }
    // Canonicalize to resolve symlinks and prevent path traversal
    let resolved = source_path.canonicalize()
        .map_err(|_| LibvirtError::Operation(format!("Disk source not found: {}", req.source)))?;
    if !resolved.is_file() {
        return Err(LibvirtError::Operation(format!("Disk source is not a file: {}", req.source)));
    }

    let domain = lookup_domain(conn, vm_name)?;

    let xml = format!(
        r#"<disk type='file' device='disk'>
  <driver name='qemu' type='{driver}'/>
  <source file='{source}'/>
  <target dev='{target}' bus='virtio'/>
</disk>"#,
        driver = crate::xml::escape(&req.driver),
        source = crate::xml::escape(&req.source),
        target = crate::xml::escape(&req.target),
    );

    let flags = get_domain_flags(&domain);
    domain
        .attach_device_flags(&xml, flags)
        .map_err(LibvirtError::map_op("Failed to attach disk"))?;
    Ok(())
}

pub fn detach_disk(conn: &Connect, vm_name: &str, target: &str) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, vm_name)?;

    let xml = format!(
        r#"<disk type='file' device='disk'>
  <target dev='{}'/>
</disk>"#,
        crate::xml::escape(target),
    );

    let flags = get_domain_flags(&domain);
    domain
        .detach_device_flags(&xml, flags)
        .map_err(|e| LibvirtError::Operation(format!("Failed to detach disk '{target}': {e}")))?;
    Ok(())
}

/// Resize a block device attached to a VM (in GB).
/// Note: size_bytes = size_gb * 1024^3, max 10240 GB = ~11 TB, fits in u64.
pub fn resize_block_device(conn: &Connect, vm_name: &str, target: &str, size_gb: u64) -> Result<(), LibvirtError> {
    crate::validate::validate_disk_gb(size_gb)?;
    let domain = lookup_domain(conn, vm_name)?;
    let size_bytes = size_gb * 1024 * 1024 * 1024;
    domain
        .block_resize(target, size_bytes, 0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to resize disk '{target}' on '{}': {e}", vm_name)))?;
    Ok(())
}

const ALLOWED_NIC_MODELS: &[&str] = &["virtio", "e1000", "e1000e", "rtl8139", "vmxnet3"];

/// Attach a network interface to a VM.
pub fn attach_interface(conn: &Connect, vm_name: &str, network: &str, model: &str) -> Result<(), LibvirtError> {
    crate::validate::validate_name(network)?;
    if !ALLOWED_NIC_MODELS.contains(&model) {
        return Err(LibvirtError::Invalid(format!(
            "Invalid NIC model '{}'. Allowed: {}", model, ALLOWED_NIC_MODELS.join(", ")
        )));
    }
    let domain = lookup_domain(conn, vm_name)?;

    let xml = format!(
        r#"<interface type='network'>
  <source network='{network}'/>
  <model type='{model}'/>
</interface>"#,
        network = crate::xml::escape(network),
        model = crate::xml::escape(model),
    );

    let flags = get_domain_flags(&domain);
    domain
        .attach_device_flags(&xml, flags)
        .map_err(LibvirtError::map_op("Failed to attach network interface"))?;
    Ok(())
}

/// Detach a network interface from a VM by MAC address.
pub fn detach_interface(conn: &Connect, vm_name: &str, mac: &str) -> Result<(), LibvirtError> {
    // Validate MAC address format (xx:xx:xx:xx:xx:xx)
    let parts: Vec<&str> = mac.split(':').collect();
    if parts.len() != 6 || !parts.iter().all(|p| p.len() == 2 && p.chars().all(|c| c.is_ascii_hexdigit())) {
        return Err(LibvirtError::Invalid(format!("Invalid MAC address format: '{mac}'")));
    }

    let domain = lookup_domain(conn, vm_name)?;

    let xml = format!(
        r#"<interface type='network'>
  <mac address='{}'/>
</interface>"#,
        crate::xml::escape(mac),
    );

    let flags = get_domain_flags(&domain);
    domain
        .detach_device_flags(&xml, flags)
        .map_err(|e| LibvirtError::Operation(format!("Failed to detach interface '{mac}': {e}")))?;
    Ok(())
}
