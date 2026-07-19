// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

use virt::connect::Connect;

use super::domain::lookup_domain;
use crate::LibvirtError;

#[allow(clippy::too_many_lines)]
/// Insert (or swap) CD-ROM media.
///
/// `target` may be empty, in which case a free target is chosen for the domain's
/// bus — the caller almost never has a reason to care which one it is.
pub fn insert_cdrom(
    conn: &Connect,
    name: &str,
    iso_path: &str,
    target: &str,
) -> Result<CdromInsertOutcome, LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    let conn_ref = conn;

    // Validate ISO path: must be absolute and resolve to a real path (no symlink escapes)
    let path = std::path::Path::new(iso_path);
    if !path.is_absolute() {
        return Err(LibvirtError::Invalid(
            "ISO path must be absolute".to_string(),
        ));
    }
    if !path.exists() {
        return Err(LibvirtError::Operation(format!(
            "ISO file not found: {iso_path}"
        )));
    }
    let resolved = path
        .canonicalize()
        .map_err(|_| LibvirtError::Operation(format!("Failed to resolve ISO path: {iso_path}")))?;
    if !resolved.is_file() {
        return Err(LibvirtError::Operation(format!(
            "ISO path is not a file: {iso_path}"
        )));
    }

    let flags = get_update_flags(&domain);

    let vm_xml = domain.get_xml_desc(0).unwrap_or_default();
    let default_bus = detect_best_bus(&vm_xml);
    // An empty target means "wherever it fits" — see pick_free_cdrom_target.
    let target: String = if target.trim().is_empty() {
        pick_free_cdrom_target(&vm_xml, default_bus)?
    } else {
        target.trim().to_string()
    };
    let target = target.as_str();

    // Check if a cdrom device already exists at this target
    let (has_cdrom, existing_bus) = find_cdrom_device(&vm_xml, target);

    if has_cdrom {
        // Update existing cdrom device — use same bus type
        let bus = existing_bus.unwrap_or_else(|| "sata".to_string());
        let xml = format!(
            r#"<disk type='file' device='cdrom'>
  <driver name='qemu' type='raw'/>
  <source file='{}'/>
  <target dev='{}' bus='{}'/>
  <readonly/>
</disk>"#,
            crate::xml::escape(iso_path),
            crate::xml::escape(target),
            crate::xml::escape(&bus),
        );
        domain
            .update_device_flags(&xml, flags)
            .map_err(|e| LibvirtError::Operation(format!("Failed to update CD-ROM: {e}")))?;
        let live = flags & virt::sys::VIR_DOMAIN_AFFECT_LIVE != 0;
        return Ok(CdromInsertOutcome {
            target: target.to_string(),
            bus,
            live,
            requires_restart: false,
        });
    } else {
        // No cdrom exists — attach new device. Detect bus type from VM.
        let bus = detect_best_bus(&vm_xml);
        let xml = format!(
            r#"<disk type='file' device='cdrom'>
  <driver name='qemu' type='raw'/>
  <source file='{}'/>
  <target dev='{}' bus='{}'/>
  <readonly/>
</disk>"#,
            crate::xml::escape(iso_path),
            crate::xml::escape(target),
            bus,
        );

        // For shutoff VMs, we can redefine with the cdrom; for running VMs, use attach
        let info = domain.get_info().ok();
        let is_running = info.as_ref().map(|i| i.state == 1).unwrap_or(false);

        if is_running {
            // Try live+config first. SATA can't be hotplugged — fall back to config-only
            // so the drive appears on next boot without failing the whole operation.
            let live_result = domain.attach_device_flags(
                &xml,
                virt::sys::VIR_DOMAIN_AFFECT_LIVE | virt::sys::VIR_DOMAIN_AFFECT_CONFIG,
            );
            if live_result.is_err() {
                domain
                    .attach_device_flags(&xml, virt::sys::VIR_DOMAIN_AFFECT_CONFIG)
                    .map_err(|e| {
                        LibvirtError::Operation(format!(
                            "Failed to attach CD-ROM (stop the VM to hot-attach SATA): {e}"
                        ))
                    })?;
                // Staged only — the guest cannot see this media until it reboots.
                return Ok(CdromInsertOutcome {
                    target: target.to_string(),
                    bus: bus.to_string(),
                    live: false,
                    requires_restart: true,
                });
            }
            return Ok(CdromInsertOutcome {
                target: target.to_string(),
                bus: bus.to_string(),
                live: true,
                requires_restart: false,
            });
        } else {
            // For shutoff VMs — insert cdrom into XML definition
            let new_xml = insert_cdrom_into_xml(&vm_xml, &xml);
            virt::domain::Domain::define_xml(conn_ref, &new_xml).map_err(|e| {
                LibvirtError::Operation(format!("Failed to define VM with CD-ROM: {e}"))
            })?;
            return Ok(CdromInsertOutcome {
                target: target.to_string(),
                bus: bus.to_string(),
                // A stopped guest sees the media the moment it starts.
                live: false,
                requires_restart: false,
            });
        }
    }
}

