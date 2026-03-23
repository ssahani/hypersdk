use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::header;
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use std::path::PathBuf;
use tokio_util::io::ReaderStream;
use virtspawn_core::LibvirtManager;

use crate::error::AppError;

// ── Request types ───────────────────────────────────────────────────

#[derive(Deserialize, Default)]
struct BackupRequest {
    #[serde(default)]
    vm_name: Option<String>,
    #[serde(default)]
    with_disks: bool,
    #[serde(default)]
    incremental: bool,
    #[serde(default)]
    nfs_target: Option<String>,
    #[serde(default = "default_retain")]
    retain: u32,
}

fn default_retain() -> u32 {
    7
}

#[derive(Deserialize)]
struct RestoreRequest {
    backup_id: String,
}

// ── Helpers ─────────────────────────────────────────────────────────

fn backup_dir() -> PathBuf {
    let config = virtspawn_core::VirtspawnConfig::load();
    if !config.backup.backup_dir.is_empty() {
        return PathBuf::from(&config.backup.backup_dir);
    }

    if let Ok(content) = std::fs::read_to_string("/etc/virtspawn/backup.conf") {
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with('#') || trimmed.is_empty() {
                continue;
            }
            if let Some(rest) = trimmed.strip_prefix("backup_dir") {
                let rest = rest.trim_start();
                if let Some(value) = rest.strip_prefix('=') {
                    let dir = value.trim().trim_matches('"').trim_matches('\'');
                    if !dir.is_empty() {
                        return PathBuf::from(dir);
                    }
                }
            }
        }
    }

    PathBuf::from("/var/lib/virtspawn/backups")
}

fn backup_script() -> PathBuf {
    let installed = PathBuf::from("/usr/local/share/virtspawn/scripts/backup.sh");
    if installed.exists() {
        return installed;
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let relative = parent.join("../scripts/backup.sh");
            if let Ok(canonical) = relative.canonicalize() {
                return canonical;
            }
        }
    }
    PathBuf::from("scripts/backup.sh")
}

fn validate_backup_id(id: &str) -> Result<(), AppError> {
    if id.is_empty() || id.len() > 64 {
        return Err(
            virtspawn_core::LibvirtError::Operation("Invalid backup id length".to_string()).into(),
        );
    }
    if !id.chars().all(|c| c.is_ascii_digit() || c == '-') {
        return Err(virtspawn_core::LibvirtError::Operation(
            "Backup id must contain only digits and dashes".to_string(),
        )
        .into());
    }
    Ok(())
}

/// Validate NFS target format: must look like host:/path or ip:/path.
fn validate_nfs_target(target: &str) -> Result<(), AppError> {
    if target.is_empty() {
        return Ok(());
    }
    // Must contain exactly one colon separating host and path
    let parts: Vec<&str> = target.splitn(2, ':').collect();
    if parts.len() != 2 || parts[0].is_empty() || !parts[1].starts_with('/') {
        return Err(virtspawn_core::LibvirtError::Operation(
            "Invalid NFS target format. Expected: host:/path".to_string(),
        )
        .into());
    }
    // Host must be alphanumeric, dots, dashes only
    if !parts[0]
        .chars()
        .all(|c| c.is_alphanumeric() || c == '.' || c == '-')
    {
        return Err(virtspawn_core::LibvirtError::Operation(
            "NFS host contains invalid characters".to_string(),
        )
        .into());
    }
    Ok(())
}

fn dir_size_human(path: &std::path::Path) -> String {
    fn dir_size(path: &std::path::Path) -> u64 {
        let mut total: u64 = 0;
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                let ft = match entry.file_type() {
                    Ok(ft) => ft,
                    Err(_) => continue,
                };
                // Skip symlinks to avoid infinite recursion
                if ft.is_symlink() {
                    continue;
                }
                if ft.is_file() {
                    total += entry.metadata().map(|m| m.len()).unwrap_or(0);
                } else if ft.is_dir() {
                    total += dir_size(&entry.path());
                }
            }
        }
        total
    }

    let bytes = dir_size(path);
    if bytes >= 1_073_741_824 {
        format!("{:.1}G", bytes as f64 / 1_073_741_824.0)
    } else if bytes >= 1_048_576 {
        format!("{:.1}M", bytes as f64 / 1_048_576.0)
    } else if bytes >= 1024 {
        format!("{:.1}K", bytes as f64 / 1024.0)
    } else {
        format!("{}B", bytes)
    }
}

