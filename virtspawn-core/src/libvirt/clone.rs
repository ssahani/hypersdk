use virt::connect::Connect;
use virt::domain::Domain;

use crate::LibvirtError;

pub fn clone_vm(conn: &Connect, source_name: &str, new_name: &str) -> Result<(), LibvirtError> {
    let source = Domain::lookup_by_name(conn, source_name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{source_name}' not found: {e}")))?;

    let xml = source
        .get_xml_desc(0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to get XML: {e}")))?;

    // Replace the VM name in the XML
    let new_xml = replace_domain_name(&xml, new_name);
    // Remove UUID so libvirt generates a new one
    let new_xml = remove_xml_element(&new_xml, "uuid");
    // Generate new MAC addresses
    let new_xml = randomize_mac_addresses(&new_xml);

    Domain::define_xml(conn, &new_xml)
        .map_err(|e| LibvirtError::Operation(format!("Failed to define cloned VM: {e}")))?;

    Ok(())
}

fn replace_domain_name(xml: &str, new_name: &str) -> String {
    if let (Some(start), Some(end)) = (xml.find("<name>"), xml.find("</name>")) {
        let before = &xml[..start];
        let after = &xml[end + "</name>".len()..];
        format!("{before}<name>{new_name}</name>{after}")
    } else {
        xml.to_string()
    }
}

fn remove_xml_element(xml: &str, tag: &str) -> String {
    let open = format!("<{}>", tag);
    let close = format!("</{}>", tag);
    if let Some(start) = xml.find(&open) {
        if let Some(end_offset) = xml[start..].find(&close) {
            let end = start + end_offset + close.len();
            // Also consume trailing whitespace/newline
            let after = &xml[end..];
            let trim_end = after.len() - after.trim_start().len();
            let mut result = xml[..start].to_string();
            result.push_str(&xml[end + trim_end..]);
            return result;
        }
    }
    xml.to_string()
}

fn randomize_mac_addresses(xml: &str) -> String {
    let mut result = String::new();
    let mut remaining = xml;

    while let Some(pos) = remaining.find("<mac ") {
        result.push_str(&remaining[..pos]);
        let tag_start = &remaining[pos..];
        if let Some(end) = tag_start.find("/>") {
            // Replace the entire <mac .../> tag with a new MAC
            let new_mac = generate_mac();
            result.push_str(&format!("<mac address='{new_mac}'/>"));
            remaining = &remaining[pos + end + 2..];
        } else if let Some(end) = tag_start.find('>') {
            let new_mac = generate_mac();
            result.push_str(&format!("<mac address='{new_mac}'/>"));
            remaining = &remaining[pos + end + 1..];
        } else {
            result.push_str(tag_start);
            remaining = "";
        }
    }
    result.push_str(remaining);
    result
}

fn generate_mac() -> String {
    use std::collections::hash_map::RandomState;
    use std::hash::{BuildHasher, Hasher};
    let s = RandomState::new();
    let mut h = s.build_hasher();
    h.write_u64(std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as u64);
    let hash = h.finish();
    let bytes = hash.to_le_bytes();
    format!(
        "52:54:00:{:02x}:{:02x}:{:02x}",
        bytes[0], bytes[1], bytes[2]
    )
}
