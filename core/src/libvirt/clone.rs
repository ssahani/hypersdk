// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

use virt::connect::Connect;
use virt::domain::Domain;

use super::domain::lookup_domain;
use crate::LibvirtError;

pub fn clone_vm(conn: &Connect, source_name: &str, new_name: &str) -> Result<(), LibvirtError> {
    crate::validate::validate_name(new_name)?;

    let source = lookup_domain(conn, source_name)?;

    let xml = source
        .get_xml_desc(0)
        .map_err(LibvirtError::map_op("Failed to get XML"))?;

    // Replace the VM name in the XML
    let new_xml = replace_domain_name(&xml, new_name).ok_or_else(|| {
        LibvirtError::Operation(
            "Failed to replace VM name in XML: <name> element not found".to_string(),
        )
    })?;
    // Remove UUID so libvirt generates a new one
    let new_xml = remove_xml_element(&new_xml, "uuid");
    // Generate new MAC addresses
    let new_xml = randomize_mac_addresses(&new_xml);

    Domain::define_xml(conn, &new_xml)
        .map_err(LibvirtError::map_op("Failed to define cloned VM"))?;

    Ok(())
}

fn replace_domain_name(xml: &str, new_name: &str) -> Option<String> {
    let start = xml.find("<name>")?;
    let end = xml.find("</name>")?;
    let before = &xml[..start];
    let after = &xml[end + "</name>".len()..];
    Some(format!(
        "{before}<name>{}</name>{after}",
        crate::xml::escape(new_name)
    ))
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
    let mut counter: u64 = 0;

    while let Some(pos) = remaining.find("<mac ") {
        result.push_str(&remaining[..pos]);
        let tag_start = &remaining[pos..];
        if let Some(end) = tag_start.find("/>") {
            let new_mac = generate_mac(counter);
            counter += 1;
            result.push_str(&format!("<mac address='{new_mac}'/>"));
            remaining = &remaining[pos + end + 2..];
        } else if let Some(end) = tag_start.find('>') {
            let new_mac = generate_mac(counter);
            counter += 1;
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

fn generate_mac(counter: u64) -> String {
    use std::collections::hash_map::RandomState;
    use std::hash::{BuildHasher, Hasher};
    // RandomState is seeded from OS entropy; use two independent instances
    // combined with counter to maximize entropy
    let s1 = RandomState::new();
    let s2 = RandomState::new();
    let mut h1 = s1.build_hasher();
    let mut h2 = s2.build_hasher();
    h1.write_u64(counter);
    h2.write_u64(counter.wrapping_add(1));
    let hash1 = h1.finish();
    let hash2 = h2.finish();
    let b1 = hash1.to_le_bytes();
    let b2 = hash2.to_le_bytes();
    format!(
        "52:54:00:{:02x}:{:02x}:{:02x}",
        b1[0] ^ b2[1],
        b1[2] ^ b2[3],
        b1[4] ^ b2[5]
    )
}
