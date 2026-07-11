// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use std::time::Duration;

use sqlx::SqlitePool;
use uuid::Uuid;

use crate::agent_client;
use crate::state::AppState;
use crate::tasks::enqueue::enqueue_task;

pub fn spawn(state: AppState) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(120));
        loop {
            interval.tick().await;
            if !state.leader.is_leader() {
                continue;
            }
            if let Err(e) = run_auto_migrate(&state).await {
                tracing::warn!("DRS auto-migrate: {e:#}");
            }
        }
    });
}

async fn run_auto_migrate(state: &AppState) -> anyhow::Result<()> {
    let Some(enabled): Option<bool> =
        sqlx::query_scalar("SELECT drs_auto_migrate FROM clusters ORDER BY created_at LIMIT 1")
            .fetch_optional(&state.pool)
            .await?
    else {
        return Ok(());
    };

    if !enabled {
        return Ok(());
    }

    let recs = crate::engine::placement::compute_recommendations(&state.pool).await?;
    if let Err(e) = crate::engine::placement::persist_recommendations(&state.pool, &recs).await {
        tracing::warn!("DRS: failed to persist placement recommendations: {e:#}");
    }

    // Hosts already receiving a migration in this pass. compute_recommendations
    // picks each hot VM's best destination independently, so several recs often
    // share the same coolest host. run_migrate_precheck reads DB metrics that
    // don't yet reflect an enqueued-but-not-started (slow, live) migration, so
    // without this guard DRS would pile 2-3 migrations onto one host in a single
    // tick and overcommit it — the exact anti-goal of DRS. Cap at one inbound
    // migration per destination per pass; the next tick reconsiders.
    let mut targeted_dests: std::collections::HashSet<Uuid> = std::collections::HashSet::new();

    for rec in recs.into_iter().take(3) {
        if rec.score < 20.0 {
            continue;
        }
        let (vm_id, dest_id) = match (Uuid::parse_str(&rec.vm_id), Uuid::parse_str(&rec.to_host_id)) {
            (Ok(v), Ok(d)) => (v, d),
            _ => {
                tracing::warn!(vm_id = %rec.vm_id, "DRS: malformed UUID in recommendation, skipping");
                continue;
            }
        };

        if targeted_dests.contains(&dest_id) {
            continue;
        }

        // Skip if a migration for this VM is already pending/running. DRS re-runs
        // every 120s against metrics that don't change until the (slow) live
        // migration completes, so it would otherwise re-select the same VM and
        // enqueue duplicate, competing migrations. Mirrors reconcile's guard.
        let inflight: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM tasks WHERE resource_id = ? AND operation = 'vm.migrate' AND status IN ('pending', 'running')",
        )
        .bind(vm_id)
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);
        if inflight > 0 {
            continue;
        }

        let pre = crate::engine::migrate_precheck::run_migrate_precheck(
            &state.pool,
            vm_id,
            dest_id,
            true,
        )
        .await?;
        if !pre.ok {
            continue;
        }

        let source_host: Option<Uuid> = sqlx::query_scalar("SELECT host_id FROM vms WHERE id = ?")
            .bind(vm_id)
            .fetch_optional(&state.pool)
            .await?
            .flatten();

        targeted_dests.insert(dest_id);
        if let Err(e) = enqueue_task(
            state,
            "vm.migrate",
            serde_json::json!({
                "vm_id": rec.vm_id,
                "dest_host_id": rec.to_host_id,
                "live": true,
                "drs": true,
                // The VM is being rebalanced off this host; undefine the source on
                // success so it isn't left persistently defined (and autostart-able)
                // on both hosts — the standard live-migration semantics.
                "undefine_source": true,
            }),
            Some("vm"),
            Some(vm_id),
            source_host,
        )
        .await
        {
            tracing::warn!(vm_id = %rec.vm_id, "DRS: failed to enqueue vm.migrate task: {e:?}");
        }

        state.emit_event(
            "drs.migrate",
            format!("Auto-migrating {} → {}", rec.vm_name, rec.to_host_name),
        );
    }
    Ok(())
}

pub async fn get_cluster_settings(pool: &SqlitePool) -> anyhow::Result<ClusterSettings> {
    sqlx::query_as(
        "SELECT drs_auto_migrate, drs_cpu_threshold, ha_enabled, ha_allow_unfenced_recovery,
                placement_policy,
                inventory_sync_interval_secs, require_vm_delete_approval,
                firewall_approval_sla_hours,
                finops_vcpu_hour_usd, finops_gib_hour_usd
         FROM clusters ORDER BY created_at LIMIT 1",
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| anyhow::anyhow!("no cluster configured — run machina-controller bootstrap"))
}

