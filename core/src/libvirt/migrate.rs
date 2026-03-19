use virt::connect::Connect;

use super::domain::lookup_domain;
use crate::LibvirtError;

pub fn migrate_vm(
    conn: &Connect,
    name: &str,
    dest_uri: &str,
    live: bool,
) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, name)?;

    let mut flags = virt::sys::VIR_MIGRATE_PEER2PEER | virt::sys::VIR_MIGRATE_PERSIST_DEST | virt::sys::VIR_MIGRATE_UNDEFINE_SOURCE;
    if live {
        flags |= virt::sys::VIR_MIGRATE_LIVE;
    }

    domain
        .migrate(&Connect::open(Some(dest_uri))
            .map_err(|e| LibvirtError::Connection(format!("Failed to connect to destination: {e}")))?,
            flags, None, None, 0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to migrate VM '{name}' to '{dest_uri}': {e}")))?;

    Ok(())
}

pub fn migrate_vm_uri(
    conn: &Connect,
    name: &str,
    dest_uri: &str,
    live: bool,
) -> Result<(), LibvirtError> {
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