/// Generate a timestamp string in YYYYMMDD-HHMMSS format without shelling out.
fn generate_timestamp() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // Convert epoch seconds to YYYYMMDD-HHMMSS (UTC)
    // Simple conversion without chrono dependency
    let output = std::process::Command::new("date")
        .arg("+%Y%m%d-%H%M%S")
        .output();
    match output {
        Ok(o) if o.status.success() => String::from_utf8_lossy(&o.stdout).trim().to_string(),
        _ => {
            // Fallback: use epoch but formatted as digits-digits to match expected pattern
            let hi = secs / 1_000_000;
            let lo = secs % 1_000_000;
            format!("{hi:07}-{lo:06}")
        }
    }
}

fn parse_backup_meta(dir: &std::path::Path, dir_name: &str) -> serde_json::Value {
    let meta_path = dir.join("backup.meta");
    let mut vm_filter = "all".to_string();
    let mut vm_count: u64 = 0;
    let mut net_count: u64 = 0;
    let mut with_disks = false;
    let mut nfs_target = "local".to_string();

    // Read status
    let status_path = dir.join("backup.status");
    let mut status = "completed".to_string();
    let mut status_message = String::new();
    let mut progress = String::new();
    if let Ok(content) = std::fs::read_to_string(&status_path) {
        for line in content.lines() {
            if let Some((key, value)) = line.split_once('=') {
                match key.trim() {
                    "status" => status = value.trim().to_string(),
                    "message" => status_message = value.trim().to_string(),
                    "progress" => progress = value.trim().to_string(),
                    _ => {}
                }
            }
        }
    } else if !meta_path.exists() {
        status = "unknown".to_string();
    }

    if let Ok(content) = std::fs::read_to_string(&meta_path) {
        for line in content.lines() {
            let trimmed = line.trim();
            if let Some((key, value)) = trimmed.split_once('=') {
                let key = key.trim();
                let value = value.trim().trim_matches('"').trim_matches('\'');
                match key {
                    "vm_filter" => vm_filter = value.to_string(),
                    "vm_count" => vm_count = value.parse().unwrap_or(0),
                    "net_count" => net_count = value.parse().unwrap_or(0),
                    "with_disks" => with_disks = value == "true" || value == "1",
                    "nfs_target" => {
                        if !value.is_empty() {
                            nfs_target = value.to_string();
                        }
                    }
                    _ => {}
                }
            }
        }
    } else if status != "running" {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let name = entry.file_name();
                let name = name.to_string_lossy();
                if name.ends_with(".xml") {
                    if name.starts_with("net-") {
                        net_count += 1;
                    } else {
                        vm_count += 1;
                    }
                }
            }
        }
    }

    let has_checksums = dir.join("checksums.sha256").exists();
    let size = dir_size_human(dir);

    json!({
        "id": dir_name,
        "timestamp": dir_name,
        "vm_filter": vm_filter,
        "vm_count": vm_count,
        "net_count": net_count,
        "with_disks": with_disks,
        "nfs_target": nfs_target,
        "size": size,
        "status": status,
        "status_message": status_message,
        "progress": progress,
        "has_checksums": has_checksums,
    })
}

// ── Handlers ────────────────────────────────────────────────────────

/// POST /backups — trigger a new backup.
async fn trigger_backup(
    State(_manager): State<LibvirtManager>,
    body: Option<Json<BackupRequest>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let req = body.map(|Json(r)| r).unwrap_or_default();
    let script = backup_script();

    if !script.exists() {
        return Err(virtspawn_core::LibvirtError::Operation(format!(
            "Backup script not found at {}",
            script.display()
        ))
        .into());
    }

    // Validate vm_name if provided
    if let Some(ref vm) = req.vm_name {
        if !vm.is_empty() {
            virtspawn_core::validate::validate_name(vm)?;
        }
    }

    // Validate nfs_target if provided
    if let Some(ref nfs) = req.nfs_target {
        validate_nfs_target(nfs)?;
    }

    let backup_id = generate_timestamp();
    let mut cmd = tokio::process::Command::new("bash");
    cmd.arg(&script);
    cmd.env(
        "VIRTSPAWN_BACKUP_DIR",
        backup_dir().to_string_lossy().as_ref(),
    );

    if req.with_disks {
        cmd.arg("--with-disks");
    }
    if req.incremental {
        cmd.arg("--incremental");
    }
    if let Some(ref vm) = req.vm_name {
        if !vm.is_empty() {
            cmd.arg("--vm").arg(vm);
        }
    }
    if let Some(ref nfs) = req.nfs_target {
        if !nfs.is_empty() {
            cmd.arg("--nfs").arg(nfs);
        }
    }
    if req.retain > 0 {
        cmd.arg("--retain").arg(req.retain.to_string());
    }

    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());

    cmd.spawn().map_err(|e| {
        virtspawn_core::LibvirtError::Operation(format!("Failed to start backup: {e}"))
    })?;

    Ok(Json(json!({
        "status": "started",
        "backup_id": backup_id,
    })))
}

