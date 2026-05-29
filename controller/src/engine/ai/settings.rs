// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiSettings {
    pub enabled: bool,
    pub mode: String,
    pub provider: String,
    pub model: String,
    pub api_key_configured: bool,
    pub autopilot_interval_secs: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub autopilot_last_run: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AiSettingsPatch {
    pub enabled: Option<bool>,
    pub mode: Option<String>,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub api_key: Option<String>,
    pub autopilot_interval_secs: Option<i32>,
}

pub async fn get_ai_settings(pool: &PgPool) -> anyhow::Result<AiSettings> {
    let row: (bool, String, String, String, String, i32, Option<chrono::DateTime<chrono::Utc>>) =
        sqlx::query_as(
            "SELECT ai_enabled, ai_mode, ai_provider, ai_model, COALESCE(ai_api_key, ''),
             ai_autopilot_interval_secs, ai_autopilot_last_run
         FROM clusters ORDER BY created_at LIMIT 1",
        )
        .fetch_one(pool)
        .await?;
    Ok(AiSettings {
        enabled: row.0,
        mode: row.1,
        provider: row.2,
        model: row.3,
        api_key_configured: !row.4.is_empty(),
        autopilot_interval_secs: row.5,
        autopilot_last_run: row.6.map(|t| t.to_rfc3339()),
    })
}

pub async fn patch_ai_settings(pool: &PgPool, patch: &AiSettingsPatch) -> anyhow::Result<AiSettings> {
    if let Some(v) = patch.enabled {
        sqlx::query("UPDATE clusters SET ai_enabled = $1")
            .bind(v)
            .execute(pool)
            .await?;
    }
    if let Some(v) = &patch.mode {
        sqlx::query("UPDATE clusters SET ai_mode = $1")
            .bind(v)
            .execute(pool)
            .await?;
    }
    if let Some(v) = &patch.provider {
        sqlx::query("UPDATE clusters SET ai_provider = $1")
            .bind(v)
            .execute(pool)
            .await?;
    }
    if let Some(v) = &patch.model {
        sqlx::query("UPDATE clusters SET ai_model = $1")
            .bind(v)
            .execute(pool)
            .await?;
    }
    if let Some(v) = &patch.api_key {
        sqlx::query("UPDATE clusters SET ai_api_key = $1")
            .bind(v)
            .execute(pool)
            .await?;
    }
    if let Some(v) = patch.autopilot_interval_secs {
        sqlx::query("UPDATE clusters SET ai_autopilot_interval_secs = $1")
            .bind(v.clamp(0, 86400))
            .execute(pool)
            .await?;
    }
    get_ai_settings(pool).await
}

pub async fn api_key(pool: &PgPool) -> anyhow::Result<Option<String>> {
    if std::env::var("MACHINA_AI_DISABLED").ok().as_deref() == Some("1") {
        return Ok(None);
    }
    if let Ok(k) = std::env::var("MACHINA_AI_API_KEY") {
        if !k.is_empty() {
            return Ok(Some(k));
        }
    }
    let key: String = sqlx::query_scalar(
        "SELECT COALESCE(ai_api_key, '') FROM clusters ORDER BY created_at LIMIT 1",
    )
    .fetch_one(pool)
    .await?;
    if key.is_empty() {
        Ok(None)
    } else {
        Ok(Some(key))
    }
}

pub async fn llm_enabled(pool: &PgPool) -> anyhow::Result<bool> {
    let s = get_ai_settings(pool).await?;
    Ok(s.enabled && s.api_key_configured && api_key(pool).await?.is_some())
}
