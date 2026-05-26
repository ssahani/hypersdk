//! Aggregated guest health: libvirt state + QEMU agent + VM metrics.

use virt::connect::Connect;

use super::domain;
use super::guest_agent::{self, GuestInfo};
use super::metrics;
use crate::state::VmMetrics;
use crate::LibvirtError;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuestHealthReport {
    pub vm_name: String,
    pub state: String,
    pub agent_reachable: bool,
    pub metrics_available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metrics: Option<VmMetrics>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub guest: Option<GuestInfo>,
    pub issues: Vec<String>,
    pub healthy: bool,
}

pub fn gather_guest_health(conn: &Connect, name: &str) -> Result<GuestHealthReport, LibvirtError> {
    let details = domain::get_vm_details(conn, name)?;
    let state = details.state.clone();
    let running = state.eq_ignore_ascii_case("running");

    let guest = guest_agent::get_guest_observability(conn, name).ok();
    let agent_reachable = guest
        .as_ref()
        .map(|g| {
            !g.hostname.is_empty()
                || !g.ip_addresses.is_empty()
                || !g.filesystems.is_empty()
        })
        .unwrap_or(false);

    let metrics = if running {
        metrics::get_vm_metrics(conn, name).ok()
    } else {
        None
    };
    let metrics_available = metrics.is_some();

    let mut issues = Vec::new();
    if running && !agent_reachable {
        issues.push("qemu-guest-agent unreachable or not reporting".into());
    }
    if let Some(m) = &metrics {
        if m.memory_pct >= 95.0 {
            issues.push(format!("memory utilization {:.0}%", m.memory_pct));
        }
    }
    if let Some(g) = &guest {
        for fs in &g.filesystems {
            if fs.total_bytes > 0 {
                let pct = (fs.used_bytes as f64 / fs.total_bytes as f64) * 100.0;
                if pct >= 90.0 {
                    issues.push(format!("guest filesystem {} {:.0}% full", fs.mountpoint, pct));
                }
            }
        }
    }
    if !running {
        issues.push(format!("VM is {state}"));
    }

    let healthy = running && agent_reachable && issues.is_empty();

    Ok(GuestHealthReport {
        vm_name: name.to_string(),
        state,
        agent_reachable,
        metrics_available,
        metrics,
        guest,
        issues,
        healthy,
    })
}
