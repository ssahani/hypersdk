// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

use std::path::Path;

use tracing::warn;
use virt::connect::Connect;
use virt::domain::Domain;
use virt::sys;

use crate::libvirt::guest_agent::get_guest_interfaces;
use crate::state::{DiskInfo, FilesystemInfo, InterfaceInfo, VmDetails, VmInfo};
use crate::xml;
use crate::LibvirtError;

// libvirt domain state constants
const VIR_DOMAIN_NOSTATE: u32 = 0;
const VIR_DOMAIN_RUNNING: u32 = 1;
const VIR_DOMAIN_BLOCKED: u32 = 2;
const VIR_DOMAIN_PAUSED: u32 = 3;
const VIR_DOMAIN_SHUTDOWN: u32 = 4;
const VIR_DOMAIN_SHUTOFF: u32 = 5;
const VIR_DOMAIN_CRASHED: u32 = 6;
const VIR_DOMAIN_PMSUSPENDED: u32 = 7;

pub(crate) fn state_to_string(state: u32) -> String {
    match state {
        VIR_DOMAIN_NOSTATE => "no state".to_string(),
        VIR_DOMAIN_RUNNING => "running".to_string(),
        VIR_DOMAIN_BLOCKED => "blocked".to_string(),
        VIR_DOMAIN_PAUSED => "paused".to_string(),
        VIR_DOMAIN_SHUTDOWN => "shutting down".to_string(),
        VIR_DOMAIN_SHUTOFF => "shutoff".to_string(),
        VIR_DOMAIN_CRASHED => "crashed".to_string(),
        VIR_DOMAIN_PMSUSPENDED => "suspended".to_string(),
        _ => format!("unknown ({state})"),
    }
}

pub fn lookup_domain(conn: &Connect, name: &str) -> Result<Domain, LibvirtError> {
    Domain::lookup_by_name(conn, name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{name}' not found: {e}")))
}

pub fn list_vms(conn: &Connect) -> Result<Vec<VmInfo>, LibvirtError> {
    let domains = conn
        .list_all_domains(0)
        .map_err(LibvirtError::map_op("Failed to list domains"))?;

    let mut vms = Vec::new();
    for domain in domains {
        let name = domain
            .get_name()
            .map_err(LibvirtError::map_op("Failed to get domain name"))?;

        let info = domain
            .get_info()
            .map_err(LibvirtError::map_op("Failed to get domain info"))?;

        vms.push(VmInfo {
            name,
            state: state_to_string(info.state),
            vcpus: info.nr_virt_cpu,
            memory_mb: info.memory / 1024,
            libvirt_connection: None,
        });
    }

    Ok(vms)
}

pub fn get_vm_details(conn: &Connect, name: &str) -> Result<VmDetails, LibvirtError> {
    let domain = lookup_domain(conn, name)?;

    let info = domain
        .get_info()
        .map_err(LibvirtError::map_op("Failed to get domain info"))?;

    let uuid = domain
        .get_uuid_string()
        .map_err(LibvirtError::map_op("Failed to get UUID"))?;

    let xml_str = domain
        .get_xml_desc(0)
        .map_err(LibvirtError::map_op("Failed to get XML"))?;

    let autostart = domain.get_autostart().unwrap_or(false);
    let persistent = domain.is_persistent().unwrap_or(false);

    let (os_type, arch) = parse_os_info(&xml_str);
    let interfaces = parse_interfaces(&xml_str);
    let disks = parse_disks(&xml_str);
    let filesystems = parse_filesystems(&xml_str);
    let guest_ip = get_guest_interfaces(conn, name)
        .ok()
        .and_then(|addrs| {
            addrs
                .iter()
                .find(|a| a.ip_type == "ipv4" && !a.address.starts_with("127."))
                .map(|a| a.address.clone())
        });

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
        filesystems,
        libvirt_connection: None,
        guest_ip,
    })
}

fn parse_filesystems(xml_str: &str) -> Vec<FilesystemInfo> {
    let mut out = Vec::new();
    for block in crate::xml::split_blocks(xml_str, "filesystem") {
        // Only surface the common host-dir share case.
        let fstype = crate::xml::extract_attr(&block, "filesystem", "type").unwrap_or_default();
        if fstype != "mount" {
            continue;
        }
        let src = crate::xml::extract_attr(&block, "source", "dir").unwrap_or_default();
        let tag = crate::xml::extract_attr(&block, "target", "dir").unwrap_or_default();
        if src.is_empty() && tag.is_empty() {
            continue;
        }
        let accessmode =
            crate::xml::extract_attr(&block, "filesystem", "accessmode").unwrap_or_default();
        let driver = crate::xml::extract_attr(&block, "driver", "type").unwrap_or_default();
        let xattr = crate::xml::extract_attr(&block, "binary", "xattr")
            .map(|v| v.eq_ignore_ascii_case("on") || v == "1" || v.eq_ignore_ascii_case("yes"))
            .unwrap_or(false);
        out.push(FilesystemInfo {
            source: src,
            mount_tag: tag,
            driver,
            accessmode,
            xattr,
        });
    }
    out
}

