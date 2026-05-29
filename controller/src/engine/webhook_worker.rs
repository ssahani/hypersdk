// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use std::time::Duration;

use sqlx::PgPool;

use crate::leader::LeaderHandle;

pub fn spawn(pool: PgPool, leader: LeaderHandle) {
    tokio::spawn(async move {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_default();
        let mut interval = tokio::time::interval(Duration::from_secs(5));
        loop {
            interval.tick().await;
            if !leader.is_leader() {
                continue;
            }
            if let Err(e) = process_batch(&pool, &client).await {
                tracing::warn!("webhook worker: {e:#}");
            }
        }
    });
}

async fn process_batch(pool: &PgPool, client: &reqwest::Client) -> anyhow::Result<()> {
    let rows: Vec<(uuid::Uuid, String, String, serde_json::Value, i32, i32)> = sqlx::query_as(
        "SELECT id, url, secret, body, attempts, max_attempts FROM webhook_deliveries
         WHERE status = 'pending' AND next_retry_at <= NOW()
         ORDER BY next_retry_at LIMIT 20",
    )
    .fetch_all(pool)
    .await?;

    for (id, url, secret, body, attempts, max_attempts) in rows {
        let body_str = body.to_string();
        let mut req = client.post(&url).header("Content-Type", "application/json");
        if !secret.is_empty() {
            if let Some(sig) = crate::engine::webhooks::sign_payload(&secret, &body_str) {
                req = req.header("X-Machina-Signature", format!("sha256={sig}"));
            }
        }
        match req.body(body_str).send().await {
            Ok(resp) if resp.status().is_success() => {
                sqlx::query(
                    "UPDATE webhook_deliveries SET status = 'delivered', last_error = '', attempts = attempts + 1 WHERE id = $1",
                )
                .bind(id)
                .execute(pool)
                .await?;
            }
            Ok(resp) => {
                let err = format!("HTTP {}", resp.status());
                mark_retry(pool, id, attempts, max_attempts, &err).await?;
            }
            Err(e) => {
                mark_retry(pool, id, attempts, max_attempts, &e.to_string()).await?;
            }
        }
    }
    Ok(())
}

async fn mark_retry(
    pool: &PgPool,
    id: uuid::Uuid,
    attempts: i32,
    max_attempts: i32,
    err: &str,
) -> anyhow::Result<()> {
    let next = attempts + 1;
    if next >= max_attempts {
        sqlx::query(
            "UPDATE webhook_deliveries SET status = 'failed', attempts = $1, last_error = $2 WHERE id = $3",
        )
        .bind(next)
        .bind(err)
        .bind(id)
        .execute(pool)
        .await?;
    } else {
        let backoff_secs = 2_i32.saturating_pow(next as u32).min(300);
        sqlx::query(
            "UPDATE webhook_deliveries SET attempts = $1, last_error = $2,
             next_retry_at = NOW() + make_interval(secs => $3) WHERE id = $4",
        )
        .bind(next)
        .bind(err)
        .bind(backoff_secs as f64)
        .bind(id)
        .execute(pool)
        .await?;
    }
    Ok(())
}
