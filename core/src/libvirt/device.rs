use virt::connect::Connect;
use virt::domain::Domain;

use super::domain::lookup_domain;
use crate::state::AttachDiskRequest;
use crate::LibvirtError;

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
        return Err(LibvirtError::Operation("Disk source path must be absolute".to_string()));
    }
    if !source_path.exists() {
        return Err(LibvirtError::Operation(format!("Disk source not found: {}", req.source)));
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
