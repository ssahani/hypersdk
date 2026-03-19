use virt::connect::Connect;

use super::domain::lookup_domain;
use crate::LibvirtError;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BootConfig {
    pub boot_devices: Vec<String>,
    pub firmware: String,
    pub secure_boot: bool,
    pub kernel: String,
    pub initrd: String,
    pub cmdline: String,
}

pub fn get_boot_config(conn: &Connect, name: &str) -> Result<BootConfig, LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    let xml = domain
        .get_xml_desc(0)
        .map_err(LibvirtError::map_op("Failed to get VM XML"))?;

    let mut boot_devices = Vec::new();
    for block in crate::xml::split_blocks(&xml, "boot") {
        if let Some(dev) = crate::xml::extract_attr(&block, "boot", "dev") {
            boot_devices.push(dev);
        }
    }

    let firmware = crate::xml::extract_attr(&xml, "loader", "type").unwrap_or_else(|| "bios".to_string());
    let secure_boot = crate::xml::extract_attr(&xml, "loader", "secure").unwrap_or_default() == "yes";
    let kernel = crate::xml::extract_simple_text(&xml, "kernel").unwrap_or_default();
    let initrd = crate::xml::extract_simple_text(&xml, "initrd").unwrap_or_default();
    let cmdline = crate::xml::extract_simple_text(&xml, "cmdline").unwrap_or_default();

    Ok(BootConfig { boot_devices, firmware, secure_boot, kernel, initrd, cmdline })
}

pub fn set_boot_order(conn: &Connect, name: &str, devices: &[String]) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    let xml = domain
        .get_xml_desc(virt::sys::VIR_DOMAIN_XML_INACTIVE)
        .map_err(LibvirtError::map_op("Failed to get VM XML"))?;

    // Remove existing boot entries and add new ones
    let mut new_xml = xml.clone();
    // Remove old boot lines
    while let Some(start) = new_xml.find("<boot dev=") {
        if let Some(end) = new_xml[start..].find("/>") {
            new_xml = format!("{}{}", &new_xml[..start], &new_xml[start + end + 2..]);
        } else {
            break;
        }
    }

    // Insert new boot entries before </os>
    if let Some(os_end) = new_xml.find("</os>") {
        let boot_xml: String = devices.iter()
            .map(|d| format!("    <boot dev='{}'/>\n", crate::xml::escape(d)))
            .collect();
        new_xml.insert_str(os_end, &boot_xml);
    }

    // Redefine domain
    virt::domain::Domain::define_xml(conn, &new_xml)
        .map_err(|e| LibvirtError::Operation(format!("Failed to set boot order: {e}")))?;

    Ok(())
}
