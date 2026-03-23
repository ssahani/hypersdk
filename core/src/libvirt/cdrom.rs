use virt::connect::Connect;

use super::domain::lookup_domain;
use crate::LibvirtError;

pub fn insert_cdrom(conn: &Connect, name: &str, iso_path: &str, target: &str) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, name)?;

    // Validate ISO path: must be absolute and resolve to a real path (no symlink escapes)
    let path = std::path::Path::new(iso_path);
    if !path.is_absolute() {
        return Err(LibvirtError::Operation("ISO path must be absolute".to_string()));
    }
    let resolved = path.canonicalize()
        .map_err(|_| LibvirtError::Operation(format!("ISO file not found: {iso_path}")))?;
    if !resolved.is_file() {
        return Err(LibvirtError::Operation(format!("ISO path is not a file: {iso_path}")));
    }

    let xml = format!(
        r#"<disk type='file' device='cdrom'>
  <driver name='qemu' type='raw'/>
  <source file='{}'/>
  <target dev='{}' bus='sata'/>
  <readonly/>
</disk>"#,
        crate::xml::escape(iso_path),
        crate::xml::escape(target),
    );

    let flags = get_update_flags(&domain);
    domain
        .update_device_flags(&xml, flags)
        .map_err(|e| LibvirtError::Operation(format!("Failed to insert CD-ROM: {e}")))?;
    Ok(())
}

pub fn eject_cdrom(conn: &Connect, name: &str, target: &str) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, name)?;

    let xml = format!(
        r#"<disk type='file' device='cdrom'>
  <target dev='{}' bus='sata'/>
  <readonly/>
</disk>"#,
        crate::xml::escape(target),
    );

    let flags = get_update_flags(&domain);
    domain
        .update_device_flags(&xml, flags)
        .map_err(|e| LibvirtError::Operation(format!("Failed to eject CD-ROM: {e}")))?;
    Ok(())
}

fn get_update_flags(domain: &virt::domain::Domain) -> u32 {
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
