// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Push PacketWolf security bundles to machina-agent during inventory and tasks.

use sqlx::PgPool;
use uuid::Uuid;

use crate::agent_client;
use crate::config::ControllerConfig;
use crate::engine::packetwolf_bridge;

fn bundle_has_work(bundle: &serde_json::Value) -> bool {
    let has_policies = bundle
        .get("tracing_policies")
        .and_then(|v| v.as_array())
        .is_some_and(|a| !a.is_empty());
    let has_install = bundle
        .get("tetragon_install")
        .map(|v| !v.is_null())
        .unwrap_or(false);
    has_policies || has_install
}

/// Pull the agent bundle from PacketWolf and apply TracingPolicy files on the host.
pub async fn sync_host_security_bundle(
    cfg: &ControllerConfig,
    host_id: Uuid,
    agent_addr: &str,
) -> anyhow::Result<()> {
    if !cfg.packetwolf_enabled {
        return Ok(());
    }
    let host_id_str = host_id.to_string();
    let bundle = packetwolf_bridge::agent_bundle(cfg, &host_id_str).await;
    if !bundle_has_work(&bundle) {
        return Ok(());
    }
    let bundle_json = serde_json::to_string(&bundle)?;
    match agent_client::apply_security_bundle(agent_addr, &bundle_json, false).await {
        Ok(result) if result.ok => {
            let _ = packetwolf_bridge::ack_agent_bundle(cfg, &host_id_str).await;
            tracing::info!(
                %host_id,
                policies = result.policies_written,
                tetragon = result.tetragon_binary_found,
                "security bundle applied on agent"
            );
        }
        Ok(result) => {
            tracing::warn!(%host_id, message = %result.message, "security bundle apply returned not ok");
        }
        Err(e) => {
            tracing::debug!(%host_id, "security bundle sync skipped: {e:#}");
        }
    }
    Ok(())
}

/// Apply bundles for all online hosts (maintenance / operator trigger).
pub async fn sync_all_online(pool: &PgPool, cfg: &ControllerConfig) -> anyhow::Result<usize> {
    let hosts: Vec<(Uuid, String)> = sqlx::query_as(
        "SELECT id, agent_grpc_addr FROM hosts WHERE state = 'online' ORDER BY hostname",
    )
    .fetch_all(pool)
    .await?;

    let mut synced = 0usize;
    for (host_id, addr) in hosts {
        if sync_host_security_bundle(cfg, host_id, &addr).await.is_ok() {
            synced += 1;
        }
    }
    Ok(synced)
}
