// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! Enable Remote Desktop on a **powered-off** Windows guest by editing its
//! registry hive offline.
//!
//! Primary path: `virt-win-reg --merge` (seconds, no full-disk copy). GuestKit
//! `plan apply` remains a fallback, but it copies the whole qcow2 first — on a
//! ~35 GiB Windows golden that alone is tens of minutes and can fill the host.
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

/// Windows Firewall rule store. Enabling the Terminal Server service is not
/// enough on its own: the inbound RDP rule ships `Active=FALSE`, so the firewall
/// silently drops 3389 and the connection times out rather than refusing.
const FW_RULES_KEY: &str =
    r"HKLM\SYSTEM\ControlSet001\Services\SharedAccess\Parameters\FirewallPolicy\FirewallRules";

/// The built-in inbound RDP rules present on a stock Windows image.
const FW_RDP_RULES: [&str; 2] = [
    "RemoteDesktop-UserMode-In-TCP",
    "RemoteDesktop-UserMode-In-UDP",
];

/// Flip a firewall rule string from inactive to active, leaving everything else
/// untouched.
///
/// The rule is a `|`-delimited blob whose schema version varies by Windows build
/// (`v2.29` on the image this was developed against), so it is read and edited
/// rather than reconstructed — writing a hard-coded rule would clobber whatever
/// the guest actually had.
pub fn activate_firewall_rule(rule: &str) -> Option<String> {
    if rule.contains("Active=TRUE") {
        return None; // already enabled; nothing to write
    }
    if !rule.contains("Active=FALSE") {
        return None; // unrecognised shape — do not guess
    }
    Some(rule.replace("Active=FALSE", "Active=TRUE"))
}

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
pub fn build_rdp_enable_plan(
    disk_path: &str,
    generated_rfc3339: &str,
    firewall_edits: &[(String, String)],
) -> serde_json::Value {
    let mut plan = serde_json::json!({
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
    });
    // Firewall rules are appended rather than baked in: each one is read off the
    // guest and edited, because the rule schema version differs per Windows build.
    if let Some(ops) = plan["operations"].as_array_mut() {
        for (i, (rule_name, new_value)) in firewall_edits.iter().enumerate() {
            ops.push(serde_json::json!({
                "id": format!("fw-{i}"),
                "type": "registry_edit",
                "key": FW_RULES_KEY,
                "value": rule_name,
                "current_data": "",
                "new_data": new_value,
                "data_type": "String",
                "priority": "high",
                "description": format!("Enable firewall rule {rule_name}"),
                "risk": "low",
                "reversible": true,
            }));
        }
    }
    plan
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

/// Read a REG_SZ out of a disk image via virt-win-reg.
fn read_registry_string(disk_path: &str, key: &str, value: &str) -> Option<String> {
    let out = Command::new("virt-win-reg")
        .arg(disk_path)
        .arg(key)
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    parse_reg_string(&String::from_utf8_lossy(&out.stdout), value)
}

/// Pull a string value out of virt-win-reg's .reg output.
///
/// Long/binary-ish strings are emitted as `hex(1):` — comma-separated bytes of
/// NUL-terminated UTF-16LE — not as `"name"="data"`. The firewall rules are
/// always in that form, so a parser that only handled the quoted spelling found
/// nothing and silently staged no firewall edits.
fn parse_reg_string(reg_output: &str, value: &str) -> Option<String> {
    let quoted = format!("\"{value}\"=\"");
    let hexed = format!("\"{value}\"=hex(1):");

    // Join the .reg line-continuation form (`\` at end of line) before matching.
    let joined = reg_output.replace("\\\n", "").replace("\\\r\n", "");

    for line in joined.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix(quoted.as_str()) {
            let body = rest.strip_suffix('"')?;
            return Some(body.replace("\\\\", "\\").replace("\\\"", "\""));
        }
        if let Some(rest) = line.strip_prefix(hexed.as_str()) {
            return decode_reg_hex_utf16(rest);
        }
    }
    None
}

/// Decode `76,00,32,00,…` (UTF-16LE bytes, NUL-terminated) into a String.
fn decode_reg_hex_utf16(hex_csv: &str) -> Option<String> {
    let bytes: Vec<u8> = hex_csv
        .split(',')
        .map(|b| u8::from_str_radix(b.trim(), 16))
        .collect::<Result<_, _>>()
        .ok()?;
    let units: Vec<u16> = bytes
        .chunks_exact(2)
        .map(|c| u16::from_le_bytes([c[0], c[1]]))
        .take_while(|u| *u != 0)
        .collect();
    String::from_utf16(&units).ok()
}

