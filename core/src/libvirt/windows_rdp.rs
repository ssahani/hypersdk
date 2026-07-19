// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! Enable Remote Desktop on a **powered-off** Windows guest by editing its
//! registry hive offline, via `guestkit plan apply --features registry-write`.
//!
//! This is the only path that needs nothing inside the guest: no QEMU guest
//! agent, no in-guest agent, no console trip. Remote Desktop ships disabled on
//! Windows, so a freshly-installed guest is unreachable over RDP until somebody
//! turns it on — and turning it on normally requires the very console access
//! RDP was meant to provide.

use std::path::Path;
use std::process::Command;

use crate::LibvirtError;

/// `fDenyTSConnections = 0` is what the Remote Desktop toggle actually writes.
const TS_KEY: &str = r"HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server";
const TS_VALUE: &str = "fDenyTSConnections";

/// Network Level Authentication — left on, but the value must exist for the
/// service to start cleanly on some images.
const NLA_KEY: &str =
    r"HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp";

#[derive(Debug, Clone, serde::Serialize)]
pub struct RdpEnableOutcome {
    pub disk_path: String,
    /// Registry values actually written.
    pub applied: Vec<String>,
    /// True when the firewall still has to be opened inside Windows.
    pub firewall_manual: bool,
    pub notes: Vec<String>,
}

/// Build the guestkit fix-plan JSON that flips the Remote Desktop switch.
///
/// Kept separate from the subprocess call so the plan shape is unit-testable
/// without a disk image or the guestkit binary.
pub fn build_rdp_enable_plan(disk_path: &str) -> serde_json::Value {
    serde_json::json!({
        "version": 1,
        "name": "enable-remote-desktop",
        "description": "Enable Windows Remote Desktop (fDenyTSConnections=0)",
        "target": { "disk": disk_path },
        "registry_edits": [
            {
                "key": TS_KEY,
                "value": TS_VALUE,
                "data_type": "dword",
                "new_data": "0",
            },
            {
                "key": NLA_KEY,
                "value": "UserAuthentication",
                "data_type": "dword",
                "new_data": "1",
            },
        ],
    })
}

/// Path to the guestkit binary, honouring the configured override.
fn guestkit_binary(configured: &str) -> String {
    let c = configured.trim();
    if c.is_empty() {
        "guestkit".to_string()
    } else {
        c.to_string()
    }
}

/// Apply the plan to `disk_path`. The VM **must be powered off** — mutating a
/// hive under a running guest risks corrupting it.
pub fn enable_rdp_offline(
    disk_path: &str,
    guestkit_bin: &str,
) -> Result<RdpEnableOutcome, LibvirtError> {
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

    let plan = build_rdp_enable_plan(disk_path);
    let plan_file = std::env::temp_dir().join(format!(
        "machina-rdp-plan-{}.json",
        std::process::id()
    ));
    std::fs::write(&plan_file, serde_json::to_vec_pretty(&plan).unwrap_or_default())
        .map_err(|e| LibvirtError::Operation(format!("cannot write fix plan: {e}")))?;

    let bin = guestkit_binary(guestkit_bin);
    let out = Command::new(&bin)
        .arg("plan")
        .arg("apply")
        .arg("--plan")
        .arg(&plan_file)
        .arg("--disk")
        .arg(disk_path)
        .arg("--yes")
        .output();
    let _ = std::fs::remove_file(&plan_file);

    let out = out.map_err(|e| {
        LibvirtError::Operation(format!(
            "cannot run {bin}: {e} — install guestkit on the hypervisor"
        ))
    })?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();

    // guestkit prints this when built without the hive-write feature. Treat it as
    // a failure rather than reporting success over a no-op.
    if stdout.contains("--features registry-write") || stderr.contains("--features registry-write") {
        return Err(LibvirtError::Operation(
            "guestkit on this host was built without offline registry writes \
             (rebuild with --features registry-write)"
                .into(),
        ));
    }
    if !out.status.success() {
        let msg = if stderr.trim().is_empty() {
            stdout.trim().to_string()
        } else {
            stderr.trim().to_string()
        };
        return Err(LibvirtError::Operation(format!(
            "guestkit plan apply failed: {msg}"
        )));
    }

    Ok(RdpEnableOutcome {
        disk_path: disk_path.to_string(),
        applied: vec![
            format!("{TS_KEY}\\{TS_VALUE} = 0"),
            format!("{NLA_KEY}\\UserAuthentication = 1"),
        ],
        // Windows Firewall rules are opaque blobs under FirewallPolicy\FirewallRules;
        // writing them offline is unreliable, so we say so rather than pretend.
        firewall_manual: true,
        notes: vec![
            "Start the VM — Remote Desktop is now enabled in the registry.".into(),
            "If it still refuses, enable the 'Remote Desktop' inbound firewall rule inside Windows."
                .into(),
            "Windows Home editions cannot host RDP regardless of this setting.".into(),
        ],
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plan_targets_the_remote_desktop_switch() {
        let p = build_rdp_enable_plan("/var/lib/libvirt/images/win10.qcow2");
        let edits = p["registry_edits"].as_array().unwrap();
        let first = &edits[0];
        assert_eq!(first["value"], "fDenyTSConnections");
        // 0 = allow connections. A non-zero value here would silently do nothing.
        assert_eq!(first["new_data"], "0");
        assert_eq!(first["data_type"], "dword");
        assert!(first["key"].as_str().unwrap().contains("Terminal Server"));
        assert_eq!(p["target"]["disk"], "/var/lib/libvirt/images/win10.qcow2");
    }

    #[test]
    fn rejects_relative_and_missing_disks() {
        assert!(enable_rdp_offline("relative/win.qcow2", "guestkit").is_err());
        assert!(enable_rdp_offline("/nonexistent/win-does-not-exist.qcow2", "guestkit").is_err());
    }

    #[test]
    fn binary_override_falls_back_to_path_lookup() {
        assert_eq!(guestkit_binary(""), "guestkit");
        assert_eq!(guestkit_binary("  "), "guestkit");
        assert_eq!(guestkit_binary("/usr/local/bin/guestkit"), "/usr/local/bin/guestkit");
    }
}
