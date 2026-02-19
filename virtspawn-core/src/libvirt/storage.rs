use virt::connect::Connect;
use virt::storage_pool::StoragePool;
use virt::storage_vol::StorageVol;

use crate::state::{StoragePoolInfo, StorageVolumeInfo};
use crate::LibvirtError;

pub fn list_pools(conn: &Connect) -> Result<Vec<StoragePoolInfo>, LibvirtError> {
    let pools = conn
        .list_all_storage_pools(0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to list storage pools: {e}")))?;

    let mut result = Vec::new();
    for pool in pools {
        let name = pool
            .get_name()
            .map_err(|e| LibvirtError::Operation(format!("Failed to get pool name: {e}")))?;

        let uuid = pool.get_uuid_string().unwrap_or_else(|_| String::new());

        let info = pool.get_info().ok();
        let (state, capacity_gb, allocation_gb, available_gb) = match info {
            Some(i) => (
                pool_state_to_string(i.state as u32),
                i.capacity as f64 / (1024.0 * 1024.0 * 1024.0),
                i.allocation as f64 / (1024.0 * 1024.0 * 1024.0),
                i.available as f64 / (1024.0 * 1024.0 * 1024.0),
            ),
            None => ("unknown".to_string(), 0.0, 0.0, 0.0),
        };

        let autostart = pool.get_autostart().unwrap_or(false);

        result.push(StoragePoolInfo {
            name,
            uuid,
            state,
            capacity_gb,
            allocation_gb,
            available_gb,
            autostart,
        });
    }

    Ok(result)
}

pub fn list_volumes(conn: &Connect, pool_name: &str) -> Result<Vec<StorageVolumeInfo>, LibvirtError> {
    let pool = StoragePool::lookup_by_name(conn, pool_name)
        .map_err(|e| LibvirtError::NotFound(format!("Pool '{pool_name}' not found: {e}")))?;

    // Refresh pool to get current volume list
    let _ = pool.refresh(0);

    let vol_names = pool
        .list_all_volumes(0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to list volumes: {e}")))?;

    let mut result = Vec::new();
    for vol in vol_names {
        let name = vol
            .get_name()
            .map_err(|e| LibvirtError::Operation(format!("Failed to get volume name: {e}")))?;

        let path = vol.get_path().unwrap_or_else(|_| String::new());

        let info = vol.get_info().ok();
        let (vol_type, capacity_gb, allocation_gb) = match info {
            Some(i) => (
                vol_type_to_string(i.kind as u32),
                i.capacity as f64 / (1024.0 * 1024.0 * 1024.0),
                i.allocation as f64 / (1024.0 * 1024.0 * 1024.0),
            ),
            None => ("unknown".to_string(), 0.0, 0.0),
        };

        result.push(StorageVolumeInfo {
            name,
            pool: pool_name.to_string(),
            capacity_gb,
            allocation_gb,
            path,
            vol_type,
        });
    }

    Ok(result)
}

pub fn delete_volume(conn: &Connect, pool_name: &str, vol_name: &str) -> Result<(), LibvirtError> {
    let pool = StoragePool::lookup_by_name(conn, pool_name)
        .map_err(|e| LibvirtError::NotFound(format!("Pool '{pool_name}' not found: {e}")))?;

    let vol = StorageVol::lookup_by_name(&pool, vol_name)
        .map_err(|e| LibvirtError::NotFound(format!("Volume '{vol_name}' not found: {e}")))?;

    vol.delete(0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to delete volume: {e}")))?;

    Ok(())
}

pub fn start_pool(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    let pool = StoragePool::lookup_by_name(conn, name)
        .map_err(|e| LibvirtError::NotFound(format!("Pool '{name}' not found: {e}")))?;

    pool.create(0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to start pool '{name}': {e}")))?;

    Ok(())
}

pub fn stop_pool(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    let pool = StoragePool::lookup_by_name(conn, name)
        .map_err(|e| LibvirtError::NotFound(format!("Pool '{name}' not found: {e}")))?;

    pool.destroy()
        .map_err(|e| LibvirtError::Operation(format!("Failed to stop pool '{name}': {e}")))?;

    Ok(())
}

pub fn refresh_pool(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    let pool = StoragePool::lookup_by_name(conn, name)
        .map_err(|e| LibvirtError::NotFound(format!("Pool '{name}' not found: {e}")))?;

    pool.refresh(0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to refresh pool '{name}': {e}")))?;

    Ok(())
}

fn pool_state_to_string(state: u32) -> String {
    match state {
        0 => "inactive".to_string(),
        1 => "building".to_string(),
        2 => "running".to_string(),
        3 => "degraded".to_string(),
        4 => "inaccessible".to_string(),
        _ => format!("unknown ({state})"),
    }
}

fn vol_type_to_string(kind: u32) -> String {
    match kind {
        0 => "file".to_string(),
        1 => "block".to_string(),
        2 => "dir".to_string(),
        3 => "network".to_string(),
        4 => "netdir".to_string(),
        5 => "ploop".to_string(),
        _ => format!("unknown ({kind})"),
    }
}