pub async fn get_inventory_sync_interval_secs(pool: &SqlitePool) -> anyhow::Result<i32> {
    sqlx::query_scalar(
        "SELECT inventory_sync_interval_secs FROM clusters ORDER BY created_at LIMIT 1",
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| anyhow::anyhow!("no cluster configured — run machina-controller bootstrap"))
}

pub async fn update_cluster_settings(
    pool: &SqlitePool,
    settings: &ClusterSettingsPatch,
) -> anyhow::Result<()> {
    let cluster_id: Option<uuid::Uuid> =
        sqlx::query_scalar("SELECT id FROM clusters ORDER BY created_at LIMIT 1")
            .fetch_optional(pool)
            .await?;
    let Some(cluster_id) = cluster_id else {
        return Ok(());
    };
    let mut tx = pool.begin().await?;
    if let Some(v) = settings.drs_auto_migrate {
        sqlx::query("UPDATE clusters SET drs_auto_migrate = ? WHERE id = ?")
            .bind(v)
            .bind(cluster_id)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(v) = settings.drs_cpu_threshold {
        sqlx::query("UPDATE clusters SET drs_cpu_threshold = ? WHERE id = ?")
            .bind(v)
            .bind(cluster_id)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(v) = settings.ha_enabled {
        sqlx::query("UPDATE clusters SET ha_enabled = ? WHERE id = ?")
            .bind(v)
            .bind(cluster_id)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(v) = settings.ha_allow_unfenced_recovery {
        sqlx::query("UPDATE clusters SET ha_allow_unfenced_recovery = ? WHERE id = ?")
            .bind(v)
            .bind(cluster_id)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(v) = &settings.placement_policy {
        sqlx::query("UPDATE clusters SET placement_policy = ? WHERE id = ?")
            .bind(v)
            .bind(cluster_id)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(v) = settings.inventory_sync_interval_secs {
        sqlx::query("UPDATE clusters SET inventory_sync_interval_secs = ? WHERE id = ?")
            .bind(v.clamp(0, 86400))
            .bind(cluster_id)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(v) = settings.require_vm_delete_approval {
        sqlx::query("UPDATE clusters SET require_vm_delete_approval = ? WHERE id = ?")
            .bind(v)
            .bind(cluster_id)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(v) = settings.firewall_approval_sla_hours {
        sqlx::query("UPDATE clusters SET firewall_approval_sla_hours = ? WHERE id = ?")
            .bind(v.clamp(1, 720))
            .bind(cluster_id)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(v) = settings.finops_vcpu_hour_usd {
        sqlx::query("UPDATE clusters SET finops_vcpu_hour_usd = ? WHERE id = ?")
            .bind(v)
            .bind(cluster_id)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(v) = settings.finops_gib_hour_usd {
        sqlx::query("UPDATE clusters SET finops_gib_hour_usd = ? WHERE id = ?")
            .bind(v)
            .bind(cluster_id)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(())
}

#[derive(Debug, Clone, serde::Serialize, sqlx::FromRow)]
pub struct ClusterSettings {
    pub drs_auto_migrate: bool,
    pub drs_cpu_threshold: f32,
    pub ha_enabled: bool,
    pub ha_allow_unfenced_recovery: bool,
    pub placement_policy: String,
    pub inventory_sync_interval_secs: i32,
    pub require_vm_delete_approval: bool,
    pub firewall_approval_sla_hours: i32,
    pub finops_vcpu_hour_usd: f64,
    pub finops_gib_hour_usd: f64,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ClusterSettingsPatch {
    pub drs_auto_migrate: Option<bool>,
    pub drs_cpu_threshold: Option<f32>,
    pub ha_enabled: Option<bool>,
    /// Opt out of the fail-safe fence-before-recover guard (non-shared storage only).
    pub ha_allow_unfenced_recovery: Option<bool>,
    pub placement_policy: Option<String>,
    pub inventory_sync_interval_secs: Option<i32>,
    pub require_vm_delete_approval: Option<bool>,
    pub firewall_approval_sla_hours: Option<i32>,
    pub finops_vcpu_hour_usd: Option<f64>,
    pub finops_gib_hour_usd: Option<f64>,
}

/// Fence (power-isolate) a host so its VMs can be safely recovered elsewhere.
///
/// STONITH ("shoot the other node in the head") MUST originate from the controller,
/// not the failed host's own agent: a dead or network-partitioned host has an
/// unreachable agent, so routing the fence through it means the one host we most
/// need to isolate can never be fenced — the previous behavior. For IPMI we talk
/// to the host's BMC directly from here (works regardless of host liveness). The
/// agent shell path remains only as a best-effort fallback for a host whose agent
/// is still reachable (e.g. a wedged service on a live box).
pub async fn fence_host(state: &AppState, host_id: Uuid) -> anyhow::Result<bool> {
    let (hostname, agent_addr, method, ipmi_addr, ipmi_user, ipmi_pass): (
        String,
        String,
        String,
        String,
        String,
        String,
    ) = sqlx::query_as(
        "SELECT hostname, agent_grpc_addr, COALESCE(fence_method, 'shell'), COALESCE(ipmi_address, ''),
                COALESCE(ipmi_username, ''), COALESCE(ipmi_password, '') FROM hosts WHERE id = ?",
    )
    .bind(host_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| anyhow::anyhow!("host {} not found — may have been removed while HA was scanning", host_id))?;

    let (action, command, result): (&str, String, anyhow::Result<String>) =
        if method == "ipmi" && !ipmi_addr.is_empty() {
            // Controller -> BMC. Works even if the host itself is dead.
            let command = format!("ipmitool -I lanplus -H {ipmi_addr} -U {ipmi_user} -E power off");
            let result = fence_ipmi_from_controller(&ipmi_addr, &ipmi_user, &ipmi_pass).await;
            ("ipmi-fence", command, result)
        } else {
            // Fallback: the operator-configured shell fence, executed by the host's
            // own agent. Only succeeds if that agent is still reachable.
            let shell_cmd = std::env::var("MACHINA_FENCE_COMMAND").unwrap_or_default();
            let result =
                fence_via_agent(&agent_addr, &hostname, &method, &ipmi_addr, &ipmi_user, &ipmi_pass, &shell_cmd)
                    .await;
            ("fence", shell_cmd, result)
        };

    let ok = result.is_ok();
    let message = match &result {
        Ok(m) => m.clone(),
        Err(e) => format!("{e:#}"),
    };

    sqlx::query(
        "INSERT INTO fence_events (id, host_id, action, command, success, message)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(Uuid::new_v4())
    .bind(host_id)
    .bind(action)
    .bind(&command)
    .bind(ok)
    .bind(&message)
    .execute(&state.pool)
    .await?;

    if ok {
        sqlx::query("UPDATE hosts SET fenced = TRUE WHERE id = ?")
            .bind(host_id)
            .execute(&state.pool)
            .await?;
    }
    Ok(ok)
}

/// Power off a host via its BMC, executed from the controller (not the host).
async fn fence_ipmi_from_controller(address: &str, user: &str, pass: &str) -> anyhow::Result<String> {
    if address.is_empty() || user.is_empty() {
        anyhow::bail!("IPMI address and username are required for controller-side fencing");
    }
    // Password via IPMI_PASSWORD env (`-E`), never on argv where `ps`/proc would leak it.
    let out = tokio::process::Command::new("ipmitool")
        .args(["-I", "lanplus", "-H", address, "-U", user, "-E", "power", "off"])
        .env("IPMI_PASSWORD", pass)
        .output()
        .await
        .map_err(|e| {
            anyhow::anyhow!("ipmitool exec failed (is it installed on the controller host?): {e}")
        })?;
    if out.status.success() {
        Ok(format!("IPMI power off {address} (from controller)"))
    } else {
        anyhow::bail!("ipmitool failed: {}", String::from_utf8_lossy(&out.stderr).trim());
    }
}

/// Best-effort fence via the host's own agent (only works if the agent is reachable).
async fn fence_via_agent(
    agent_addr: &str,
    hostname: &str,
    method: &str,
    ipmi_addr: &str,
    ipmi_user: &str,
    ipmi_pass: &str,
    shell_cmd: &str,
) -> anyhow::Result<String> {
    let mut client = tokio::time::timeout(
        std::time::Duration::from_secs(8),
        agent_client::connect(agent_addr),
    )
    .await
    .map_err(|_| {
        anyhow::anyhow!(
            "agent on {agent_addr} unreachable; configure IPMI/BMC fencing (fence_method='ipmi' + \
             ipmi_address) so an unresponsive host can be isolated from the controller"
        )
    })??;
    let resp = agent_client::fence_host(
        &mut client, hostname, method, ipmi_addr, ipmi_user, ipmi_pass, shell_cmd,
    )
    .await?;
    if resp.ok {
        Ok(resp.message)
    } else {
        anyhow::bail!("agent fence reported failure: {}", resp.message);
    }
}