pub fn eject_cdrom(conn: &Connect, name: &str, target: &str) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    let vm_xml = domain.get_xml_desc(0).unwrap_or_default();
    let (has_cdrom, existing_bus) = find_cdrom_device(&vm_xml, target);

    if !has_cdrom {
        return Err(LibvirtError::NotFound(format!(
            "No CD-ROM device at target '{target}'"
        )));
    }

    let bus = existing_bus.unwrap_or_else(|| "sata".to_string());
    let xml = format!(
        r#"<disk type='file' device='cdrom'>
  <target dev='{}' bus='{}'/>
  <readonly/>
</disk>"#,
        crate::xml::escape(target),
        crate::xml::escape(&bus),
    );

    let flags = get_update_flags(&domain);
    domain
        .update_device_flags(&xml, flags)
        .map_err(|e| LibvirtError::Operation(format!("Failed to eject CD-ROM: {e}")))?;

    Ok(())
}

/// Remove the CD-ROM *drive* entirely, not just its media.
///
/// `eject_cdrom` only blanks the media and leaves the device behind, so a
/// mistakenly-added drive could previously only be removed with `virsh
/// detach-disk` on the hypervisor.
pub fn detach_cdrom(conn: &Connect, name: &str, target: &str) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    let vm_xml = domain.get_xml_desc(0).unwrap_or_default();
    let (has_cdrom, existing_bus) = find_cdrom_device(&vm_xml, target);
    if !has_cdrom {
        return Err(LibvirtError::NotFound(format!(
            "No CD-ROM device at target '{target}'"
        )));
    }
    let bus = existing_bus.unwrap_or_else(|| "sata".to_string());
    let xml = format!(
        r#"<disk type='file' device='cdrom'>
  <target dev='{}' bus='{}'/>
  <readonly/>
</disk>"#,
        crate::xml::escape(target),
        crate::xml::escape(&bus),
    );
    // Live+config where possible; SATA cannot hot-detach, so fall back to config
    // so the drive is gone on next boot rather than failing outright.
    let both = virt::sys::VIR_DOMAIN_AFFECT_LIVE | virt::sys::VIR_DOMAIN_AFFECT_CONFIG;
    if domain.detach_device_flags(&xml, both).is_err() {
        domain
            .detach_device_flags(&xml, virt::sys::VIR_DOMAIN_AFFECT_CONFIG)
            .map_err(|e| {
                LibvirtError::Operation(format!("Failed to detach CD-ROM at {target}: {e}"))
            })?;
    }
    Ok(())
}

/// Find a cdrom device at the given target, return (exists, bus_type).
fn find_cdrom_device(xml: &str, target: &str) -> (bool, Option<String>) {
    for block in crate::xml::split_blocks(xml, "disk") {
        let device = crate::xml::extract_attr(&block, "disk", "device").unwrap_or_default();
        if device == "cdrom" {
            let dev = crate::xml::extract_attr(&block, "target", "dev").unwrap_or_default();
            if dev == target || target.is_empty() {
                let bus = crate::xml::extract_attr(&block, "target", "bus");
                return (true, bus);
            }
        }
    }
    (false, None)
}

/// Detect the best bus type for a new cdrom based on VM's existing controllers.
/// All target names already claimed by a disk or CD-ROM in this domain.
fn used_targets(xml: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut rest = xml;
    while let Some(i) = rest.find("target dev=") {
        rest = &rest[i + "target dev=".len()..];
        let Some(quote) = rest.chars().next() else {
            break;
        };
        if quote != '\'' && quote != '"' {
            continue;
        }
        if let Some(end) = rest[1..].find(quote) {
            out.push(rest[1..=end].to_string());
            rest = &rest[end + 1..];
        }
    }
    out
}

/// Pick a free CD-ROM target for `bus`, avoiding every device already attached.
///
/// The old fixed default of `sda` collided with the root disk on essentially
/// every SATA guest — the common case for Windows — and libvirt rejected the
/// attach with "target sda already exists".
pub fn pick_free_cdrom_target(vm_xml: &str, bus: &str) -> Result<String, LibvirtError> {
    let prefix = match bus {
        "ide" => "hd",
        "virtio" => "vd",
        // sata and scsi both present as sd*
        _ => "sd",
    };
    let used = used_targets(vm_xml);
    for suffix in b'a'..=b'z' {
        let candidate = format!("{prefix}{}", suffix as char);
        if !used.iter().any(|u| u == &candidate) {
            return Ok(candidate);
        }
    }
    Err(LibvirtError::Operation(format!(
        "no free {prefix}* target available for a CD-ROM on this VM"
    )))
}

