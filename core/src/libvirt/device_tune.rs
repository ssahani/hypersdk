//! Update existing disk / NIC / video devices (bus, cache, model, …).

use virt::connect::Connect;

use super::device::get_domain_flags;
use super::domain::lookup_domain;
use crate::xml::{self, split_blocks};
use crate::LibvirtError;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DiskTuneRequest {
    pub target: String,
    #[serde(default)]
    pub bus: Option<String>,
    #[serde(default)]
    pub cache: Option<String>,
    #[serde(default)]
    pub discard: Option<String>,
    #[serde(default)]
    pub readonly: Option<bool>,
    #[serde(default)]
    pub shareable: Option<bool>,
}

fn replace_driver_element(block: &str, new_driver: &str) -> String {
    if let Some(start) = block.find("<driver") {
        let rest = &block[start..];
        if let Some(off) = rest.find("/>") {
            let end = start + off + 2;
            return format!("{}{}{}", &block[..start], new_driver, &block[end..]);
        }
        if let Some(off) = rest.find("</driver>") {
            let end = start + off + "</driver>".len();
            return format!("{}{}{}", &block[..start], new_driver, &block[end..]);
        }
    }
    // Insert after first line (opening <disk ...>)
    if let Some(gt) = block.find('>') {
        format!("{}{}{}", &block[..=gt], new_driver, &block[gt + 1..])
    } else {
        format!("{new_driver}{block}")
    }
}

fn set_disk_readonly_shareable(mut block: String, readonly: Option<bool>, shareable: Option<bool>) -> String {
    if let Some(ro) = readonly {
        if ro {
            if !block.contains("<readonly") {
                if let Some(pos) = block.rfind("</disk>") {
                    block.insert_str(pos, "    <readonly/>\n");
                }
            }
        } else {
            while let Some(i) = block.find("<readonly") {
                if let Some(j) = block[i..].find("/>") {
                    block.replace_range(i..i + j + 2, "");
                } else if let Some(j) = block[i..].find("</readonly>") {
                    block.replace_range(i..i + j + "</readonly>".len(), "");
                } else {
                    break;
                }
            }
        }
    }
    if let Some(sh) = shareable {
        if sh {
            if !block.contains("shareable='") && !block.contains("shareable=\"") {
                if let Some(p) = block.find("<disk") {
                    if let Some(gt) = block[p..].find('>') {
                        let ins = p + gt;
                        block.insert_str(ins, " shareable='yes'");
                    }
                }
            }
        } else {
            block = block.replace(" shareable='yes'", "").replace(" shareable=\"yes\"", "");
        }
    }
    block
}

fn set_target_bus_on_block(block: &str, target_dev: &str, bus: &str) -> Result<String, LibvirtError> {
    let needle1 = format!("dev='{target_dev}'");
    let needle2 = format!("dev=\"{target_dev}\"");
    let idx = block
        .find(&needle1)
        .or_else(|| block.find(&needle2))
        .ok_or_else(|| LibvirtError::NotFound(format!("target dev '{target_dev}' not in disk block")))?;
    let before = &block[..idx];
    let tstart = before
        .rfind("<target")
        .ok_or_else(|| LibvirtError::Operation("target tag parse".into()))?;
    let tag_src = &block[tstart..];
    let tag_end_rel = tag_src
        .find("/>")
        .map(|i| i + 2)
        .or_else(|| tag_src.find("</target>").map(|i| i + "</target>".len()))
        .ok_or_else(|| LibvirtError::Operation("target end".into()))?;
    let tag = &tag_src[..tag_end_rel];
    let tag_end_abs = tstart + tag_end_rel;
    let mut new_tag = tag.to_string();
    for pat in [
        " bus='virtio'",
        " bus=\"virtio\"",
        " bus='sata'",
        " bus=\"sata\"",
        " bus='scsi'",
        " bus=\"scsi\"",
        " bus='ide'",
        " bus=\"ide\"",
    ] {
        new_tag = new_tag.replace(pat, "");
    }
    if new_tag.ends_with("/>") {
        new_tag.insert_str(new_tag.len() - 2, &format!(" bus='{}'", xml::escape(bus)));
    } else {
        return Err(LibvirtError::Operation(
            "Expected self-closing <target .../> for disk".into(),
        ));
    }
    Ok(format!(
        "{}{}{}",
        &block[..tstart],
        new_tag,
        &block[tag_end_abs..]
    ))
}

