use virt::connect::Connect;
use virt::domain::Domain;

use super::domain::lookup_domain;
use crate::state::AttachDiskRequest;
use crate::LibvirtError;

fn get_domain_flags(domain: &Domain) -> u32 {
    domain.get_info()
        .map(|info| {
            if info.state == 1 {
                virt::sys::VIR_DOMAIN_AFFECT_LIVE | virt::sys::VIR_DOMAIN_AFFECT_CONFIG
            } else {
                virt::sys::VIR_DOMAIN_AFFECT_CONFIG
            }
        })
        .unwrap_or(virt::sys::VIR_DOMAIN_AFFECT_CONFIG)
}

pub fn attach_disk(conn: &Connect, vm_name: &str, req: &AttachDiskRequest) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, vm_name)?;

    let xml = format!(
        r#"<disk type='file' device='disk'>
  <driver name='qemu' type='{driver}'/>
  <source file='{source}'/>
  <target dev='{target}' bus='virtio'/>
</disk>"#,
        driver = req.driver,
        source = req.source,
        target = req.target,
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
  <target dev='{target}'/>
</disk>"#,
    );

    let flags = get_domain_flags(&domain);
    domain
        .detach_device_flags(&xml, flags)
        .map_err(LibvirtError::map_op("Failed to detach disk '{target}'"))?;
    Ok(())
}
