use tracing::warn;
use virt::connect::Connect;
use virt::domain_snapshot::DomainSnapshot;

use super::domain::lookup_domain;
use crate::state::SnapshotInfo;
use crate::xml;
use crate::LibvirtError;

pub fn list_snapshots(conn: &Connect, vm_name: &str) -> Result<Vec<SnapshotInfo>, LibvirtError> {
    let domain = lookup_domain(conn, vm_name)?;

    let snaps = domain
        .list_all_snapshots(0)
        .map_err(LibvirtError::map_op("Failed to list snapshots"))?;

    let current = DomainSnapshot::current(&domain, 0)
        .ok()
        .and_then(|s| s.get_name().ok());

    let mut result = Vec::new();
    for snap in snaps {
        let name = snap
            .get_name()
            .map_err(LibvirtError::map_op("Failed to get snapshot name"))?;

        let xml_str = match snap.get_xml_desc(0) {
            Ok(x) => x,
            Err(e) => {
                warn!("Failed to get XML for snapshot '{}': {}", name, e);
                String::new()
            }
        };

        let creation_time = xml::extract_simple_text(&xml_str, "creationTime")
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(0);

        let state =
            xml::extract_simple_text(&xml_str, "state").unwrap_or_else(crate::unknown_string);
        let description = xml::extract_simple_text(&xml_str, "description").unwrap_or_default();

        let parent = extract_parent_name(&xml_str).unwrap_or_default();

        let is_current = current.as_deref() == Some(name.as_str());

        result.push(SnapshotInfo {
            name,
            vm_name: vm_name.to_string(),
            creation_time,
            state,
            description,
            parent,
            is_current,
        });
    }

    Ok(result)
}

pub fn list_all_snapshots(conn: &Connect) -> Result<Vec<SnapshotInfo>, LibvirtError> {
    let domains = conn
        .list_all_domains(0)
        .map_err(LibvirtError::map_op("Failed to list domains"))?;

    let mut all_snaps = Vec::new();
    for domain in domains {
        let name = domain.get_name().unwrap_or_default();
        match list_snapshots(conn, &name) {
            Ok(snaps) => all_snaps.extend(snaps),
            Err(e) => warn!("Failed to list snapshots for VM '{}': {}", name, e),
        }
    }

    Ok(all_snaps)
}

pub fn create_snapshot(
    conn: &Connect,
    vm_name: &str,
    snap_name: &str,
    description: &str,
    disk_only: bool,
) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, vm_name)?;

    let memory_line = if disk_only {
        "\n  <memory snapshot='no'/>"
    } else {
        ""
    };

    let xml_str = format!(
        r#"<domainsnapshot>
  <name>{}</name>
  <description>{}</description>{}
</domainsnapshot>"#,
        crate::xml::escape(snap_name),
        crate::xml::escape(description),
        memory_line,
    );

    // VIR_DOMAIN_SNAPSHOT_CREATE_DISK_ONLY = 16
    let flags: u32 = if disk_only { 16 } else { 0 };

    DomainSnapshot::create_xml(&domain, &xml_str, flags)
        .map_err(LibvirtError::map_op("Failed to create snapshot"))?;

    Ok(())
}

pub fn delete_snapshot(conn: &Connect, vm_name: &str, snap_name: &str) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, vm_name)?;

    let snap = DomainSnapshot::lookup_by_name(&domain, snap_name, 0)
        .map_err(|e| LibvirtError::NotFound(format!("Snapshot '{snap_name}' not found: {e}")))?;

    snap.delete(0)
        .map_err(LibvirtError::map_op("Failed to delete snapshot"))?;

    Ok(())
}

pub fn revert_snapshot(conn: &Connect, vm_name: &str, snap_name: &str) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, vm_name)?;

    let snap = DomainSnapshot::lookup_by_name(&domain, snap_name, 0)
        .map_err(|e| LibvirtError::NotFound(format!("Snapshot '{snap_name}' not found: {e}")))?;

    snap.revert(0)
        .map_err(LibvirtError::map_op("Failed to revert snapshot"))?;

    Ok(())
}

fn extract_parent_name(xml_str: &str) -> Option<String> {
    let blocks = xml::split_blocks(xml_str, "parent");
    blocks
        .first()
        .and_then(|block| xml::extract_simple_text(block, "name"))
}
