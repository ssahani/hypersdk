// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use sqlx::PgPool;

use super::settings;

/// Optional LLM completion — returns None when disabled or on failure.
pub async fn complete(pool: &PgPool, system: &str, user: &str) -> anyhow::Result<Option<String>> {
    if !settings::llm_enabled(pool).await? {
        return Ok(None);
    }
    let key = settings::api_key(pool).await?.unwrap_or_default();
    let (provider, model): (String, String) = sqlx::query_as(
        "SELECT ai_provider, ai_model FROM clusters ORDER BY created_at LIMIT 1",
    )
    .fetch_one(pool)
    .await?;

    if provider == "anthropic" {
        return anthropic_complete(&key, &model, system, user).await;
    }
    openai_complete(&key, &model, system, user).await
}

async fn openai_complete(
    api_key: &str,
    model: &str,
    system: &str,
    user: &str,
) -> anyhow::Result<Option<String>> {
    let body = serde_json::json!({
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user}
        ],
        "max_tokens": 1024
    });
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(45))
        .build()?;
    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await?;
    if !resp.status().is_success() {
        tracing::warn!("openai error: {}", resp.text().await.unwrap_or_default());
        return Ok(None);
    }
    let v: serde_json::Value = resp.json().await?;
    let text = v["choices"][0]["message"]["content"]
        .as_str()
        .map(String::from);
    Ok(text)
}

async fn anthropic_complete(
    api_key: &str,
    model: &str,
    system: &str,
    user: &str,
) -> anyhow::Result<Option<String>> {
    let body = serde_json::json!({
        "model": model,
        "max_tokens": 1024,
        "system": system,
        "messages": [{"role": "user", "content": user}]
    });
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(45))
        .build()?;
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await?;
    if !resp.status().is_success() {
        tracing::warn!("anthropic error: {}", resp.text().await.unwrap_or_default());
        return Ok(None);
    }
    let v: serde_json::Value = resp.json().await?;
    let text = v["content"][0]["text"].as_str().map(String::from);
    Ok(text)
}