/// GET /backups — list existing backups.
async fn list_backups(
    State(_manager): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let dir = backup_dir();
    let mut backups = Vec::new();

    if dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            let mut dirs: Vec<_> = entries
                .flatten()
                .filter(|e| e.file_type().map(|ft| ft.is_dir()).unwrap_or(false))
                .collect();
            dirs.sort_by_key(|e| e.file_name());

            for entry in dirs {
                let name = entry.file_name();
                let name_str = name.to_string_lossy().to_string();
                backups.push(parse_backup_meta(&entry.path(), &name_str));
            }
        }
    }

    backups.reverse();
    Ok(Json(json!(backups)))
}

/// GET /backups/:id/status — get backup status and progress.
async fn get_backup_status(
    State(_manager): State<LibvirtManager>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    validate_backup_id(&id)?;

    let dir = backup_dir().join(&id);
    if !dir.exists() || !dir.is_dir() {
        return Err(
            virtspawn_core::LibvirtError::NotFound(format!("Backup '{}' not found", id)).into(),
        );
    }

    let status_path = dir.join("backup.status");
    let mut status = "completed".to_string();
    let mut message = String::new();
    let mut progress = String::new();
    let mut updated = String::new();

    if let Ok(content) = std::fs::read_to_string(&status_path) {
        for line in content.lines() {
            if let Some((key, value)) = line.split_once('=') {
                match key.trim() {
                    "status" => status = value.trim().to_string(),
                    "message" => message = value.trim().to_string(),
                    "progress" => progress = value.trim().to_string(),
                    "updated" => updated = value.trim().to_string(),
                    _ => {}
                }
            }
        }
    }

    Ok(Json(json!({
        "backup_id": id,
        "status": status,
        "message": message,
        "progress": progress,
        "updated": updated,
    })))
}

/// POST /backups/:id/verify — verify backup checksums.
async fn verify_backup(
    State(_manager): State<LibvirtManager>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    validate_backup_id(&id)?;

    let dir = backup_dir().join(&id);
    if !dir.exists() || !dir.is_dir() {
        return Err(
            virtspawn_core::LibvirtError::NotFound(format!("Backup '{}' not found", id)).into(),
        );
    }

    let checksum_file = dir.join("checksums.sha256");
    if !checksum_file.exists() {
        return Ok(Json(json!({
            "backup_id": id,
            "verified": false,
            "error": "No checksums.sha256 file found",
            "files_checked": 0,
            "files_failed": 0,
        })));
    }

    // Use tokio::process to avoid blocking the async runtime
    let output = tokio::process::Command::new("sha256sum")
        .arg("-c")
        .arg("checksums.sha256")
        .current_dir(&dir)
        .output()
        .await
        .map_err(|e| {
            virtspawn_core::LibvirtError::Operation(format!("Failed to run sha256sum: {e}"))
        })?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let total = stdout.lines().count();
    let failed: Vec<&str> = stdout
        .lines()
        .filter(|l| l.contains("FAILED"))
        .collect();
    let ok_count = total - failed.len();

    Ok(Json(json!({
        "backup_id": id,
        "verified": output.status.success(),
        "files_checked": total,
        "files_ok": ok_count,
        "files_failed": failed.len(),
        "failed_files": failed,
        "errors": stderr.trim(),
    })))
}

/// GET /backups/:id/download — stream backup as tar.gz.
async fn download_backup(
    State(_manager): State<LibvirtManager>,
    Path(id): Path<String>,
) -> Result<Response, AppError> {
    validate_backup_id(&id)?;

    let dir = backup_dir().join(&id);
    if !dir.exists() || !dir.is_dir() {
        return Err(
            virtspawn_core::LibvirtError::NotFound(format!("Backup '{}' not found", id)).into(),
        );
    }

    // Stream tar output instead of buffering entire archive in memory
    let mut child = tokio::process::Command::new("tar")
        .arg("czf")
        .arg("-")
        .arg("-C")
        .arg(backup_dir().to_string_lossy().as_ref())
        .arg(&id)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| {
            virtspawn_core::LibvirtError::Operation(format!("Failed to start tar: {e}"))
        })?;

    let stdout = child.stdout.take().ok_or_else(|| {
        virtspawn_core::LibvirtError::Operation("Failed to capture tar stdout".to_string())
    })?;

    let stream = ReaderStream::new(stdout);
    let body = Body::from_stream(stream);

    let filename = format!("virtspawn-backup-{id}.tar.gz");
    Ok((
        [
            (header::CONTENT_TYPE, "application/gzip"),
            (
                header::CONTENT_DISPOSITION,
                &format!("attachment; filename=\"{filename}\""),
            ),
        ],
        body,
    )
        .into_response())
}