/// Where the media actually landed. A SATA CD-ROM cannot be hot-attached, so a
/// running guest may only get it on next boot — the caller must be able to say
/// so rather than reporting a bare success the operator cannot see in the guest.
#[derive(Debug, Clone, serde::Serialize)]
pub struct CdromInsertOutcome {
    pub target: String,
    pub bus: String,
    /// True when the media is visible to the running guest right now.
    pub live: bool,
    /// True when the guest must be restarted before the media appears.
    pub requires_restart: bool,
}

fn detect_best_bus(xml: &str) -> &'static str {
    // Check for SATA controller
    if xml.contains("type='sata'") || xml.contains("type=\"sata\"") {
        return "sata";
    }
    // Check for SCSI controller
    if xml.contains("type='scsi'") || xml.contains("type=\"scsi\"") {
        return "scsi";
    }
    // Check for IDE controller (legacy)
    if xml.contains("type='ide'") || xml.contains("type=\"ide\"") {
        return "ide";
    }
    // Default: SATA works on q35 machines (most modern VMs)
    "sata"
}

/// Insert a cdrom disk XML into the VM's devices section.
fn insert_cdrom_into_xml(vm_xml: &str, cdrom_xml: &str) -> String {
    // Insert before </devices>
    if let Some(pos) = vm_xml.rfind("</devices>") {
        let mut result = vm_xml[..pos].to_string();
        result.push_str("    ");
        result.push_str(cdrom_xml);
        result.push('\n');
        result.push_str("  ");
        result.push_str(&vm_xml[pos..]);
        result
    } else {
        vm_xml.to_string()
    }
}

fn get_update_flags(domain: &virt::domain::Domain) -> u32 {
    domain
        .get_info()
        .map(|info| {
            if info.state == 1
            /* VIR_DOMAIN_RUNNING */
            {
                virt::sys::VIR_DOMAIN_AFFECT_LIVE | virt::sys::VIR_DOMAIN_AFFECT_CONFIG
            } else {
                virt::sys::VIR_DOMAIN_AFFECT_CONFIG
            }
        })
        .unwrap_or(virt::sys::VIR_DOMAIN_AFFECT_CONFIG)
}

#[cfg(test)]
mod tests {
    use super::*;

    const WINDOWS_SATA_VM: &str = r#"<domain>
      <devices>
        <disk type='file' device='disk'>
          <source file='/var/lib/libvirt/images/win10.qcow2'/>
          <target dev='sda' bus='sata'/>
        </disk>
        <controller type='sata' index='0'/>
        <interface type='network'><target dev='vnet3'/></interface>
      </devices>
    </domain>"#;

    #[test]
    fn skips_the_root_disk_instead_of_colliding_on_sda() {
        // The bug: a fixed "sda" default made libvirt reject every attach with
        // "target sda already exists" on SATA guests — i.e. most Windows VMs.
        let t = pick_free_cdrom_target(WINDOWS_SATA_VM, "sata").unwrap();
        assert_eq!(t, "sdb");
    }

    #[test]
    fn skips_every_target_already_in_use() {
        let xml = r#"<domain><devices>
            <disk device='disk'><target dev='sda' bus='sata'/></disk>
            <disk device='cdrom'><target dev='sdb' bus='sata'/></disk>
            <disk device='cdrom'><target dev='sdc' bus='sata'/></disk>
        </devices></domain>"#;
        assert_eq!(pick_free_cdrom_target(xml, "sata").unwrap(), "sdd");
    }

    #[test]
    fn uses_the_right_prefix_per_bus() {
        let empty = "<domain><devices/></domain>";
        assert_eq!(pick_free_cdrom_target(empty, "sata").unwrap(), "sda");
        assert_eq!(pick_free_cdrom_target(empty, "ide").unwrap(), "hda");
        assert_eq!(pick_free_cdrom_target(empty, "virtio").unwrap(), "vda");
        // The NIC's <target dev='vnet3'/> must not be mistaken for a disk target.
        assert_eq!(pick_free_cdrom_target(WINDOWS_SATA_VM, "virtio").unwrap(), "vda");
    }

    #[test]
    fn used_targets_reads_both_quote_styles() {
        let xml = r#"<disk><target dev='sda'/></disk><disk><target dev="sdb"/></disk>"#;
        let used = used_targets(xml);
        assert!(used.contains(&"sda".to_string()));
        assert!(used.contains(&"sdb".to_string()));
    }
}
