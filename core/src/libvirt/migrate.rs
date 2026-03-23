use virt::connect::Connect;

use super::domain::lookup_domain;
use crate::LibvirtError;

const ALLOWED_URI_SCHEMES: &[&str] = &[
    "qemu://",
    "qemu+ssh://",
    "qemu+tcp://",
    "qemu+tls://",
    "qemu+unix://",
];

fn validate_migrate_uri(uri: &str) -> Result<(), LibvirtError> {
    if !ALLOWED_URI_SCHEMES.iter().any(|scheme| uri.starts_with(scheme)) {
        return Err(LibvirtError::Operation(format!(
            "Invalid migration URI scheme. Allowed: {}",
            ALLOWED_URI_SCHEMES.join(", ")
        )));
    }
    Ok(())
}

pub fn migrate_vm_uri(
    conn: &Connect,
    name: &str,
    dest_uri: &str,
    live: bool,
) -> Result<(), LibvirtError> {
    validate_migrate_uri(dest_uri)?;
    let domain = lookup_domain(conn, name)?;

    let mut flags = virt::sys::VIR_MIGRATE_PEER2PEER | virt::sys::VIR_MIGRATE_PERSIST_DEST;
    if live {
        flags |= virt::sys::VIR_MIGRATE_LIVE;
    }

    domain
        .migrate_to_uri(dest_uri, flags, None, 0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to migrate VM '{name}': {e}")))?;

    Ok(())
}