/// POST /backups/restore — restore from a specific backup.
async fn restore_backup(
    State(_manager): State<LibvirtManager>,
    Json(req): Json<RestoreRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    validate_backup_id(&req.backup_id)?;

    let dir = backup_dir().join(&req.backup_id);
    if !dir.exists() || !dir.is_dir() {
        return Err(virtspawn_core::LibvirtError::NotFound(format!(
            "Backup '{}' not found",
            req.backup_id
        ))
        .into());
    }

    let script = backup_script();
    if !script.exists() {
        return Err(virtspawn_core::LibvirtError::Operation(format!(
            "Backup script not found at {}",
            script.display()
        ))
        .into());
    }

    let mut cmd = tokio::process::Command::new("bash");
    cmd.arg(&script)
        .arg("--restore")
        .arg(dir.to_string_lossy().as_ref());
    cmd.env(
        "VIRTSPAWN_BACKUP_DIR",
        backup_dir().to_string_lossy().as_ref(),
    );

    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());

    cmd.spawn().map_err(|e| {
        virtspawn_core::LibvirtError::Operation(format!("Failed to start restore: {e}"))
    })?;

    Ok(Json(json!({
        "status": "restore_started",
        "backup_id": req.backup_id,
    })))
}

/// DELETE /backups/:id — remove a backup directory.
async fn delete_backup(
    State(_manager): State<LibvirtManager>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    validate_backup_id(&id)?;

    let dir = backup_dir().join(&id);
    if !dir.exists() || !dir.is_dir() {
        return Err(
            virtspawn_core::LibvirtError::NotFound(format!("Backup '{}' not found", id)).into(),
        );
    }

    tokio::fs::remove_dir_all(&dir).await.map_err(|e| {
        virtspawn_core::LibvirtError::Operation(format!("Failed to delete backup '{}': {e}", id))
    })?;

    Ok(Json(json!({
        "status": "deleted",
        "backup_id": id,
    })))
}

/// GET /backups/schedule — get backup timer status.
async fn get_schedule(
    State(_manager): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let active = tokio::process::Command::new("systemctl")
        .args(["is-active", "virtspawn-backup.timer"])
        .output()
        .await
        .map(|o| String::from_utf8_lossy(&o.stdout).trim() == "active")
        .unwrap_or(false);

    let enabled = tokio::process::Command::new("systemctl")
        .args(["is-enabled", "virtspawn-backup.timer"])
        .output()
        .await
        .map(|o| String::from_utf8_lossy(&o.stdout).trim() == "enabled")
        .unwrap_or(false);

    let next_run = tokio::process::Command::new("systemctl")
        .args([
            "show",
            "virtspawn-backup.timer",
            "--property=NextElapseUSecRealtime",
            "--value",
        ])
        .output()
        .await
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();

    let last_run = tokio::process::Command::new("systemctl")
        .args([
            "show",
            "virtspawn-backup.timer",
            "--property=LastTriggerUSec",
            "--value",
        ])
        .output()
        .await
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();

    let installed = std::path::Path::new("/usr/lib/systemd/system/virtspawn-backup.timer").exists()
        || std::path::Path::new("/etc/systemd/system/virtspawn-backup.timer").exists();

    Ok(Json(json!({
        "installed": installed,
        "enabled": enabled,
        "active": active,
        "next_run": next_run,
        "last_run": last_run,
    })))
}

/// POST /backups/schedule — enable or disable backup timer.
#[derive(Deserialize)]
struct ScheduleRequest {
    enabled: bool,
}

async fn set_schedule(
    State(_manager): State<LibvirtManager>,
    Json(req): Json<ScheduleRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let action = if req.enabled {
        "enable"
    } else {
        "disable"
    };

    let output = tokio::process::Command::new("systemctl")
        .args([action, "--now", "virtspawn-backup.timer"])
        .output()
        .await
        .map_err(|e| {
            virtspawn_core::LibvirtError::Operation(format!("Failed to {action} timer: {e}"))
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(virtspawn_core::LibvirtError::Operation(format!(
            "systemctl {action} failed: {stderr}"
        ))
        .into());
    }

    Ok(Json(json!({
        "status": action,
        "enabled": req.enabled,
    })))
}

// ── Router ──────────────────────────────────────────────────────────

pub fn backup_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/backups", get(list_backups).post(trigger_backup))
        .route("/backups/restore", post(restore_backup))
        .route("/backups/schedule", get(get_schedule).post(set_schedule))
        .route("/backups/{id}", delete(delete_backup))
        .route("/backups/{id}/status", get(get_backup_status))
        .route("/backups/{id}/verify", post(verify_backup))
        .route("/backups/{id}/download", get(download_backup))
}