pub fn get_vm_xml(conn: &Connect, name: &str) -> Result<String, LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    domain
        .get_xml_desc(0)
        .map_err(LibvirtError::map_op("Failed to get XML"))
}

fn domain_action(
    conn: &Connect,
    name: &str,
    action: &str,
    f: impl FnOnce(&Domain) -> Result<(), virt::error::Error>,
) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    f(&domain).map_err(|e| LibvirtError::Operation(format!("Failed to {action} VM '{name}': {e}")))
}

/// File-backed `disk` sources in domain XML that are not regular files on the host (missing or not a file).
pub fn missing_file_disk_paths(conn: &Connect, name: &str) -> Result<Vec<String>, LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    let xml = domain
        .get_xml_desc(0)
        .map_err(LibvirtError::map_op("get_xml"))?;
    let missing: Vec<String> = collect_disk_paths(&xml)
        .into_iter()
        .filter(|p| !Path::new(p).is_file())
        .collect();
    Ok(missing)
}

pub fn start_vm(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    let xml = domain
        .get_xml_desc(0)
        .map_err(LibvirtError::map_op("get_xml"))?;

    let missing: Vec<String> = collect_disk_paths(&xml)
        .into_iter()
        .filter(|p| !Path::new(p).is_file())
        .collect();
    if !missing.is_empty() {
        return Err(LibvirtError::Invalid(format!(
            "Cannot start VM '{name}': disk image file(s) missing on host (create the image or fix paths before start): {}",
            missing.join(", ")
        )));
    }

    for net_name in crate::libvirt::net_xml::network_names_from_domain_xml(&xml) {
        crate::libvirt::network::ensure_network_active(conn, &net_name)?;
    }

    domain
        .create()
        .map(|_| ())
        .map_err(|e| LibvirtError::Operation(format!("Failed to start VM '{name}': {e}")))
}

pub fn stop_vm(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    domain_action(conn, name, "stop", |d| d.destroy().map(|_| ()))
}

pub fn shutdown_vm(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    domain_action(conn, name, "shutdown", |d| d.shutdown().map(|_| ()))
}

pub fn reboot_vm(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    domain_action(conn, name, "reboot", |d| d.reboot(0).map(|_| ()))
}

pub fn pause_vm(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    domain_action(conn, name, "pause", |d| d.suspend().map(|_| ()))
}

pub fn resume_vm(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    domain_action(conn, name, "resume", |d| d.resume().map(|_| ()))
}

/// Optional `virDomainUndefineFlags` bits when removing a persistent domain definition.
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct UndefineOptions {
    #[serde(default)]
    pub managed_save: bool,
    #[serde(default)]
    pub snapshots_metadata: bool,
    #[serde(default)]
    pub nvram: bool,
    #[serde(default)]
    pub keep_nvram: bool,
    #[serde(default)]
    pub checkpoints_metadata: bool,
    #[serde(default)]
    pub tpm: bool,
    #[serde(default)]
    pub keep_tpm: bool,
    /// Delete backing disk image files (only `device='disk'` sources) after undefining.
    #[serde(default)]
    pub delete_disks: bool,
}

impl UndefineOptions {
    /// Build libvirt undefine flags; returns error on contradictory options.
    pub fn to_libvirt_flags(&self) -> Result<sys::virDomainUndefineFlagsValues, LibvirtError> {
        if self.nvram && self.keep_nvram {
            return Err(LibvirtError::Invalid(
                "undefine: nvram and keep_nvram are mutually exclusive".into(),
            ));
        }
        if self.tpm && self.keep_tpm {
            return Err(LibvirtError::Invalid(
                "undefine: tpm and keep_tpm are mutually exclusive".into(),
            ));
        }
        let mut f: u32 = 0;
        if self.managed_save {
            f |= sys::VIR_DOMAIN_UNDEFINE_MANAGED_SAVE;
        }
        if self.snapshots_metadata {
            f |= sys::VIR_DOMAIN_UNDEFINE_SNAPSHOTS_METADATA;
        }
        if self.nvram {
            f |= sys::VIR_DOMAIN_UNDEFINE_NVRAM;
        }
        if self.keep_nvram {
            f |= sys::VIR_DOMAIN_UNDEFINE_KEEP_NVRAM;
        }
        if self.checkpoints_metadata {
            f |= sys::VIR_DOMAIN_UNDEFINE_CHECKPOINTS_METADATA;
        }
        if self.tpm {
            f |= sys::VIR_DOMAIN_UNDEFINE_TPM;
        }
        if self.keep_tpm {
            f |= sys::VIR_DOMAIN_UNDEFINE_KEEP_TPM;
        }
        Ok(f as sys::virDomainUndefineFlagsValues)
    }
}