/// Pull `"name"=dword:0000000f` out of virt-win-reg's .reg-format output.
fn parse_reg_dword(reg_output: &str, value: &str) -> Option<i64> {
    let needle = format!("\"{value}\"=dword:");
    reg_output.lines().find_map(|l| {
        let rest = l.trim().strip_prefix(needle.as_str())?;
        i64::from_str_radix(rest.trim(), 16).ok()
    })
}

/// Pull the path out of guestkit's "Backup created: /path" line.
fn parse_backup_path(out: &str) -> Option<String> {
    out.lines()
        .find_map(|l| l.trim().strip_prefix("Backup created:"))
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty())
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

/// Escape a string for a `.reg` `"name"="value"` line (backslashes + quotes).
fn escape_reg_sz(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

/// Build the textual `.reg` body merged via `virt-win-reg --merge`.
///
/// Kept separate so the merge payload is unit-testable without a disk image.
pub fn build_rdp_reg_merge(firewall_edits: &[(String, String)]) -> String {
    let mut body = String::from(
        "Windows Registry Editor Version 5.00\n\n\
         [HKEY_LOCAL_MACHINE\\SYSTEM\\ControlSet001\\Control\\Terminal Server]\n\
         \"fDenyTSConnections\"=dword:00000000\n\n\
         [HKEY_LOCAL_MACHINE\\SYSTEM\\ControlSet001\\Control\\Terminal Server\\WinStations\\RDP-Tcp]\n\
         \"UserAuthentication\"=dword:00000001\n",
    );
    if !firewall_edits.is_empty() {
        body.push_str(
            "\n[HKEY_LOCAL_MACHINE\\SYSTEM\\ControlSet001\\Services\\SharedAccess\\\
             Parameters\\FirewallPolicy\\FirewallRules]\n",
        );
        for (name, value) in firewall_edits {
            body.push_str(&format!(
                "\"{}\"=\"{}\"\n",
                escape_reg_sz(name),
                escape_reg_sz(value)
            ));
        }
    }
    body
}

/// Write the RDP registry values with `virt-win-reg --merge` (no full-disk backup).
fn merge_rdp_via_virt_win_reg(
    disk_path: &str,
    firewall_edits: &[(String, String)],
) -> Result<(), LibvirtError> {
    let reg_file = std::env::temp_dir().join(format!(
        "machina-rdp-merge-{}.reg",
        std::process::id()
    ));
    std::fs::write(&reg_file, build_rdp_reg_merge(firewall_edits))
        .map_err(|e| LibvirtError::Operation(format!("cannot write .reg merge file: {e}")))?;

    let out = Command::new("virt-win-reg")
        .arg("--merge")
        .arg(disk_path)
        .arg(&reg_file)
        .output();
    let _ = std::fs::remove_file(&reg_file);

    let out = out.map_err(|e| {
        LibvirtError::Operation(format!(
            "cannot run virt-win-reg: {e} — install libguestfs-tools on the hypervisor"
        ))
    })?;
    if out.status.success() {
        return Ok(());
    }
    let msg = {
        let stderr = String::from_utf8_lossy(&out.stderr);
        let stdout = String::from_utf8_lossy(&out.stdout);
        let combined = if stderr.trim().is_empty() {
            stdout.trim().to_string()
        } else {
            stderr.trim().to_string()
        };
        combined
    };
    // Dirty NTFS (fast startup / forced stop / Recovery) is the usual cause of
    // merge failures after a lab force-stop. Surface that explicitly.
    let dirty_hint = if msg.contains("unclean")
        || msg.contains("read-only")
        || msg.contains("Read-only")
        || msg.contains("hiber")
        || msg.contains("guestfs_launch failed")
    {
        " The guest NTFS volume may be dirty after a forced stop — boot Windows \
         and shut down cleanly (or clear the dirty flag with ntfsfix -d on the \
         offline volume), then retry."
    } else {
        ""
    };
    Err(LibvirtError::Operation(format!(
        "virt-win-reg --merge failed: {msg}.{dirty_hint}"
    )))
}

/// GuestKit `plan apply` fallback — slow on large Windows disks (full qcow2 copy).
fn apply_rdp_via_guestkit(
    disk_path: &str,
    guestkit_bin: &str,
    firewall_edits: &[(String, String)],
) -> Result<Option<String>, LibvirtError> {
    let generated = chrono::Utc::now().to_rfc3339();
    let plan = build_rdp_enable_plan(disk_path, &generated, firewall_edits);
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

    let guestkit_backup = parse_backup_path(&stdout).or_else(|| parse_backup_path(&stderr));
    let applied_count = parse_applied_count(&stdout).or_else(|| parse_applied_count(&stderr));
    match applied_count {
        Some(n) if n > 0 => Ok(guestkit_backup),
        Some(_) => Err(LibvirtError::Operation(format!(
            "guestkit applied 0 operations — the registry was not written. \
             If the guest filesystem mounted read-only, boot the VM and shut it \
             down cleanly from inside Windows (or run ntfsfix -d on the offline \
             volume), then retry. guestkit said: {}",
            stdout
                .lines()
                .find(|l| l.contains("failed:") || l.contains("Read-only"))
                .unwrap_or("(no detail)")
                .trim()
        ))),
        None => Err(LibvirtError::Operation(
            "guestkit exited 0 but reported no applied operations, so the registry \
             was not written. This build previews the plan without applying it; \
             upgrade guestkit or enable Remote Desktop inside the guest."
                .into(),
        )),
    }
}

fn rdp_outcome(
    disk_path: &str,
    firewall_edits: &[(String, String)],
    verified: Option<i64>,
    write_path: &str,
) -> RdpEnableOutcome {
    let mut notes = vec![
        format!("Registry written via {write_path}."),
        "Start the VM — Remote Desktop is now enabled in the registry.".to_string(),
        "Windows Home editions cannot host RDP regardless of this setting.".to_string(),
    ];
    if firewall_edits.is_empty() {
        notes.insert(
            0,
            "No inbound RDP firewall rule could be activated — open 'Remote Desktop' \
             in Windows Firewall inside the guest, or the port will still be dropped."
                .to_string(),
        );
    } else {
        notes.insert(
            0,
            format!(
                "Activated {} inbound RDP firewall rule(s): {}.",
                firewall_edits.len(),
                firewall_edits
                    .iter()
                    .map(|(n, _)| n.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            ),
        );
    }
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

    RdpEnableOutcome {
        disk_path: disk_path.to_string(),
        applied: vec![
            format!("{TS_KEY}\\{TS_VALUE} = 0"),
            format!("{NLA_KEY}\\UserAuthentication = 1"),
        ],
        firewall_manual: firewall_edits.is_empty(),
        notes,
    }
}

/// Apply RDP registry edits to `disk_path`. The VM **must be powered off** —
/// mutating a hive under a running guest risks corrupting it.
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

    // Read each inbound RDP firewall rule off the guest and flip Active=FALSE to
    // TRUE. Without this the Terminal Server service listens but the firewall
    // drops 3389, so a client times out instead of connecting — the symptom that
    // looks identical to "RDP is off".
    let mut firewall_edits: Vec<(String, String)> = Vec::new();
    for rule in FW_RDP_RULES {
        if let Some(current) = read_registry_string(disk_path, FW_RULES_KEY, rule) {
            if let Some(activated) = activate_firewall_rule(&current) {
                firewall_edits.push((rule.to_string(), activated));
            }
        }
    }

    // Prefer virt-win-reg --merge: verified on a 38 GiB win10 golden in ~30s.
    // GuestKit copies the whole disk first and routinely takes 30–60+ minutes on
    // the same image, and used to fill the hypervisor when backups piled up.
    let mut write_path = "virt-win-reg --merge";
    let mut guestkit_backup: Option<String> = None;
    if let Err(merge_err) = merge_rdp_via_virt_win_reg(disk_path, &firewall_edits) {
        write_path = "guestkit plan apply (virt-win-reg merge failed)";
        guestkit_backup = apply_rdp_via_guestkit(disk_path, guestkit_bin, &firewall_edits)
            .map_err(|gk| {
                LibvirtError::Operation(format!(
                    "{merge_err}; guestkit fallback also failed: {gk}"
                ))
            })?;
    }

    // Independent read-back — same tool as the merge path, different from GuestKit's
    // own success report (which has lied about writes more than once).
    let verified = read_registry_dword(disk_path, TS_KEY, TS_VALUE);
    if verified == Some(1) {
        return Err(LibvirtError::Operation(format!(
            "{write_path} reported success but {TS_VALUE} is still 1, so Remote Desktop \
             is still disabled. The write did not reach {TS_KEY}."
        )));
    }

    if verified == Some(0) {
        if let Some(ref b) = guestkit_backup {
            let _ = std::fs::remove_file(b);
        }
    }

    Ok(rdp_outcome(
        disk_path,
        &firewall_edits,
        verified,
        write_path,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reg_merge_body_sets_fdeny_and_nla() {
        let body = build_rdp_reg_merge(&[]);
        assert!(body.contains("\"fDenyTSConnections\"=dword:00000000"));
        assert!(body.contains("\"UserAuthentication\"=dword:00000001"));
        assert!(body.contains("ControlSet001\\Control\\Terminal Server"));
        assert!(!body.contains("CurrentControlSet"));
        assert!(!body.contains("FirewallRules"));
    }

    #[test]
    fn reg_merge_body_includes_firewall_string_edits() {
        let edits = vec![(
            "RemoteDesktop-UserMode-In-TCP".to_string(),
            r"v2.29|Active=TRUE|App=%SystemRoot%\system32\svchost.exe|".to_string(),
        )];
        let body = build_rdp_reg_merge(&edits);
        assert!(body.contains("FirewallRules"));
        assert!(body.contains("\"RemoteDesktop-UserMode-In-TCP\"="));
        // .reg doubles backslashes in the value.
        assert!(body.contains(r"\\system32\\svchost.exe"));
    }

    #[test]
    fn plan_matches_guestkit_fixplan_shape() {
        let p = build_rdp_enable_plan("/var/lib/libvirt/images/win10.qcow2", "2026-07-19T00:00:00Z", &[]);
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
    fn activates_only_a_recognisable_inactive_rule() {
        // The real rule string read off a Windows 10 image.
        let real = "v2.29|Action=Allow|Active=FALSE|Dir=In|Protocol=6|LPort=3389|App=%SystemRoot%\\system32\\svchost.exe|Svc=termservice|Name=@FirewallAPI.dll,-28775|";
        let out = activate_firewall_rule(real).expect("should activate");
        assert!(out.contains("Active=TRUE"));
        assert!(!out.contains("Active=FALSE"));
        // Everything else must survive verbatim — the schema version differs per
        // build, so reconstructing the rule would clobber the guest's own.
        assert!(out.contains("v2.29"));
        assert!(out.contains("LPort=3389"));
        assert!(out.contains("Svc=termservice"));

        // Already-enabled and unrecognised rules are left alone.
        assert!(activate_firewall_rule("v2.29|Action=Allow|Active=TRUE|LPort=3389|").is_none());
        assert!(activate_firewall_rule("something-else-entirely").is_none());
    }

    #[test]
    fn firewall_edits_become_string_operations_in_the_plan() {
        let edits = vec![(
            "RemoteDesktop-UserMode-In-TCP".to_string(),
            "v2.29|Active=TRUE|LPort=3389|".to_string(),
        )];
        let p = build_rdp_enable_plan("/x.qcow2", "2026-07-20T00:00:00Z", &edits);
        let ops = p["operations"].as_array().unwrap();
        let fw = ops.last().unwrap();
        assert_eq!(fw["data_type"], "String");
        assert_eq!(fw["value"], "RemoteDesktop-UserMode-In-TCP");
        assert!(fw["key"].as_str().unwrap().contains("FirewallRules"));
        assert!(fw["new_data"].as_str().unwrap().contains("Active=TRUE"));
    }

    #[test]
    fn parses_the_hex_encoded_form_virt_win_reg_actually_emits() {
        // Real output for RemoteDesktop-UserMode-In-TCP: "v2.29|Action=Allow|Active=FALSE|"
        // as NUL-terminated UTF-16LE. The firewall rules are always emitted this
        // way, so only handling the quoted form staged no firewall edits at all.
        let out = "\"RemoteDesktop-UserMode-In-TCP\"=hex(1):76,00,32,00,2e,00,32,00,39,00,7c,00,41,00,63,00,74,00,69,00,76,00,65,00,3d,00,46,00,41,00,4c,00,53,00,45,00,7c,00,00,00\n";
        let got = parse_reg_string(out, "RemoteDesktop-UserMode-In-TCP").expect("parsed");
        assert_eq!(got, "v2.29|Active=FALSE|");
        // And it must still round-trip through the activator.
        assert!(activate_firewall_rule(&got).unwrap().contains("Active=TRUE"));
    }

    #[test]
    fn parses_a_reg_string_value() {
        let out = "\"RemoteDesktop-UserMode-In-TCP\"=\"v2.29|Active=FALSE|App=%SystemRoot%\\\\system32\\\\svchost.exe|\"\n";
        let got = parse_reg_string(out, "RemoteDesktop-UserMode-In-TCP").expect("parsed");
        assert!(got.contains("Active=FALSE"));
        // .reg doubles backslashes; the stored value has single ones.
        assert!(got.contains(r"\system32\svchost.exe"));
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
        let p = build_rdp_enable_plan("/x.qcow2", "2026-07-20T00:00:00Z", &[]);
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
    fn finds_the_backup_path_to_reclaim() {
        let out = "Backup created: /var/lib/libvirt/images/win10.backup_20260720_140610.qcow2\n✓ Plan applied successfully\n  Operations applied: 1\n";
        assert_eq!(
            parse_backup_path(out).as_deref(),
            Some("/var/lib/libvirt/images/win10.backup_20260720_140610.qcow2")
        );
        // No backup line means nothing to reclaim — must not guess a path to delete.
        assert_eq!(parse_backup_path("Operations applied: 1\n"), None);
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
