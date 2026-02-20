use virt::connect::Connect;
use virt::domain::Domain;

use crate::state::{DiskInfo, InterfaceInfo, VmDetails, VmInfo};
use crate::LibvirtError;

fn state_to_string(state: u32) -> String {
    match state {
        0 => "no state".to_string(),
        1 => "running".to_string(),
        2 => "blocked".to_string(),
        3 => "paused".to_string(),
        4 => "shutting down".to_string(),
        5 => "shutoff".to_string(),
        6 => "crashed".to_string(),
        7 => "suspended".to_string(),
        _ => format!("unknown ({state})"),
    }
}

pub fn list_vms(conn: &Connect) -> Result<Vec<VmInfo>, LibvirtError> {
    let domains = conn
        .list_all_domains(0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to list domains: {e}")))?;

    let mut vms = Vec::new();
    for domain in domains {
        let name = domain
            .get_name()
            .map_err(|e| LibvirtError::Operation(format!("Failed to get domain name: {e}")))?;

        let info = domain
            .get_info()
            .map_err(|e| LibvirtError::Operation(format!("Failed to get domain info: {e}")))?;

        vms.push(VmInfo {
            name,
            state: state_to_string(info.state),
            vcpus: info.nr_virt_cpu,
            memory_mb: info.memory / 1024,
        });
    }

    Ok(vms)
}

pub fn get_vm_details(conn: &Connect, name: &str) -> Result<VmDetails, LibvirtError> {
    let domain = Domain::lookup_by_name(conn, name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{name}' not found: {e}")))?;

    let info = domain
        .get_info()
        .map_err(|e| LibvirtError::Operation(format!("Failed to get domain info: {e}")))?;

    let uuid = domain
        .get_uuid_string()
        .map_err(|e| LibvirtError::Operation(format!("Failed to get UUID: {e}")))?;

    let xml = domain
        .get_xml_desc(0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to get XML: {e}")))?;

    let autostart = domain.get_autostart().unwrap_or(false);
    let persistent = domain.is_persistent().unwrap_or(false);

    let (os_type, arch) = parse_os_info(&xml);
    let interfaces = parse_interfaces(&xml);
    let disks = parse_disks(&xml);

    Ok(VmDetails {
        name: name.to_string(),
        uuid,
        state: state_to_string(info.state),
        vcpus: info.nr_virt_cpu,
        memory_mb: info.memory / 1024,
        os_type,
        arch,
        autostart,
        persistent,
        interfaces,
        disks,
    })
}

pub fn get_vm_xml(conn: &Connect, name: &str) -> Result<String, LibvirtError> {
    let domain = Domain::lookup_by_name(conn, name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{name}' not found: {e}")))?;

    domain
        .get_xml_desc(0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to get XML: {e}")))
}

pub fn start_vm(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    let domain = Domain::lookup_by_name(conn, name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{name}' not found: {e}")))?;

    domain
        .create()
        .map_err(|e| LibvirtError::Operation(format!("Failed to start VM '{name}': {e}")))?;

    Ok(())
}

pub fn stop_vm(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    let domain = Domain::lookup_by_name(conn, name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{name}' not found: {e}")))?;

    domain
        .destroy()
        .map_err(|e| LibvirtError::Operation(format!("Failed to stop VM '{name}': {e}")))?;

    Ok(())
}

pub fn shutdown_vm(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    let domain = Domain::lookup_by_name(conn, name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{name}' not found: {e}")))?;

    domain
        .shutdown()
        .map_err(|e| LibvirtError::Operation(format!("Failed to shutdown VM '{name}': {e}")))?;

    Ok(())
}

pub fn reboot_vm(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    let domain = Domain::lookup_by_name(conn, name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{name}' not found: {e}")))?;

    domain
        .reboot(0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to reboot VM '{name}': {e}")))?;

    Ok(())
}

pub fn pause_vm(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    let domain = Domain::lookup_by_name(conn, name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{name}' not found: {e}")))?;

    domain
        .suspend()
        .map_err(|e| LibvirtError::Operation(format!("Failed to pause VM '{name}': {e}")))?;

    Ok(())
}

pub fn resume_vm(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    let domain = Domain::lookup_by_name(conn, name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{name}' not found: {e}")))?;

    domain
        .resume()
        .map_err(|e| LibvirtError::Operation(format!("Failed to resume VM '{name}': {e}")))?;

    Ok(())
}

pub fn delete_vm(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    let domain = Domain::lookup_by_name(conn, name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{name}' not found: {e}")))?;

    let info = domain.get_info().ok();
    if let Some(info) = info {
        if info.state == 1 {
            let _ = domain.destroy();
        }
    }

    domain
        .undefine()
        .map_err(|e| LibvirtError::Operation(format!("Failed to delete VM '{name}': {e}")))?;

    Ok(())
}

pub fn set_autostart(conn: &Connect, name: &str, autostart: bool) -> Result<(), LibvirtError> {
    let domain = Domain::lookup_by_name(conn, name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{name}' not found: {e}")))?;

    domain
        .set_autostart(autostart)
        .map_err(|e| LibvirtError::Operation(format!("Failed to set autostart: {e}")))?;

    Ok(())
}

pub fn rename_vm(conn: &Connect, name: &str, new_name: &str) -> Result<(), LibvirtError> {
    crate::validate::validate_name(new_name)?;

    let domain = Domain::lookup_by_name(conn, name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{name}' not found: {e}")))?;

    // VM must be shutoff to rename
    let info = domain
        .get_info()
        .map_err(|e| LibvirtError::Operation(format!("Failed to get VM info: {e}")))?;

    if info.state != 5 {
        return Err(LibvirtError::Operation(
            "VM must be shutoff to rename".to_string(),
        ));
    }

    domain
        .rename(new_name, 0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to rename VM '{name}': {e}")))?;

    Ok(())
}

// ── XML parsing helpers ─────────────────────────────────────────────────

fn parse_os_info(xml: &str) -> (String, String) {
    let os_type = extract_xml_text(xml, "type").unwrap_or_else(|| "unknown".to_string());
    let arch = extract_xml_attr(xml, "type", "arch").unwrap_or_else(|| "unknown".to_string());
    (os_type, arch)
}

fn parse_interfaces(xml: &str) -> Vec<InterfaceInfo> {
    let mut interfaces = Vec::new();
    for iface_block in split_xml_blocks(xml, "interface") {
        let mac = extract_xml_attr(&iface_block, "mac", "address")
            .unwrap_or_else(|| "unknown".to_string());
        let source = extract_xml_attr(&iface_block, "source", "network")
            .or_else(|| extract_xml_attr(&iface_block, "source", "bridge"))
            .unwrap_or_else(|| "unknown".to_string());
        let model = extract_xml_attr(&iface_block, "model", "type")
            .unwrap_or_else(|| "unknown".to_string());
        interfaces.push(InterfaceInfo {
            mac_address: mac,
            source,
            model,
        });
    }
    interfaces
}

fn parse_disks(xml: &str) -> Vec<DiskInfo> {
    let mut disks = Vec::new();
    for disk_block in split_xml_blocks(xml, "disk") {
        let device = extract_xml_attr(&disk_block, "disk", "device")
            .unwrap_or_else(|| "disk".to_string());
        let source = extract_xml_attr(&disk_block, "source", "file")
            .or_else(|| extract_xml_attr(&disk_block, "source", "dev"))
            .or_else(|| extract_xml_attr(&disk_block, "source", "volume"))
            .unwrap_or_else(|| "unknown".to_string());
        let driver = extract_xml_attr(&disk_block, "driver", "type")
            .unwrap_or_else(|| "unknown".to_string());
        let target = extract_xml_attr(&disk_block, "target", "dev")
            .unwrap_or_else(|| "unknown".to_string());
        disks.push(DiskInfo {
            device,
            source,
            driver,
            target,
        });
    }
    disks
}

fn extract_xml_text(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<{}", tag);
    let close = format!("</{}>", tag);
    let start = xml.find(&open)?;
    let after_open = &xml[start..];
    let gt = after_open.find('>')?;
    let content_start = start + gt + 1;
    let end = xml[content_start..].find(&close)?;
    Some(xml[content_start..content_start + end].trim().to_string())
}

fn extract_xml_attr(xml: &str, tag: &str, attr: &str) -> Option<String> {
    let open = format!("<{}", tag);
    let mut search_from = 0;
    while let Some(pos) = xml[search_from..].find(&open) {
        let abs = search_from + pos;
        let after_tag = abs + open.len();
        // Ensure word boundary (next char is space, >, /)
        if let Some(ch) = xml[after_tag..].chars().next() {
            if ch != ' ' && ch != '>' && ch != '/' && ch != '\n' {
                search_from = after_tag;
                continue;
            }
        }
        let after = &xml[abs..];
        let end = after.find('>')?;
        let tag_content = &after[..end];
        // Try double quotes
        let dq_pattern = format!("{}=\"", attr);
        if let Some(attr_start) = tag_content.find(&dq_pattern) {
            let value_start = attr_start + dq_pattern.len();
            let value_end = tag_content[value_start..].find('"')?;
            return Some(tag_content[value_start..value_start + value_end].to_string());
        }
        // Try single quotes
        let sq_pattern = format!("{}='", attr);
        if let Some(attr_start) = tag_content.find(&sq_pattern) {
            let value_start = attr_start + sq_pattern.len();
            let value_end = tag_content[value_start..].find('\'')?;
            return Some(tag_content[value_start..value_start + value_end].to_string());
        }
        search_from = after_tag;
    }
    None
}

fn split_xml_blocks(xml: &str, tag: &str) -> Vec<String> {
    let open = format!("<{}", tag);
    let close = format!("</{}>", tag);
    let mut blocks = Vec::new();
    let mut search_from = 0;

    while let Some(start) = xml[search_from..].find(&open) {
        let abs_start = search_from + start;
        let after_tag = abs_start + open.len();
        // Ensure word boundary
        if let Some(ch) = xml[after_tag..].chars().next() {
            if ch != ' ' && ch != '>' && ch != '/' && ch != '\n' {
                search_from = after_tag;
                continue;
            }
        }
        // Try to find closing tag
        if let Some(end) = xml[abs_start..].find(&close) {
            let abs_end = abs_start + end + close.len();
            blocks.push(xml[abs_start..abs_end].to_string());
            search_from = abs_end;
        } else {
            // Self-closing or no close tag, find the next '>'
            if let Some(gt) = xml[abs_start..].find('>') {
                let abs_end = abs_start + gt + 1;
                blocks.push(xml[abs_start..abs_end].to_string());
                search_from = abs_end;
            } else {
                break;
            }
        }
    }
    blocks
}
