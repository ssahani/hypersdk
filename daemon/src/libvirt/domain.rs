use virt::connect::Connect;
use virt::domain::Domain;

use crate::error::AppError;
use crate::models::VmInfo;

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

pub fn list_vms(conn: &Connect) -> Result<Vec<VmInfo>, AppError> {
    let domains = conn
        .list_all_domains(0)
        .map_err(|e| AppError::Libvirt(format!("Failed to list domains: {e}")))?;

    let mut vms = Vec::new();
    for domain in domains {
        let name = domain
            .get_name()
            .map_err(|e| AppError::Libvirt(format!("Failed to get domain name: {e}")))?;

        let info = domain
            .get_info()
            .map_err(|e| AppError::Libvirt(format!("Failed to get domain info: {e}")))?;

        vms.push(VmInfo {
            name,
            state: state_to_string(info.state as u32),
            vcpus: info.nr_virt_cpu,
            memory_mb: info.memory / 1024,
        });
    }

    Ok(vms)
}

pub fn start_vm(conn: &Connect, name: &str) -> Result<(), AppError> {
    let domain = Domain::lookup_by_name(conn, name)
        .map_err(|e| AppError::NotFound(format!("VM '{name}' not found: {e}")))?;

    domain
        .create()
        .map_err(|e| AppError::Libvirt(format!("Failed to start VM '{name}': {e}")))?;

    Ok(())
}

pub fn stop_vm(conn: &Connect, name: &str) -> Result<(), AppError> {
    let domain = Domain::lookup_by_name(conn, name)
        .map_err(|e| AppError::NotFound(format!("VM '{name}' not found: {e}")))?;

    domain
        .destroy()
        .map_err(|e| AppError::Libvirt(format!("Failed to stop VM '{name}': {e}")))?;

    Ok(())
}

pub fn delete_vm(conn: &Connect, name: &str) -> Result<(), AppError> {
    let domain = Domain::lookup_by_name(conn, name)
        .map_err(|e| AppError::NotFound(format!("VM '{name}' not found: {e}")))?;

    // Try to destroy first if running, ignore errors (might already be off)
    let info = domain.get_info().ok();
    if let Some(info) = info {
        if info.state as u32 == 1 {
            let _ = domain.destroy();
        }
    }

    domain
        .undefine()
        .map_err(|e| AppError::Libvirt(format!("Failed to delete VM '{name}': {e}")))?;

    Ok(())
}
