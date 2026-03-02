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
        .map_err(|e| LibvirtError::Operation(format!("Failed to list snapshots: {e}")))?;

    let current = DomainSnapshot::current(&domain, 0)
        .ok()
        .and_then(|s| s.get_name().ok());

    let mut result = Vec::new();
    for snap in snaps {
        let name = snap
            .get_name()
            .map_err(|e| LibvirtError::Operation(format!("Failed to get snapshot name: {e}")))?;

        let xml_str = snap.get_xml_desc(0).unwrap_or_default();

        let creation_time = xml::extract_simple_text(&xml_str, "creationTime")
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(0);

        let state =
            xml::extract_simple_text(&xml_str, "state").unwrap_or_else(|| "unknown".to_string());
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
        .map_err(|e| LibvirtError::Operation(format!("Failed to list domains: {e}")))?;

    let mut all_snaps = Vec::new();
    for domain in domains {
        let name = domain.get_name().unwrap_or_default();
        if let Ok(snaps) = list_snapshots(conn, &name) {
            all_snaps.extend(snaps);
        }
    }

    Ok(all_snaps)
}

pub fn create_snapshot(
    conn: &Connect,
    vm_name: &str,
    snap_name: &str,
    description: &str,
) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, vm_name)?;

    let xml_str = format!(
        r#"<domainsnapshot>
  <name>{snap_name}</name>
  <description>{description}</description>
</domainsnapshot>"#
    );

    DomainSnapshot::create_xml(&domain, &xml_str, 0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to create snapshot: {e}")))?;

    Ok(())
}

pub fn delete_snapshot(
    conn: &Connect,
    vm_name: &str,
    snap_name: &str,
) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, vm_name)?;

    let snap = DomainSnapshot::lookup_by_name(&domain, snap_name, 0)
        .map_err(|e| LibvirtError::NotFound(format!("Snapshot '{snap_name}' not found: {e}")))?;

    snap.delete(0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to delete snapshot: {e}")))?;

    Ok(())
}

pub fn revert_snapshot(
    conn: &Connect,
    vm_name: &str,
    snap_name: &str,
) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, vm_name)?;

    let snap = DomainSnapshot::lookup_by_name(&domain, snap_name, 0)
        .map_err(|e| LibvirtError::NotFound(format!("Snapshot '{snap_name}' not found: {e}")))?;

    snap.revert(0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to revert snapshot: {e}")))?;

    Ok(())
}

fn extract_parent_name(xml_str: &str) -> Option<String> {
    let parent_start = xml_str.find("<parent>")?;
    let parent_end = xml_str.find("</parent>")?;
    let block = &xml_str[parent_start..parent_end];
    xml::extract_simple_text(block, "name")
}
