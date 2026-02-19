use virt::connect::Connect;
use virt::domain::Domain;
use virt::domain_snapshot::DomainSnapshot;

use crate::state::SnapshotInfo;
use crate::LibvirtError;

pub fn list_snapshots(conn: &Connect, vm_name: &str) -> Result<Vec<SnapshotInfo>, LibvirtError> {
    let domain = Domain::lookup_by_name(conn, vm_name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{vm_name}' not found: {e}")))?;

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

        let xml = snap.get_xml_desc(0).unwrap_or_default();

        let creation_time = extract_snap_xml_value(&xml, "creationTime")
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(0);

        let state = extract_snap_xml_value(&xml, "state").unwrap_or_else(|| "unknown".to_string());
        let description =
            extract_snap_xml_value(&xml, "description").unwrap_or_else(|| String::new());
        let parent = extract_snap_parent(&xml).unwrap_or_else(|| String::new());

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
    let domain = Domain::lookup_by_name(conn, vm_name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{vm_name}' not found: {e}")))?;

    let xml = format!(
        r#"<domainsnapshot>
  <name>{snap_name}</name>
  <description>{description}</description>
</domainsnapshot>"#
    );

    DomainSnapshot::create_xml(&domain, &xml, 0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to create snapshot: {e}")))?;

    Ok(())
}

pub fn delete_snapshot(
    conn: &Connect,
    vm_name: &str,
    snap_name: &str,
) -> Result<(), LibvirtError> {
    let domain = Domain::lookup_by_name(conn, vm_name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{vm_name}' not found: {e}")))?;

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
    let domain = Domain::lookup_by_name(conn, vm_name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{vm_name}' not found: {e}")))?;

    let snap = DomainSnapshot::lookup_by_name(&domain, snap_name, 0)
        .map_err(|e| LibvirtError::NotFound(format!("Snapshot '{snap_name}' not found: {e}")))?;

    snap.revert(0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to revert snapshot: {e}")))?;

    Ok(())
}

fn extract_snap_xml_value(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<{}>", tag);
    let close = format!("</{}>", tag);
    let start = xml.find(&open)?;
    let content_start = start + open.len();
    let end = xml[content_start..].find(&close)?;
    Some(xml[content_start..content_start + end].trim().to_string())
}

fn extract_snap_parent(xml: &str) -> Option<String> {
    let parent_block_start = xml.find("<parent>")?;
    let parent_block_end = xml.find("</parent>")?;
    let block = &xml[parent_block_start..parent_block_end];
    extract_snap_xml_value(block, "name")
}
