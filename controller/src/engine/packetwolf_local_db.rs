// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// PostgreSQL persistence for controller-local PacketWolf fabric state.

use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::PgPool;

use crate::engine::packetwolf_local;

pub async fn hydrate(pool: &PgPool) -> anyhow::Result<()> {
    let rows: Vec<(String, String, String, DateTime<Utc>, Option<DateTime<Utc>>, Option<Value>)> =
        sqlx::query_as(
            "SELECT host_id, status, tetragon_version, registered_at, last_event_at, pending_tetragon
             FROM packetwolf_local_sensors",
        )
        .fetch_all(pool)
        .await?;
    packetwolf_local::load_from_rows(rows);
    Ok(())
}

pub async fn upsert_sensor(
    pool: &PgPool,
    host_id: &str,
    status: &str,
    tetragon_version: &str,
    pending: Option<&Value>,
) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO packetwolf_local_sensors (host_id, status, tetragon_version, registered_at, pending_tetragon)
         VALUES ($1, $2, $3, NOW(), $4)
         ON CONFLICT (host_id) DO UPDATE SET
           status = EXCLUDED.status,
           tetragon_version = EXCLUDED.tetragon_version,
           registered_at = packetwolf_local_sensors.registered_at,
           pending_tetragon = COALESCE(EXCLUDED.pending_tetragon, packetwolf_local_sensors.pending_tetragon)",
    )
    .bind(host_id)
    .bind(status)
    .bind(tetragon_version)
    .bind(pending)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn set_pending_tetragon(pool: &PgPool, host_id: &str, pending: &Value) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO packetwolf_local_sensors (host_id, status, tetragon_version, pending_tetragon)
         VALUES ($1, 'registered', '1.7.0', $2)
         ON CONFLICT (host_id) DO UPDATE SET pending_tetragon = EXCLUDED.pending_tetragon",
    )
    .bind(host_id)
    .bind(pending)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn clear_pending_tetragon(pool: &PgPool, host_id: &str) -> anyhow::Result<()> {
    sqlx::query("UPDATE packetwolf_local_sensors SET pending_tetragon = NULL WHERE host_id = $1")
        .bind(host_id)
        .execute(pool)
        .await?;
    Ok(())
}
