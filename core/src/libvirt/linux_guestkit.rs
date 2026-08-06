// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! Offline Linux guest ops via **GuestKit** (`plan` / `rescue`).
//!
//! Machina does not call libguestfs-tools CLIs directly — disk mounts stay
//! inside GuestKit (≥ 0.3.17).

use std::path::Path;
use std::process::Command;

use crate::LibvirtError;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct LinuxOfflineOutcome {
    pub disk_path: String,
    pub operation: String,
    pub applied: Vec<String>,
    pub notes: Vec<String>,
}

fn guestkit_binary(configured: &str) -> String {
    let t = configured.trim();
    if t.is_empty() {
        "guestkit".to_string()
    } else {
        t.to_string()
    }
}

fn require_absolute_disk(disk_path: &str) -> Result<&Path, LibvirtError> {
    let disk = Path::new(disk_path);
    if !disk.is_absolute() {
        return Err(LibvirtError::Invalid(
            "disk path must be absolute".to_string(),
        ));
    }
    if !disk.is_file() {
        return Err(LibvirtError::NotFound(format!(
            "disk image not found: {disk_path}"
        )));
    }
    Ok(disk)
}

fn run_guestkit(bin: &str, args: &[&str]) -> Result<(String, String), LibvirtError> {
    let out = Command::new(bin).args(args).output().map_err(|e| {
        LibvirtError::Operation(format!(
            "cannot run {bin}: {e} — install guestkit ≥ 0.3.17 on the hypervisor"
        ))
    })?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    if !out.status.success() {
        let msg = if stderr.trim().is_empty() {
            stdout.trim().to_string()
        } else {
            stderr.trim().to_string()
        };
        return Err(LibvirtError::Operation(format!(
            "guestkit {} failed: {msg}",
            args.first().unwrap_or(&"")
        )));
    }
    Ok((stdout, stderr))
}

fn parse_applied_count(out: &str) -> Option<u32> {
    out.lines().find_map(|l| {
        l.trim()
            .strip_prefix("Operations applied:")
            .and_then(|rest| rest.trim().parse().ok())
    })
}

/// `plan generate -p linux-ssh` then `plan apply --skip-backup`.
pub fn enable_ssh_offline(
    disk_path: &str,
    guestkit_bin: &str,
) -> Result<LinuxOfflineOutcome, LibvirtError> {
    require_absolute_disk(disk_path)?;
    let bin = guestkit_binary(guestkit_bin);
    let plan_file = std::env::temp_dir().join(format!(
        "machina-linux-ssh-{}.json",
        std::process::id()
    ));
    let plan_path = plan_file.to_string_lossy().to_string();

    run_guestkit(
        &bin,
        &[
            "plan",
            "generate",
            disk_path,
            "-p",
            "linux-ssh",
            "-o",
            &plan_path,
            "-f",
            "json",
        ],
    )?;

    let apply = run_guestkit(
        &bin,
        &[
            "plan",
            "apply",
            &plan_path,
            "--vm",
            disk_path,
            "--yes",
            "--skip-backup",
        ],
    );
    let _ = std::fs::remove_file(&plan_file);
    let (stdout, stderr) = apply?;

    let combined = format!("{stdout}\n{stderr}");
    if combined.contains("unexpected argument '--skip-backup'")
        || combined.contains("Unrecognized option")
    {
        return Err(LibvirtError::Operation(
            "guestkit on this host is too old for `plan apply --skip-backup` \
             (needs GuestKit ≥ 0.3.17). Upgrade guestkit."
                .into(),
        ));
    }

    let applied_count = parse_applied_count(&stdout).or_else(|| parse_applied_count(&stderr));
    match applied_count {
        Some(n) if n > 0 => Ok(LinuxOfflineOutcome {
            disk_path: disk_path.to_string(),
            operation: "enable-ssh".into(),
            applied: vec![
                "systemd multi-user.target.wants ssh/sshd unit symlink".into(),
                "/etc/ssh/sshd_config.d/99-guestkit.conf (PubkeyAuthentication yes)".into(),
            ],
            notes: vec![
                format!("guestkit plan apply applied {n} operation(s)"),
                "Start the VM — sshd should be enabled at boot.".into(),
            ],
        }),
        Some(_) => Err(LibvirtError::Operation(
            "guestkit applied 0 operations — SSH was not enabled offline".into(),
        )),
        None => {
            // Older summary formats: treat success exit + enable messaging as ok.
            if combined.contains("Plan applied successfully") || combined.contains("enabled") {
                Ok(LinuxOfflineOutcome {
                    disk_path: disk_path.to_string(),
                    operation: "enable-ssh".into(),
                    applied: vec!["linux-ssh plan applied".into()],
                    notes: vec!["Start the VM — sshd should be enabled at boot.".into()],
                })
            } else {
                Err(LibvirtError::Operation(
                    "guestkit exited 0 but reported no applied operations for linux-ssh".into(),
                ))
            }
        }
    }
}

