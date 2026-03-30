use virt::connect::Connect;
use virt::domain::Domain;

use crate::state::{DiskInfo, InterfaceInfo, VmDetails, VmInfo};
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

fn state_to_string(state: u32) -> String {
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
    let domain = lookup_domain(conn, name)?;
    domain
        .get_xml_desc(0)
        .map_err(LibvirtError::map_op("Failed to get XML"))
}

fn domain_action(conn: &Connect, name: &str, action: &str, f: impl FnOnce(&Domain) -> Result<(), virt::error::Error>) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    f(&domain).map_err(|e| LibvirtError::Operation(format!("Failed to {action} VM '{name}': {e}")))
}

pub fn start_vm(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    domain_action(conn, name, "start", |d| d.create().map(|_| ()))
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

pub fn delete_vm(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, name)?;

    let info = domain.get_info().ok();
    if let Some(info) = info {
        if info.state == VIR_DOMAIN_RUNNING {
            let _ = domain.destroy();
        }
    }

    domain
        .undefine()
        .map_err(|e| LibvirtError::Operation(format!("Failed to delete VM '{name}': {e}")))?;

    Ok(())
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
        let mac = xml::extract_attr(&iface_block, "mac", "address")
            .unwrap_or_else(crate::unknown_string);
        let source = xml::extract_attr(&iface_block, "source", "network")
            .or_else(|| xml::extract_attr(&iface_block, "source", "bridge"))
            .unwrap_or_else(crate::unknown_string);
        let model = xml::extract_attr(&iface_block, "model", "type")
            .unwrap_or_else(crate::unknown_string);
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
        let device = xml::extract_attr(&disk_block, "disk", "device")
            .unwrap_or_else(|| "disk".to_string());
        let source = xml::extract_attr(&disk_block, "source", "file")
            .or_else(|| xml::extract_attr(&disk_block, "source", "dev"))
            .or_else(|| xml::extract_attr(&disk_block, "source", "volume"))
            .unwrap_or_else(crate::unknown_string);
        let driver = xml::extract_attr(&disk_block, "driver", "type")
            .unwrap_or_else(crate::unknown_string);
        let target = xml::extract_attr(&disk_block, "target", "dev")
            .unwrap_or_else(crate::unknown_string);
        disks.push(DiskInfo {
            device,
            source,
            driver,
            target,
        });
    }
    disks
}