/// Undefine persistent domain XML.
///
/// Always adds safe auto-cleanup base flags so that VMs with snapshot metadata, managed-save
/// images, or checkpoint metadata don't silently block deletion. User-supplied flags are OR'd
/// on top. If `undefine_flags` still fails (e.g. NVRAM file already gone), we retry without
/// the optional file-removal flags so the domain record is always dropped.
fn undefine_persistent(domain: &Domain, name: &str, user_flags: u32) -> Result<(), LibvirtError> {
    // These are always safe: remove snapshot/checkpoint/managed-save metadata on delete.
    let base: u32 = sys::VIR_DOMAIN_UNDEFINE_SNAPSHOTS_METADATA
        | sys::VIR_DOMAIN_UNDEFINE_MANAGED_SAVE
        | sys::VIR_DOMAIN_UNDEFINE_CHECKPOINTS_METADATA;
    let flags = user_flags | base;
    let nvram_flag = sys::VIR_DOMAIN_UNDEFINE_NVRAM as u32;
    let nvram_requested = (user_flags & nvram_flag) != 0;

    match domain.undefine_flags(flags as sys::virDomainUndefineFlagsValues) {
        Ok(()) => Ok(()),
        Err(e) => {
            let first = format!("{e}");
            if !nvram_requested && first.to_lowercase().contains("nvram") {
                return Err(LibvirtError::Invalid(format!(
                    "Libvirt refused to remove this domain (UEFI NVRAM). Enable 'Remove NVRAM / var file' in advanced delete, or call the API with undefine_nvram=true (same as: virsh undefine {name} --nvram). Original error: {first}"
                )));
            }
            warn!(
                "undefine_flags failed for VM '{name}' (flags={flags:#x}), retrying with base flags only: {first}"
            );
            // Retry with just the safe base flags (drops user NVRAM/TPM file-removal bits
            // that may fail if those files no longer exist).
            domain
                .undefine_flags(base as sys::virDomainUndefineFlagsValues)
                .or_else(|_| domain.undefine())
                .map_err(|e2| {
                    LibvirtError::Operation(format!(
                        "Failed to delete VM '{name}' (first: {first}; retry: {e2})"
                    ))
                })
        }
    }
}

pub fn delete_vm(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    delete_vm_with_options(conn, name, &UndefineOptions::default())
}

/// Collect file-backed disk paths (`device='disk'`) from domain XML.
/// CDROMs and non-file sources are intentionally excluded.
pub(crate) fn collect_disk_paths(xml: &str) -> Vec<String> {
    let mut paths = Vec::new();
    for block in xml::split_blocks(xml, "disk") {
        let device = xml::extract_attr(&block, "disk", "device").unwrap_or_default();
        if device != "disk" {
            continue;
        }
        let disk_type = xml::extract_attr(&block, "disk", "type").unwrap_or_default();
        if disk_type != "file" {
            continue;
        }
        if let Some(file) = xml::extract_attr(&block, "source", "file") {
            if !file.is_empty() {
                paths.push(file);
            }
        }
    }
    paths
}

/// Stop (if needed) and undefine a VM, optionally passing `virDomainUndefineFlags` bits.
pub fn delete_vm_with_options(
    conn: &Connect,
    name: &str,
    opts: &UndefineOptions,
) -> Result<(), LibvirtError> {
    let flags_u = opts.to_libvirt_flags()?;
    let flags: u32 = flags_u as u32;
    let domain = match lookup_domain(conn, name) {
        Ok(d) => d,
        Err(LibvirtError::NotFound(_)) => return Ok(()),
        Err(e) => return Err(e),
    };

    // Collect disk paths before we undefine (XML is gone after).
    let disk_paths: Vec<String> = if opts.delete_disks {
        domain
            .get_xml_desc(0)
            .map(|xml| collect_disk_paths(&xml))
            .unwrap_or_default()
    } else {
        Vec::new()
    };

    let info = domain
        .get_info()
        .map_err(|e| LibvirtError::Operation(format!("Failed to get VM '{name}' info: {e}")))?;
    let persistent = domain.is_persistent().unwrap_or(true);

    if info.state == VIR_DOMAIN_RUNNING || info.state == VIR_DOMAIN_PAUSED {
        domain
            .destroy()
            .map_err(|e| LibvirtError::Operation(format!("Failed to stop VM '{name}': {e}")))?;

        if !persistent {
            delete_disk_files(&disk_paths, name);
            return Ok(());
        }

        let domain = match lookup_domain(conn, name) {
            Ok(d) => d,
            Err(LibvirtError::NotFound(_)) => return Ok(()),
            Err(e) => return Err(e),
        };
        undefine_persistent(&domain, name, flags)?;
        delete_disk_files(&disk_paths, name);
        return Ok(());
    }

    undefine_persistent(&domain, name, flags)?;
    delete_disk_files(&disk_paths, name);
    Ok(())
}

