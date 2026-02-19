use virt::connect::Connect;
use virt::domain::Domain;

use crate::state::AttachDiskRequest;
use crate::LibvirtError;

pub fn attach_disk(conn: &Connect, vm_name: &str, req: &AttachDiskRequest) -> Result<(), LibvirtError> {
    let domain = Domain::lookup_by_name(conn, vm_name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{vm_name}' not found: {e}")))?;

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

    let flags = domain.get_info()
        .map(|info| {
            if info.state as u32 == 1 {
                virt::sys::VIR_DOMAIN_AFFECT_LIVE | virt::sys::VIR_DOMAIN_AFFECT_CONFIG
            } else {
                virt::sys::VIR_DOMAIN_AFFECT_CONFIG
            }
        })
        .unwrap_or(virt::sys::VIR_DOMAIN_AFFECT_CONFIG);

    domain
        .attach_device_flags(&xml, flags)
        .map_err(|e| LibvirtError::Operation(format!("Failed to attach disk: {e}")))?;

    Ok(())
}

pub fn detach_disk(conn: &Connect, vm_name: &str, target: &str) -> Result<(), LibvirtError> {
    let domain = Domain::lookup_by_name(conn, vm_name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{vm_name}' not found: {e}")))?;

    let xml = format!(
        r#"<disk type='file' device='disk'>
  <target dev='{target}'/>
</disk>"#,
    );

    let flags = domain.get_info()
        .map(|info| {
            if info.state as u32 == 1 {
                virt::sys::VIR_DOMAIN_AFFECT_LIVE | virt::sys::VIR_DOMAIN_AFFECT_CONFIG
            } else {
                virt::sys::VIR_DOMAIN_AFFECT_CONFIG
            }
        })
        .unwrap_or(virt::sys::VIR_DOMAIN_AFFECT_CONFIG);

    domain
        .detach_device_flags(&xml, flags)
        .map_err(|e| LibvirtError::Operation(format!("Failed to detach disk '{target}': {e}")))?;

    Ok(())
}