/// Update disk `<driver>` / `<target bus>` / readonly / shareable for `target` dev (e.g. vda).
pub fn update_disk_tune(conn: &Connect, vm_name: &str, tune: &DiskTuneRequest) -> Result<(), LibvirtError> {
    crate::validate::validate_name(vm_name)?;
    let domain = lookup_domain(conn, vm_name)?;
    let desc = domain
        .get_xml_desc(0)
        .map_err(LibvirtError::map_op("get_xml"))?;

    let mut found: Option<String> = None;
    for block in split_blocks(&desc, "disk") {
        if xml::extract_attr(&block, "target", "dev").as_deref() == Some(tune.target.as_str()) {
            let driver_type = xml::extract_attr(&block, "driver", "type").unwrap_or_else(|| "qcow2".to_string());
            let mut parts = vec![
                "name='qemu'".to_string(),
                format!("type='{}'", xml::escape(&driver_type)),
            ];
            if let Some(ref c) = tune.cache {
                parts.push(format!("cache='{}'", xml::escape(c)));
            }
            if let Some(ref d) = tune.discard {
                parts.push(format!("discard='{}'", xml::escape(d)));
            }
            let new_driver = format!("<driver {} />", parts.join(" "));
            let mut nb = replace_driver_element(&block, &new_driver);
            if let Some(ref b) = tune.bus {
                nb = set_target_bus_on_block(&nb, &tune.target, b)?;
            }
            nb = set_disk_readonly_shareable(nb, tune.readonly, tune.shareable);
            found = Some(nb);
            break;
        }
    }
    let frag = found.ok_or_else(|| LibvirtError::NotFound(format!("No disk with target '{}'", tune.target)))?;
    let flags = get_domain_flags(&domain);
    domain
        .update_device_flags(&frag, flags)
        .map_err(|e| LibvirtError::Operation(format!("update_disk_tune: {e}")))?;
    Ok(())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct NicTuneRequest {
    pub mac_address: String,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub network: Option<String>,
}

pub fn update_nic_tune(conn: &Connect, vm_name: &str, tune: &NicTuneRequest) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, vm_name)?;
    let desc = domain
        .get_xml_desc(0)
        .map_err(LibvirtError::map_op("get_xml"))?;
    let mac = tune.mac_address.to_ascii_lowercase();
    let mut found: Option<String> = None;
    for block in split_blocks(&desc, "interface") {
        let m = xml::extract_attr(&block, "mac", "address").unwrap_or_default().to_ascii_lowercase();
        if m == mac {
            let mut nb = block.clone();
            if let Some(ref model) = tune.model {
                if let Some(start) = nb.find("<model") {
                    if let Some(rest) = nb[start..].find("/>") {
                        let end = start + rest + 2;
                        nb.replace_range(
                            start..end,
                            &format!("<model type='{}'/>", xml::escape(model)),
                        );
                    }
                }
            }
            if let Some(ref net) = tune.network {
                if nb.contains("type='network'") || nb.contains("type=\"network\"") {
                    if let Some(start) = nb.find("<source") {
                        if let Some(rest) = nb[start..].find("/>") {
                            let end = start + rest + 2;
                            nb.replace_range(
                                start..end,
                                &format!("<source network='{}'/>", xml::escape(net)),
                            );
                        }
                    }
                }
            }
            found = Some(nb);
            break;
        }
    }
    let frag = found.ok_or_else(|| LibvirtError::NotFound(format!("No NIC with MAC '{}'", tune.mac_address)))?;
    let flags = get_domain_flags(&domain);
    domain
        .update_device_flags(&frag, flags)
        .map_err(|e| LibvirtError::Operation(format!("update_nic_tune: {e}")))?;
    Ok(())
}

const VIDEO_MODELS: &[&str] = &["virtio", "qxl", "vga", "bochs", "cirrus", "none"];

/// Set the primary `<video><model type='…'/></video>`.
pub fn set_video_model(conn: &Connect, vm_name: &str, model: &str) -> Result<(), LibvirtError> {
    if !VIDEO_MODELS.contains(&model) {
        return Err(LibvirtError::Invalid(format!(
            "video model must be one of: {}",
            VIDEO_MODELS.join(", ")
        )));
    }
    let domain = lookup_domain(conn, vm_name)?;
    let desc = domain
        .get_xml_desc(0)
        .map_err(LibvirtError::map_op("get_xml"))?;
    let blocks = split_blocks(&desc, "video");
    let Some(first) = blocks.first() else {
        return Err(LibvirtError::NotFound("No <video> in domain".into()));
    };
    let mut nb = first.clone();
    if let Some(start) = nb.find("<model") {
        if let Some(rest) = nb[start..].find("/>") {
            let end = start + rest + 2;
            nb.replace_range(
                start..end,
                &format!(
                    "<model type='{}' heads='1'/>",
                    xml::escape(model)
                ),
            );
        } else if let Some(rest) = nb[start..].find("</model>") {
            let end = start + rest + "</model>".len();
            nb.replace_range(
                start..end,
                &format!(
                    "<model type='{}' heads='1'></model>",
                    xml::escape(model)
                ),
            );
        }
    }
    let flags = get_domain_flags(&domain);
    domain
        .update_device_flags(&nb, flags)
        .map_err(|e| LibvirtError::Operation(format!("set_video_model: {e}")))?;
    Ok(())
}