/// Delete disk image files on the host filesystem, logging but not propagating individual errors.
fn delete_disk_files(paths: &[String], vm_name: &str) {
    for path in paths {
        match std::fs::remove_file(path) {
            Ok(()) => tracing::info!("Deleted disk image for VM '{vm_name}': {path}"),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                tracing::debug!("Disk image already gone for VM '{vm_name}': {path}");
            }
            Err(e) => {
                tracing::warn!("Could not delete disk image for VM '{vm_name}' at {path}: {e}");
            }
        }
    }
}

pub fn set_autostart(conn: &Connect, name: &str, autostart: bool) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    domain
        .set_autostart(autostart)
        .map_err(LibvirtError::map_op("Failed to set autostart"))?;
    Ok(())
}

pub fn rename_vm(conn: &Connect, name: &str, new_name: &str) -> Result<(), LibvirtError> {
    crate::validate::validate_name(new_name)?;

    let domain = lookup_domain(conn, name)?;

    // VM must be shutoff to rename
    let info = domain
        .get_info()
        .map_err(LibvirtError::map_op("Failed to get VM info"))?;

    if info.state != VIR_DOMAIN_SHUTOFF {
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

fn parse_os_info(xml_str: &str) -> (String, String) {
    let os_type = xml::extract_text(xml_str, "type").unwrap_or_else(crate::unknown_string);
    let arch = xml::extract_attr(xml_str, "type", "arch").unwrap_or_else(crate::unknown_string);
    (os_type, arch)
}

fn parse_interfaces(xml_str: &str) -> Vec<InterfaceInfo> {
    let mut interfaces = Vec::new();
    for iface_block in xml::split_blocks(xml_str, "interface") {
        let mac =
            xml::extract_attr(&iface_block, "mac", "address").unwrap_or_else(crate::unknown_string);
        let source = xml::extract_attr(&iface_block, "source", "network")
            .or_else(|| xml::extract_attr(&iface_block, "source", "bridge"))
            .unwrap_or_else(crate::unknown_string);
        let model =
            xml::extract_attr(&iface_block, "model", "type").unwrap_or_else(crate::unknown_string);
        interfaces.push(InterfaceInfo {
            mac_address: mac,
            source,
            model,
        });
    }
    interfaces
}

fn parse_disks(xml_str: &str) -> Vec<DiskInfo> {
    let mut disks = Vec::new();
    for disk_block in xml::split_blocks(xml_str, "disk") {
        let device =
            xml::extract_attr(&disk_block, "disk", "device").unwrap_or_else(|| "disk".to_string());
        let source = xml::extract_attr(&disk_block, "source", "file")
            .or_else(|| xml::extract_attr(&disk_block, "source", "dev"))
            .or_else(|| xml::extract_attr(&disk_block, "source", "volume"))
            .unwrap_or_else(crate::unknown_string);
        let driver =
            xml::extract_attr(&disk_block, "driver", "type").unwrap_or_else(crate::unknown_string);
        let target =
            xml::extract_attr(&disk_block, "target", "dev").unwrap_or_else(crate::unknown_string);
        let bus = xml::extract_attr(&disk_block, "target", "bus").unwrap_or_default();
        let cache = xml::extract_attr(&disk_block, "driver", "cache").unwrap_or_default();
        let readonly = disk_block.contains("<readonly");
        let shareable = xml::extract_attr(&disk_block, "disk", "shareable")
            .map(|s| s == "yes")
            .unwrap_or(false);
        disks.push(DiskInfo {
            device,
            source,
            driver,
            target,
            bus,
            cache,
            readonly,
            shareable,
        });
    }
    disks
}

#[cfg(test)]
mod tests {
    use super::UndefineOptions;

    #[test]
    fn undefine_options_rejects_nvram_conflict() {
        let o = UndefineOptions {
            nvram: true,
            keep_nvram: true,
            ..Default::default()
        };
        assert!(o.to_libvirt_flags().is_err());
    }
}
