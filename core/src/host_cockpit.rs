// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
//! Cockpit-aligned host inventory: block storage stack, NetworkManager, system modules.

use serde::{Deserialize, Serialize};
#[cfg(target_os = "linux")]
use std::process::{Command, Output, Stdio};

use crate::LibvirtError;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HostCockpitStorage {
    pub probed: bool,
    pub mdraid: Vec<StorageLineItem>,
    pub luks: Vec<StorageLineItem>,
    pub lvm: Vec<StorageLineItem>,
    pub stratis: Vec<StorageLineItem>,
    pub vdo: Vec<StorageLineItem>,
    pub multipath: Vec<StorageLineItem>,
    pub iscsi: Vec<StorageLineItem>,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StorageLineItem {
    pub name: String,
    pub detail: String,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HostCockpitNetwork {
    pub probed: bool,
    pub connections: Vec<NmConnection>,
    pub bonds: Vec<NmConnection>,
    pub teams: Vec<NmConnection>,
    pub bridges: Vec<NmConnection>,
    pub vlans: Vec<NmConnection>,
    pub wifi: Vec<NmConnection>,
    pub wireguard: Vec<NmConnection>,
    pub firewalld: FirewalldState,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NmConnection {
    pub name: String,
    pub uuid: String,
    pub kind: String,
    pub device: String,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FirewalldState {
    pub available: bool,
    pub running: bool,
    pub default_zone: String,
    pub zones: Vec<FirewalldZone>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FirewalldZone {
    pub name: String,
    pub target: String,
    pub services: Vec<String>,
    pub ports: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HostCockpitSystem {
    pub probed: bool,
    pub kdump: ModuleProbe,
    pub selinux: SelinuxState,
    pub tuned: TunedState,
    pub realmd: ModuleProbe,
    pub systemd_failed: u32,
    pub systemd_units: Vec<SystemdUnitRow>,
    pub journal_errors_1h: u32,
    pub journal_recent: Vec<String>,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SystemdUnitRow {
    pub unit: String,
    pub load: String,
    pub active: String,
    pub sub: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ModuleProbe {
    pub available: bool,
    pub active: bool,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SelinuxState {
    pub available: bool,
    pub mode: String,
    pub enforce_supported: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TunedState {
    pub available: bool,
    pub active_profile: String,
    pub recommended_profile: String,
    pub profiles: Vec<String>,
}

#[cfg(target_os = "linux")]
fn run_cmd(bin: &str, args: &[&str]) -> Option<Output> {
    Command::new(bin)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .ok()
}

#[cfg(target_os = "linux")]
fn stdout_lines(out: &Output) -> Vec<String> {
    String::from_utf8_lossy(&out.stdout)
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect()
}

#[cfg(not(target_os = "linux"))]
pub fn storage_inventory() -> Result<HostCockpitStorage, LibvirtError> {
    Ok(HostCockpitStorage {
        summary: "Host block storage inventory requires Linux".into(),
        ..Default::default()
    })
}

#[cfg(target_os = "linux")]
pub fn storage_inventory() -> Result<HostCockpitStorage, LibvirtError> {
    let mut out = HostCockpitStorage {
        probed: true,
        ..Default::default()
    };

    if let Some(o) = run_cmd("mdadm", &["--detail", "--scan"]) {
        if o.status.success() {
            for line in stdout_lines(&o) {
                out.mdraid.push(StorageLineItem {
                    name: line.clone(),
                    detail: "mdadm array".into(),
                    state: "present".into(),
                });
            }
        }
    }
    if let Some(o) = run_cmd("lsblk", &["-J", "-o", "NAME,TYPE,FSTYPE,SIZE,MOUNTPOINT"]) {
        if o.status.success() {
            if let Ok(v) = serde_json::from_slice::<serde_json::Value>(&o.stdout) {
                walk_lsblk(&v, &mut out);
            }
        }
    }
    if let Some(o) = run_cmd("lvs", &["--noheadings", "-o", "vg_name,lv_name,lv_size,lv_attr"]) {
        if o.status.success() {
            for line in stdout_lines(&o) {
                let cols: Vec<&str> = line.split_whitespace().collect();
                if cols.len() >= 4 {
                    out.lvm.push(StorageLineItem {
                        name: format!("{}/{}", cols[0], cols[1]),
                        detail: cols[2].to_string(),
                        state: cols[3].to_string(),
                    });
                }
            }
        }
    }
    if let Some(o) = run_cmd("stratis", &["pool", "list"]) {
        if o.status.success() {
            for (i, line) in stdout_lines(&o).into_iter().enumerate() {
                if i == 0 && line.to_ascii_lowercase().contains("name") {
                    continue;
                }
                out.stratis.push(StorageLineItem {
                    name: line.split_whitespace().next().unwrap_or("pool").into(),
                    detail: line,
                    state: "active".into(),
                });
            }
        }
    }
    if let Some(o) = run_cmd("vdostats", &["--human-readable"]) {
        if o.status.success() {
            for (i, line) in stdout_lines(&o).into_iter().enumerate() {
                if i == 0 {
                    continue;
                }
                out.vdo.push(StorageLineItem {
                    name: line.split_whitespace().next().unwrap_or("vdo").into(),
                    detail: line,
                    state: "active".into(),
                });
            }
        }
    }
    if let Some(o) = run_cmd("multipath", &["-ll"]) {
        if o.status.success() {
            for line in stdout_lines(&o) {
                if line.starts_with("mpath") || line.contains(" dm-") {
                    out.multipath.push(StorageLineItem {
                        name: line.split_whitespace().next().unwrap_or("mpath").into(),
                        detail: line,
                        state: "active".into(),
                    });
                }
            }
        }
    }
    if let Some(o) = run_cmd("iscsiadm", &["-m", "session"]) {
        if o.status.success() {
            for line in stdout_lines(&o) {
                out.iscsi.push(StorageLineItem {
                    name: line.clone(),
                    detail: "iSCSI session".into(),
                    state: "logged_in".into(),
                });
            }
        }
    }

    out.summary = format!(
        "RAID {} · LUKS {} · LVM {} · Stratis {} · VDO {} · multipath {} · iSCSI {}",
        out.mdraid.len(),
        out.luks.len(),
        out.lvm.len(),
        out.stratis.len(),
        out.vdo.len(),
        out.multipath.len(),
        out.iscsi.len()
    );
    Ok(out)
}

#[cfg(target_os = "linux")]
fn walk_lsblk(v: &serde_json::Value, out: &mut HostCockpitStorage) {
    let Some(devs) = v.pointer("/blockdevices").and_then(|b| b.as_array()) else {
        return;
    };
    fn walk(node: &serde_json::Value, out: &mut HostCockpitStorage) {
        let name = node.get("name").and_then(|n| n.as_str()).unwrap_or("");
        let fstype = node.get("fstype").and_then(|n| n.as_str()).unwrap_or("");
        if fstype.eq_ignore_ascii_case("crypto_LUKS") {
            out.luks.push(StorageLineItem {
                name: name.into(),
                detail: format!("{} · {}", fstype, node.get("size").and_then(|s| s.as_str()).unwrap_or("")),
                state: "encrypted".into(),
            });
        }
        if let Some(children) = node.get("children").and_then(|c| c.as_array()) {
            for c in children {
                walk(c, out);
            }
        }
    }
    for d in devs {
        walk(d, out);
    }
}

#[cfg(not(target_os = "linux"))]
pub fn network_inventory() -> Result<HostCockpitNetwork, LibvirtError> {
    Ok(HostCockpitNetwork {
        summary: "Network inventory requires Linux".into(),
        ..Default::default()
    })
}

#[cfg(target_os = "linux")]
pub fn network_inventory() -> Result<HostCockpitNetwork, LibvirtError> {
    let mut out = HostCockpitNetwork {
        probed: true,
        ..Default::default()
    };
    if let Some(o) = run_cmd("nmcli", &["-t", "-f", "NAME,UUID,TYPE,DEVICE,STATE", "con", "show"]) {
        if o.status.success() {
            for line in stdout_lines(&o) {
                let parts: Vec<&str> = line.split(':').collect();
                if parts.len() < 5 {
                    continue;
                }
                let conn = NmConnection {
                    name: parts[0].into(),
                    uuid: parts[1].into(),
                    kind: parts[2].into(),
                    device: parts[3].into(),
                    state: parts[4].into(),
                };
                out.connections.push(conn.clone());
                let kind = conn.kind.to_ascii_lowercase();
                if kind.contains("bond") {
                    out.bonds.push(conn.clone());
                } else if kind.contains("team") {
                    out.teams.push(conn.clone());
                } else if kind.contains("bridge") {
                    out.bridges.push(conn.clone());
                } else if kind.contains("vlan") {
                    out.vlans.push(conn.clone());
                } else if kind.contains("wifi") || kind.contains("802-11") {
                    out.wifi.push(conn.clone());
                } else if kind.contains("wireguard") {
                    out.wireguard.push(conn.clone());
                }
            }
        }
    }
    out.firewalld = firewalld_state();
    out.summary = format!(
        "{} NM connection(s) · {} bond(s) · {} bridge(s) · firewalld {}",
        out.connections.len(),
        out.bonds.len(),
        out.bridges.len(),
        if out.firewalld.running { "active" } else { "inactive" }
    );
    Ok(out)
}

#[cfg(target_os = "linux")]
fn firewalld_state() -> FirewalldState {
    let mut st = FirewalldState::default();
    let Some(o) = run_cmd("firewall-cmd", &["--state"]) else {
        return st;
    };
    st.available = true;
    st.running = o.status.success();
    if !st.running {
        return st;
    }
    if let Some(o) = run_cmd("firewall-cmd", &["--get-default-zone"]) {
        st.default_zone = String::from_utf8_lossy(&o.stdout).trim().to_string();
    }
    if let Some(o) = run_cmd("firewall-cmd", &["--get-zones"]) {
        for zone in String::from_utf8_lossy(&o.stdout).split_whitespace() {
            let mut z = FirewalldZone {
                name: zone.to_string(),
                ..Default::default()
            };
            if let Some(t) = run_cmd("firewall-cmd", &["--permanent", "--zone", zone, "--get-target"]) {
                z.target = String::from_utf8_lossy(&t.stdout).trim().to_string();
            }
            if let Some(s) = run_cmd("firewall-cmd", &["--permanent", "--zone", zone, "--list-services"]) {
                z.services = String::from_utf8_lossy(&s.stdout)
                    .split_whitespace()
                    .map(str::to_string)
                    .collect();
            }
            if let Some(p) = run_cmd("firewall-cmd", &["--permanent", "--zone", zone, "--list-ports"]) {
                z.ports = String::from_utf8_lossy(&p.stdout)
                    .split_whitespace()
                    .map(str::to_string)
                    .collect();
            }
            st.zones.push(z);
        }
    }
    st
}

#[cfg(not(target_os = "linux"))]
pub fn system_inventory() -> Result<HostCockpitSystem, LibvirtError> {
    Ok(HostCockpitSystem {
        summary: "System modules inventory requires Linux".into(),
        ..Default::default()
    })
}

#[cfg(target_os = "linux")]
pub fn system_inventory() -> Result<HostCockpitSystem, LibvirtError> {
    let mut out = HostCockpitSystem {
        probed: true,
        ..Default::default()
    };

    out.kdump = probe_unit("kdump.service", "Kernel crash dump");
    if let Some(o) = run_cmd("getenforce", &[]) {
        out.selinux.available = true;
        out.selinux.mode = String::from_utf8_lossy(&o.stdout).trim().to_string();
        out.selinux.enforce_supported = path_exists("/usr/sbin/setenforce");
    }
    if path_exists("/usr/sbin/tuned-adm") {
        out.tuned.available = true;
        if let Some(o) = run_cmd("tuned-adm", &["active"]) {
            out.tuned.active_profile = String::from_utf8_lossy(&o.stdout).trim().to_string();
        }
        if let Some(o) = run_cmd("tuned-adm", &["recommend"]) {
            out.tuned.recommended_profile = String::from_utf8_lossy(&o.stdout).trim().to_string();
        }
        if let Some(o) = run_cmd("tuned-adm", &["list"]) {
            out.tuned.profiles = stdout_lines(&o);
        }
    }
    out.realmd = probe_unit("realmd.service", "Active Directory / IPA domain join");
    if let Some(o) = run_cmd("systemctl", &["--failed", "--no-legend", "--no-pager"]) {
        out.systemd_failed = stdout_lines(&o).len() as u32;
    }
    if let Some(o) = run_cmd("systemctl", &["list-units", "--type=service", "--no-pager", "--no-legend", "--all"]) {
        for line in stdout_lines(&o).into_iter().take(40) {
            let cols: Vec<&str> = line.split_whitespace().collect();
            if cols.len() >= 5 {
                out.systemd_units.push(SystemdUnitRow {
                    unit: cols[0].into(),
                    load: cols[1].into(),
                    active: cols[2].into(),
                    sub: cols[3].into(),
                    description: cols[4..].join(" "),
                });
            }
        }
    }
    if let Some(o) = run_cmd("journalctl", &["-p", "err", "--since", "1 hour ago", "--no-pager", "-q"]) {
        let lines = stdout_lines(&o);
        out.journal_errors_1h = lines.len() as u32;
        out.journal_recent = lines.into_iter().take(12).collect();
    }
    out.summary = format!(
        "kdump {} · SELinux {} · tuned {} · {} failed unit(s) · {} journal error(s)/1h",
        if out.kdump.active { "active" } else { "inactive" },
        out.selinux.mode,
        if out.tuned.active_profile.is_empty() {
            "n/a"
        } else {
            out.tuned.active_profile.as_str()
        },
        out.systemd_failed,
        out.journal_errors_1h
    );
    Ok(out)
}

#[cfg(target_os = "linux")]
fn path_exists(p: &str) -> bool {
    std::path::Path::new(p).exists()
}

#[cfg(not(target_os = "linux"))]
fn path_exists(_p: &str) -> bool {
    false
}

#[cfg(target_os = "linux")]
fn probe_unit(unit: &str, label: &str) -> ModuleProbe {
    let mut m = ModuleProbe {
        available: path_exists("/usr/bin/systemctl") || path_exists("/bin/systemctl"),
        ..Default::default()
    };
    if let Some(o) = run_cmd("systemctl", &["is-active", unit]) {
        m.active = o.status.success();
        m.summary = format!("{label}: {}", if m.active { "active" } else { "inactive" });
    }
    m
}

#[cfg(target_os = "linux")]
pub fn firewalld_add_service(zone: &str, service: &str) -> Result<String, LibvirtError> {
    let zone = if zone.trim().is_empty() {
        "public"
    } else {
        zone.trim()
    };
    let o = run_cmd("firewall-cmd", &["--permanent", "--zone", zone, "--add-service", service])
        .ok_or_else(|| LibvirtError::Operation("firewall-cmd unavailable".into()))?;
    if !o.status.success() {
        return Err(LibvirtError::Operation(format!(
            "firewall-cmd add-service: {}",
            String::from_utf8_lossy(&o.stderr).trim()
        )));
    }
    let _ = run_cmd("firewall-cmd", &["--reload"]);
    Ok(format!("Added service {service} to zone {zone}"))
}

#[cfg(not(target_os = "linux"))]
pub fn firewalld_add_service(_zone: &str, _service: &str) -> Result<String, LibvirtError> {
    Err(LibvirtError::Operation("firewalld requires Linux".into()))
}

#[cfg(target_os = "linux")]
pub fn selinux_set_enforce(enforcing: bool) -> Result<String, LibvirtError> {
    let arg = if enforcing { "1" } else { "0" };
    let o = run_cmd("setenforce", &[arg])
        .ok_or_else(|| LibvirtError::Operation("setenforce unavailable".into()))?;
    if !o.status.success() {
        return Err(LibvirtError::Operation(format!(
            "setenforce: {}",
            String::from_utf8_lossy(&o.stderr).trim()
        )));
    }
    Ok(format!("SELinux set to {}", if enforcing { "Enforcing" } else { "Permissive" }))
}

#[cfg(not(target_os = "linux"))]
pub fn selinux_set_enforce(_enforcing: bool) -> Result<String, LibvirtError> {
    Err(LibvirtError::Operation("SELinux requires Linux".into()))
}

#[cfg(target_os = "linux")]
pub fn tuned_set_profile(profile: &str) -> Result<String, LibvirtError> {
    let o = run_cmd("tuned-adm", &["profile", profile])
        .ok_or_else(|| LibvirtError::Operation("tuned-adm unavailable".into()))?;
    if !o.status.success() {
        return Err(LibvirtError::Operation(format!(
            "tuned-adm: {}",
            String::from_utf8_lossy(&o.stderr).trim()
        )));
    }
    Ok(format!("Tuned profile set to {profile}"))
}

#[cfg(not(target_os = "linux"))]
pub fn tuned_set_profile(_profile: &str) -> Result<String, LibvirtError> {
    Err(LibvirtError::Operation("Tuned requires Linux".into()))
}

#[cfg(target_os = "linux")]
pub fn nm_create_bond(name: &str, ifaces: &[String]) -> Result<String, LibvirtError> {
    if ifaces.len() < 2 {
        return Err(LibvirtError::Invalid("bond requires at least two interfaces".into()));
    }
    let args = ["con", "add", "type", "bond", "con-name", name, "ifname", name, "mode", "802.3ad"];
    let o = run_cmd("nmcli", &args)
        .ok_or_else(|| LibvirtError::Operation("nmcli unavailable".into()))?;
    if !o.status.success() {
        return Err(LibvirtError::Operation(format!(
            "nmcli bond: {}",
            String::from_utf8_lossy(&o.stderr).trim()
        )));
    }
    for iface in ifaces {
        let slave_args = [
            "con", "add", "type", "bond-slave", "ifname", iface, "master", name, "con-name", &format!("{name}-{iface}"),
        ];
        let _ = run_cmd("nmcli", &slave_args);
    }
    let _ = run_cmd("nmcli", &["con", "up", name]);
    Ok(format!("Created bond {name} with {} slave(s)", ifaces.len()))
}

#[cfg(not(target_os = "linux"))]
pub fn nm_create_bond(_name: &str, _ifaces: &[String]) -> Result<String, LibvirtError> {
    Err(LibvirtError::Operation("NetworkManager requires Linux".into()))
}
