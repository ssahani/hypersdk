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
///
/// Note the control set is spelled out rather than using `CurrentControlSet`.
/// That name is a runtime symlink Windows builds at boot from `Select\Current`
/// and does **not** exist in an offline hive — guestkit happily creates a literal
/// key by that name, reports "Operations applied: 1", and produces a value
/// Windows will never read. Verified on a real image: writing via
/// `CurrentControlSet` left `ControlSet001` at 1 and RDP disabled.
const TS_KEY: &str = r"HKLM\SYSTEM\ControlSet001\Control\Terminal Server";
const TS_VALUE: &str = "fDenyTSConnections";

/// Network Level Authentication — left on, but the value must exist for the
/// service to start cleanly on some images.
const NLA_KEY: &str =
    r"HKLM\SYSTEM\ControlSet001\Control\Terminal Server\WinStations\RDP-Tcp";

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
/// Matches guestkit's `FixPlan` (src/cli/plan/types.rs): registry edits are
/// `operations` entries tagged `registry_edit`, not a top-level array, and each
/// carries `current_data` as well as `new_data`.
pub fn build_rdp_enable_plan(disk_path: &str, generated_rfc3339: &str) -> serde_json::Value {
    serde_json::json!({
        "version": "1",
        "vm": disk_path,
        "generated": generated_rfc3339,
        "profile": "machina-enable-rdp",
        "overall_risk": "low",
        "estimated_duration": "seconds",
        "metadata": {
            "author": "machina",
            "review_required": false,
            "reversible": true,
        },
        "operations": [
            {
                "id": "enable-rdp",
                "type": "registry_edit",
                "key": TS_KEY,
                "value": TS_VALUE,
                // 1 = connections denied, which is the Windows default.
                "current_data": 1,
                "new_data": 0,
                "data_type": "dword",
                "priority": "high",
                "description": "Allow Remote Desktop connections",
                "risk": "low",
                "reversible": true,
            },
            {
                "id": "rdp-nla",
                "type": "registry_edit",
                "key": NLA_KEY,
                "value": "UserAuthentication",
                "current_data": 1,
                "new_data": 1,
                "data_type": "dword",
                "priority": "low",
                "description": "Keep Network Level Authentication enabled",
                "risk": "low",
                "reversible": true,
            },
        ],
        "post_apply": [],
    })
}

/// Read a registry DWORD straight out of a disk image, independent of the tool
/// that wrote it.
///
/// `hivexget` needs a mounted filesystem; `virt-win-reg` takes the image itself,
/// which is all the daemon has. This exists because guestkit reported
/// "Operations applied: 1" for a write that landed in a literal
/// `CurrentControlSet` key Windows never reads — its own success report is not
/// evidence that anything took effect.
///
/// Returns `None` when virt-win-reg is missing or the key is absent; callers
/// treat that as "unverified" rather than as failure.
fn read_registry_dword(disk_path: &str, key: &str, value: &str) -> Option<i64> {
    let out = Command::new("virt-win-reg")
        .arg(disk_path)
        .arg(key)
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    parse_reg_dword(&String::from_utf8_lossy(&out.stdout), value)
}

/// Pull `"name"=dword:0000000f` out of virt-win-reg's .reg-format output.
fn parse_reg_dword(reg_output: &str, value: &str) -> Option<i64> {
    let needle = format!("\"{value}\"=dword:");
    reg_output.lines().find_map(|l| {
        let rest = l.trim().strip_prefix(needle.as_str())?;
        i64::from_str_radix(rest.trim(), 16).ok()
    })
}

