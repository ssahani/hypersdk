// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use sqlx::SqlitePool;
use uuid::Uuid;

pub async fn dispatch_webhooks(pool: &SqlitePool, event_kind: &str, payload: serde_json::Value) {
    let rows: Vec<(Uuid, String, String, sqlx::types::Json<Vec<String>>)> =
        match sqlx::query_as("SELECT id, url, secret, events FROM webhooks WHERE enabled = TRUE")
            .fetch_all(pool)
            .await
        {
            Ok(r) => r,
            Err(_) => return,
        };

    let body = serde_json::json!({
        "kind": event_kind,
        "payload": payload,
    });

    for (webhook_id, url, secret, events) in rows {
        if !events.is_empty() && !events.iter().any(|e| event_matches(e, event_kind)) {
            continue;
        }
        let _ = sqlx::query(
            "INSERT INTO webhook_deliveries (id, webhook_id, url, secret, body, event_kind)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(Uuid::new_v4())
        .bind(webhook_id)
        .bind(&url)
        .bind(&secret)
        .bind(&body)
        .bind(event_kind)
        .execute(pool)
        .await;
    }

    let _ = sqlx::query("INSERT INTO notification_outbox (id, kind, payload) VALUES (?, ?, ?)")
        .bind(Uuid::new_v4())
        .bind(event_kind)
        .bind(&payload)
        .execute(pool)
        .await;

    dispatch_channels(pool, event_kind, &payload).await;
}

/// Fan an event out to configured notification channels (Slack/email/webhook), filtered by
/// each channel's event list. Creates channel_deliveries rows delivered by channel_worker.
pub async fn dispatch_channels(pool: &SqlitePool, event_kind: &str, payload: &serde_json::Value) {
    // NOTE: `id` must be decoded as Uuid, not String — the codebase stores UUID ids as
    // 16-byte BLOBs (.bind(Uuid)), so a String tuple element fails to decode, the whole
    // query_as returns Err, and this function would silently drop every delivery.
    let rows: Vec<(Uuid, String, String, sqlx::types::Json<Vec<String>>)> = match sqlx::query_as(
        "SELECT id, kind, target, events FROM notification_channels WHERE enabled = TRUE",
    )
    .fetch_all(pool)
    .await
    {
        Ok(r) => r,
        Err(_) => return,
    };
    if rows.is_empty() {
        return;
    }
    let (subject, body) = format_notification(event_kind, payload);
    for (channel_id, kind, target, events) in rows {
        if !events.is_empty() && !events.iter().any(|e| event_matches(e, event_kind)) {
            continue;
        }
        let _ = sqlx::query(
            "INSERT INTO channel_deliveries (id, channel_id, kind, target, subject, body, event_kind)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(Uuid::new_v4())
        .bind(&channel_id)
        .bind(&kind)
        .bind(&target)
        .bind(&subject)
        .bind(&body)
        .bind(event_kind)
        .execute(pool)
        .await;
    }
}

/// Build a short subject + human-readable body from an event. Alerts get a rule summary;
/// everything else falls back to the payload's `message`/`detail` or compact JSON.
pub fn format_notification(event_kind: &str, payload: &serde_json::Value) -> (String, String) {
    let subject = format!("[machina] {event_kind}");
    let body = if let Some(rule) = payload.get("rule").and_then(|v| v.as_str()) {
        let metric = payload.get("metric").and_then(|v| v.as_str()).unwrap_or("");
        let cmp = payload.get("comparator").and_then(|v| v.as_str()).unwrap_or("");
        let threshold = payload.get("threshold").map(|v| v.to_string()).unwrap_or_default();
        let count = payload.get("count").map(|v| v.to_string()).unwrap_or_default();
        format!("Alert '{rule}' fired: {count} VM(s) with {metric} {cmp} {threshold}")
    } else if let Some(m) = payload
        .get("message")
        .or_else(|| payload.get("detail"))
        .and_then(|v| v.as_str())
    {
        m.to_string()
    } else {
        payload.to_string()
    };
    (subject, body)
}

pub fn event_matches(filter: &str, kind: &str) -> bool {
    filter == "*" || filter == kind || kind.starts_with(filter.trim_end_matches('*'))
}

pub fn sign_payload(secret: &str, body: &str) -> Option<String> {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;
    type HmacSha256 = Hmac<Sha256>;
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).ok()?;
    mac.update(body.as_bytes());
    Some(hex::encode(mac.finalize().into_bytes()))
}