fn rescue(
    disk_path: &str,
    guestkit_bin: &str,
    operation: &str,
    extra: &[String],
) -> Result<(String, String), LibvirtError> {
    require_absolute_disk(disk_path)?;
    let bin = guestkit_binary(guestkit_bin);
    let mut args: Vec<String> = vec![
        "rescue".into(),
        disk_path.into(),
        "-o".into(),
        operation.into(),
    ];
    args.extend(extra.iter().cloned());
    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    run_guestkit(&bin, &arg_refs)
}

/// Append an OpenSSH public key to the user's `authorized_keys`.
pub fn inject_ssh_key_offline(
    disk_path: &str,
    guestkit_bin: &str,
    user: &str,
    public_key: &str,
) -> Result<LinuxOfflineOutcome, LibvirtError> {
    let user = user.trim();
    let key = public_key.trim();
    if user.is_empty() {
        return Err(LibvirtError::Invalid("user is required".into()));
    }
    if key.is_empty() {
        return Err(LibvirtError::Invalid("public_key is required".into()));
    }
    let (stdout, _stderr) = rescue(
        disk_path,
        guestkit_bin,
        "inject-ssh-key",
        &["-u".into(), user.into(), "--key".into(), key.into()],
    )?;
    Ok(LinuxOfflineOutcome {
        disk_path: disk_path.to_string(),
        operation: "inject-ssh-key".into(),
        applied: vec![format!("authorized_keys for {user}")],
        notes: vec![
            stdout
                .lines()
                .find(|l| l.contains('✓') || l.contains("injected"))
                .unwrap_or("SSH public key injected")
                .trim()
                .to_string(),
        ],
    })
}

/// Reset a Linux user's password via `/etc/shadow` (openssl passwd -6).
pub fn reset_password_offline(
    disk_path: &str,
    guestkit_bin: &str,
    user: &str,
    password: &str,
) -> Result<LinuxOfflineOutcome, LibvirtError> {
    let user = user.trim();
    if user.is_empty() {
        return Err(LibvirtError::Invalid("user is required".into()));
    }
    if password.is_empty() {
        return Err(LibvirtError::Invalid("password is required".into()));
    }
    let (_stdout, _stderr) = rescue(
        disk_path,
        guestkit_bin,
        "reset-password",
        &[
            "-u".into(),
            user.into(),
            "-p".into(),
            password.into(),
        ],
    )?;
    Ok(LinuxOfflineOutcome {
        disk_path: disk_path.to_string(),
        operation: "reset-password".into(),
        applied: vec![format!("/etc/shadow entry for {user}")],
        notes: vec![
            "Password hash updated offline — start the VM to use the new password.".into(),
        ],
    })
}

/// Comment out missing `/dev/*` entries in `/etc/fstab`.
pub fn fix_fstab_offline(
    disk_path: &str,
    guestkit_bin: &str,
) -> Result<LinuxOfflineOutcome, LibvirtError> {
    let (stdout, _stderr) = rescue(disk_path, guestkit_bin, "fix-fstab", &[])?;
    let summary = stdout
        .lines()
        .rev()
        .find(|l| l.contains('✓') || l.contains("fstab"))
        .unwrap_or("fstab checked")
        .trim()
        .to_string();
    Ok(LinuxOfflineOutcome {
        disk_path: disk_path.to_string(),
        operation: "fix-fstab".into(),
        applied: vec!["/etc/fstab".into()],
        notes: vec![summary],
    })
}

/// Set `/etc/hostname` and patch `/etc/hosts`.
pub fn set_hostname_offline(
    disk_path: &str,
    guestkit_bin: &str,
    hostname: &str,
) -> Result<LinuxOfflineOutcome, LibvirtError> {
    let hostname = hostname.trim();
    if hostname.is_empty() {
        return Err(LibvirtError::Invalid("hostname is required".into()));
    }
    let (_stdout, _stderr) = rescue(
        disk_path,
        guestkit_bin,
        "set-hostname",
        &["--hostname".into(), hostname.into()],
    )?;
    Ok(LinuxOfflineOutcome {
        disk_path: disk_path.to_string(),
        operation: "set-hostname".into(),
        applied: vec![
            format!("/etc/hostname = {hostname}"),
            "/etc/hosts 127.0.1.1 entry".into(),
        ],
        notes: vec!["Hostname written offline — reboot/start the VM to apply.".into()],
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_relative_and_missing_disk() {
        assert!(enable_ssh_offline("relative.qcow2", "guestkit").is_err());
        assert!(enable_ssh_offline("/nonexistent/linux-does-not-exist.qcow2", "guestkit").is_err());
        assert!(inject_ssh_key_offline("/nonexistent/x.qcow2", "guestkit", "root", "ssh-ed25519 AAAA").is_err());
    }

    #[test]
    fn rejects_empty_params() {
        // Path check runs first for missing file — use a path that fails validation earlier via empty user after we can't hit disk. Unit-level param checks:
        assert!(matches!(
            inject_ssh_key_offline("/tmp", "guestkit", "", "ssh-ed25519 AAAA"),
            Err(LibvirtError::Invalid(_)) | Err(LibvirtError::NotFound(_))
        ));
    }
}