/// Pull `N` out of guestkit's "Operations applied: N" summary line.
///
/// Absent from the output means the plan was previewed but never applied — the
/// difference between a real write and a no-op, since the exit code is 0 either way.
fn parse_applied_count(out: &str) -> Option<u32> {
    out.lines()
        .find_map(|l| l.trim().strip_prefix("Operations applied:"))
        .and_then(|n| n.trim().parse().ok())
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

    // guestkit's FixPlan requires a `generated` timestamp.
    let generated = chrono::Utc::now().to_rfc3339();
    let plan = build_rdp_enable_plan(disk_path, &generated);
    let plan_file = std::env::temp_dir().join(format!(
        "machina-rdp-plan-{}.json",
        std::process::id()
    ));
    std::fs::write(&plan_file, serde_json::to_vec_pretty(&plan).unwrap_or_default())
        .map_err(|e| LibvirtError::Operation(format!("cannot write fix plan: {e}")))?;

    let bin = guestkit_binary(guestkit_bin);
    // `guestkit plan apply [OPTIONS] <PLAN_FILE>` — the plan is positional and
    // the disk is --vm. An earlier --plan/--disk spelling was invented, not read
    // off the tool, and would have failed at argument parsing.
    let out = Command::new(&bin)
        .arg("plan")
        .arg("apply")
        .arg(&plan_file)
        .arg("--vm")
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

    // A zero exit is not evidence of a write. guestkit 0.3.13 returns 0 even when
    // it prints "✗ Plan application failed" — observed against a real Windows
    // image where the hive upload was refused with "Read-only file system
    // (os error 30)" and the summary read "Operations applied: 0, failed: 1".
    // Only that summary distinguishes a real write from a failed or preview-only
    // run, so require it and require N > 0.
    let applied_count = parse_applied_count(&stdout).or_else(|| parse_applied_count(&stderr));
    match applied_count {
        Some(n) if n > 0 => {}
        Some(_) => {
            // The usual cause is a dirty NTFS journal from an unclean shutdown:
            // ntfs-3g then mounts read-only and refuses the hive upload.
            return Err(LibvirtError::Operation(format!(
                "guestkit applied 0 operations — the registry was not written. \
                 If the guest filesystem mounted read-only, boot the VM and shut it \
                 down cleanly from inside Windows, then retry. guestkit said: {}",
                stdout
                    .lines()
                    .find(|l| l.contains("failed:") || l.contains("Read-only"))
                    .unwrap_or("(no detail)")
                    .trim()
            )))
        }
        None => {
            return Err(LibvirtError::Operation(
                "guestkit exited 0 but reported no applied operations, so the registry \
                 was not written. This build previews the plan without applying it; \
                 upgrade guestkit or enable Remote Desktop inside the guest."
                    .into(),
            ))
        }
    }

    // Independent read-back. guestkit's report has twice claimed success over a
    // write that did not take effect — once failing on a read-only mount while
    // exiting 0, once writing to a CurrentControlSet key Windows never reads —
    // so the value is confirmed with a different tool at the key the guest uses.
    let verified = read_registry_dword(disk_path, TS_KEY, TS_VALUE);
    if verified == Some(1) {
        return Err(LibvirtError::Operation(format!(
            "guestkit reported success but {TS_VALUE} is still 1, so Remote Desktop \
             is still disabled. The write did not reach {TS_KEY}."
        )));
    }

    let mut notes = vec![
        "Start the VM — Remote Desktop is now enabled in the registry.".to_string(),
        "If it still refuses, enable the 'Remote Desktop' inbound firewall rule inside Windows."
            .to_string(),
        "Windows Home editions cannot host RDP regardless of this setting.".to_string(),
    ];
    match verified {
        Some(0) => notes.insert(0, format!("Verified: {TS_VALUE} reads 0 on disk.")),
        None => notes.insert(
            0,
            "Could not verify the value independently (virt-win-reg unavailable); \
             confirm Remote Desktop is on after boot."
                .to_string(),
        ),
        Some(other) => notes.insert(0, format!("{TS_VALUE} reads {other} on disk.")),
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
        notes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plan_matches_guestkit_fixplan_shape() {
        let p = build_rdp_enable_plan("/var/lib/libvirt/images/win10.qcow2", "2026-07-19T00:00:00Z");
        // Fields guestkit's FixPlan requires — a plan missing any of these is
        // rejected at deserialization, before a single hive is touched.
        for k in ["version", "vm", "generated", "profile", "overall_risk", "metadata", "operations"] {
            assert!(p.get(k).is_some(), "plan missing required field {k}");
        }
        assert_eq!(p["vm"], "/var/lib/libvirt/images/win10.qcow2");
        let op = &p["operations"][0];
        assert_eq!(op["type"], "registry_edit");
        assert_eq!(op["value"], "fDenyTSConnections");
        // 0 = allow connections; any other value silently leaves RDP disabled.
        assert_eq!(op["new_data"], 0);
        assert_eq!(op["data_type"], "dword");
        assert!(op["current_data"].is_number(), "current_data is required");
        assert!(op["key"].as_str().unwrap().contains("Terminal Server"));
    }

    #[test]
    fn rejects_relative_and_missing_disks() {
        assert!(enable_rdp_offline("relative/win.qcow2", "guestkit").is_err());
        assert!(enable_rdp_offline("/nonexistent/win-does-not-exist.qcow2", "guestkit").is_err());
    }

    #[test]
    fn parses_virt_win_reg_dword_output() {
        let out = "[HKEY_LOCAL_MACHINE\\SYSTEM\\ControlSet001\\Control\\Terminal Server]\n\"fDenyTSConnections\"=dword:00000000\n";
        assert_eq!(parse_reg_dword(out, "fDenyTSConnections"), Some(0));
        let still_on = "\"fDenyTSConnections\"=dword:00000001\n";
        assert_eq!(parse_reg_dword(still_on, "fDenyTSConnections"), Some(1));
        assert_eq!(parse_reg_dword(out, "SomethingElse"), None);
    }

    #[test]
    fn targets_a_real_control_set_not_the_runtime_symlink() {
        // CurrentControlSet does not exist offline. Writing through it creates an
        // inert literal key: on a real image that left ControlSet001 at 1 with RDP
        // still disabled, while the tool reported one operation applied.
        let p = build_rdp_enable_plan("/x.qcow2", "2026-07-20T00:00:00Z");
        for op in p["operations"].as_array().unwrap() {
            let key = op["key"].as_str().unwrap();
            assert!(
                !key.contains("CurrentControlSet"),
                "must not write through the runtime symlink: {key}"
            );
            assert!(key.contains("ControlSet001"), "expected a real control set: {key}");
        }
    }

    #[test]
    fn treats_a_preview_only_run_as_failure() {
        // The exact output guestkit 0.3.13 produces for `plan apply --yes`: a
        // preview, then exit 0, with nothing written. Verified against a real
        // image whose md5 was byte-identical afterwards.
        let preview_only = "\n📋 Fix Plan Preview\nVM: /x.qcow2\n[enable-rdp] Allow Remote Desktop connections\n  1 → 0\nBackup: Will create automatic backup\nRollback: Available for all operations\n";
        assert_eq!(parse_applied_count(preview_only), None);
    }

    #[test]
    fn reads_the_applied_count_when_present() {
        assert_eq!(parse_applied_count("✓ Plan applied successfully\n  Operations applied: 2\n  Operations skipped: 0\n"), Some(2));
        // A dry run reports zero applied — also not a real write.
        assert_eq!(parse_applied_count("  Operations applied: 0\n  Operations skipped: 1\n"), Some(0));
    }

    #[test]
    fn binary_override_falls_back_to_path_lookup() {
        assert_eq!(guestkit_binary(""), "guestkit");
        assert_eq!(guestkit_binary("  "), "guestkit");
        assert_eq!(guestkit_binary("/usr/local/bin/guestkit"), "/usr/local/bin/guestkit");
    }
}
