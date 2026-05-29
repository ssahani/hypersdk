// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct OidcConfig {
    pub enabled: bool,
    pub issuer: String,
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

#[derive(Debug, Deserialize)]
struct OidcDiscovery {
    authorization_endpoint: String,
    token_endpoint: String,
    userinfo_endpoint: Option<String>,
    jwks_uri: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    id_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UserInfo {
    sub: String,
    email: Option<String>,
    preferred_username: Option<String>,
    name: Option<String>,
}

pub async fn load_config(pool: &PgPool, fallback_redirect: &str) -> anyhow::Result<OidcConfig> {
    let row: (bool, String, String, String, String) = sqlx::query_as(
        "SELECT oidc_enabled, oidc_issuer, oidc_client_id, oidc_client_secret,
                COALESCE(NULLIF(oidc_redirect_uri, ''), $1)
         FROM clusters ORDER BY created_at LIMIT 1",
    )
    .bind(fallback_redirect)
    .fetch_one(pool)
    .await?;
    Ok(OidcConfig {
        enabled: row.0,
        issuer: row.1.trim_end_matches('/').to_string(),
        client_id: row.2,
        client_secret: row.3,
        redirect_uri: row.4,
    })
}

pub async fn begin_login(pool: &PgPool, cfg: &OidcConfig) -> anyhow::Result<(String, String)> {
    let discovery = fetch_discovery(&cfg.issuer).await?;
    let state = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO oidc_states (state) VALUES ($1)")
        .bind(&state)
        .execute(pool)
        .await?;
    let url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope=openid%20profile%20email&state={}",
        discovery.authorization_endpoint,
        urlencoding::encode(&cfg.client_id),
        urlencoding::encode(&cfg.redirect_uri),
        urlencoding::encode(&state),
    );
    Ok((state, url))
}

pub async fn complete_login(
    pool: &PgPool,
    cfg: &OidcConfig,
    jwt_secret: &str,
    code: &str,
    state: &str,
) -> anyhow::Result<(String, String, String)> {
    let valid: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM oidc_states WHERE state = $1 AND created_at > NOW() - INTERVAL '10 minutes')",
    )
    .bind(state)
    .fetch_one(pool)
    .await?;
    if !valid {
        anyhow::bail!("invalid or expired OIDC state");
    }
    sqlx::query("DELETE FROM oidc_states WHERE state = $1")
        .bind(state)
        .execute(pool)
        .await?;

    let discovery = fetch_discovery(&cfg.issuer).await?;
    let client = reqwest::Client::new();
    let token: TokenResponse = client
        .post(&discovery.token_endpoint)
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", cfg.redirect_uri.as_str()),
            ("client_id", cfg.client_id.as_str()),
            ("client_secret", cfg.client_secret.as_str()),
        ])
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let username = if let Some(ref userinfo_url) = discovery.userinfo_endpoint {
        let info: UserInfo = client
            .get(userinfo_url)
            .bearer_auth(&token.access_token)
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;
        info.email
            .or(info.preferred_username)
            .or(info.name)
            .unwrap_or(info.sub)
    } else if let Some(ref id_token) = token.id_token {
        if let Some(jwks_uri) = discovery.jwks_uri.as_deref() {
            match crate::oidc_jwt::validate_id_token(id_token, &cfg.issuer, &cfg.client_id, jwks_uri).await {
                Ok(u) => u,
                Err(e) => {
                    tracing::warn!("id_token JWKS validation failed: {e:#}; falling back to parse");
                    crate::oidc_jwt::parse_id_token_unverified(id_token)
                        .unwrap_or_else(|| id_token.clone())
                }
            }
        } else {
            crate::oidc_jwt::parse_id_token_unverified(id_token)
                .unwrap_or_else(|| id_token.clone())
        }
    } else {
        format!("oidc-{}", &token.access_token.chars().take(8).collect::<String>())
    };

    let role: String = match sqlx::query_scalar("SELECT role FROM users WHERE username = $1")
        .bind(&username)
        .fetch_optional(pool)
        .await?
    {
        Some(r) => r,
        None => {
            let role = "viewer".to_string();
            sqlx::query(
                "INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)",
            )
            .bind(Uuid::new_v4())
            .bind(&username)
            .bind("oidc")
            .bind(&role)
            .execute(pool)
            .await?;
            role
        }
    };

    let token = crate::jwt::issue_token(jwt_secret, &username, &role, 86400)?;
    Ok((username, role, token))
}

async fn fetch_discovery(issuer: &str) -> anyhow::Result<OidcDiscovery> {
    let url = format!("{issuer}/.well-known/openid-configuration");
    Ok(reqwest::get(url).await?.error_for_status()?.json().await?)
}
