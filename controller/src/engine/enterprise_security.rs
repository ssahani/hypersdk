// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Vault/MFA inventory and air-gap bundle stubs (Horizon phase 28).

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct VaultProviderRow {
    pub id: Uuid,
    pub name: String,
    pub provider_type: String,
    pub address: String,
    pub namespace: String,
    pub status: String,
    pub last_sync_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct MfaPolicyRow {
    pub id: Uuid,
    pub role_name: String,
    pub method: String,
    pub required: bool,
    pub grace_days: i32,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct AirGapBundleRow {
    pub id: Uuid,
    pub name: String,
    pub checksum: String,
    pub manifest_json: serde_json::Value,
    pub size_bytes: i64,
    pub exported_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct EnterpriseSecurityOverview {
    pub vault_providers: usize,
    pub vault_connected: usize,
    pub mfa_policies: usize,
    pub mfa_required_roles: usize,
    pub air_gap_bundles: usize,
    pub summary: String,
}

#[derive(Debug, Deserialize)]
pub struct RegisterVaultProviderRequest {
    pub name: String,
    pub provider_type: Option<String>,
    pub address: Option<String>,
    pub namespace: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertMfaPolicyRequest {
    pub method: String,
    pub required: bool,
    pub grace_days: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAirGapBundleRequest {
    pub name: String,
}

pub async fn overview(pool: &PgPool) -> anyhow::Result<EnterpriseSecurityOverview> {
    let vault_providers: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM vault_providers")
        .fetch_one(pool)
        .await?;
    let vault_connected: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM vault_providers WHERE status = 'active'")
            .fetch_one(pool)
            .await?;
    let mfa_policies: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM mfa_policies")
        .fetch_one(pool)
        .await?;
    let mfa_required_roles: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM mfa_policies WHERE required = true")
            .fetch_one(pool)
            .await?;
    let air_gap_bundles: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM air_gap_bundles")
        .fetch_one(pool)
        .await?;

    let summary = format!(
        "{} vault provider(s) · {} MFA role(s) · {} air-gap bundle(s) (inventory stubs)",
        vault_providers, mfa_policies, air_gap_bundles
    );

    Ok(EnterpriseSecurityOverview {
        vault_providers: vault_providers as usize,
        vault_connected: vault_connected as usize,
        mfa_policies: mfa_policies as usize,
        mfa_required_roles: mfa_required_roles as usize,
        air_gap_bundles: air_gap_bundles as usize,
        summary,
    })
}

pub async fn list_vault_providers(pool: &PgPool) -> anyhow::Result<Vec<VaultProviderRow>> {
    sqlx::query_as(
        "SELECT id, name, provider_type, address, namespace, status, last_sync_at
         FROM vault_providers ORDER BY name",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.into())
}

pub async fn register_vault_provider(
    pool: &PgPool,
    req: &RegisterVaultProviderRequest,
) -> anyhow::Result<VaultProviderRow> {
    let name = req.name.trim();
    if name.is_empty() {
        anyhow::bail!("name required");
    }
    let provider_type = req.provider_type.clone().unwrap_or_else(|| "hashicorp".into());
    let address = req.address.clone().unwrap_or_default();
    let namespace = req.namespace.clone().unwrap_or_else(|| "machina".into());
    let status = if provider_type == "file" { "active" } else { "disconnected" };

    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO vault_providers (id, name, provider_type, address, namespace, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (name) DO UPDATE SET
           provider_type = EXCLUDED.provider_type,
           address = EXCLUDED.address,
           namespace = EXCLUDED.namespace,
           status = EXCLUDED.status",
    )
    .bind(id)
    .bind(name)
    .bind(&provider_type)
    .bind(&address)
    .bind(&namespace)
    .bind(status)
    .execute(pool)
    .await?;

    sqlx::query_as(
        "SELECT id, name, provider_type, address, namespace, status, last_sync_at
         FROM vault_providers WHERE name = $1",
    )
    .bind(name)
    .fetch_one(pool)
    .await
    .map_err(|e| e.into())
}

pub async fn list_mfa_policies(pool: &PgPool) -> anyhow::Result<Vec<MfaPolicyRow>> {
    sqlx::query_as(
        "SELECT id, role_name, method, required, grace_days FROM mfa_policies ORDER BY role_name",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.into())
}

pub async fn upsert_mfa_policy(
    pool: &PgPool,
    role_name: &str,
    req: &UpsertMfaPolicyRequest,
) -> anyhow::Result<MfaPolicyRow> {
    let role = role_name.trim();
    if role.is_empty() {
        anyhow::bail!("role required");
    }
    let method = if req.method == "totp" || req.method == "webauthn" {
        req.method.clone()
    } else {
        "webauthn".into()
    };
    let grace = req.grace_days.unwrap_or(7).clamp(0, 90);

    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO mfa_policies (id, role_name, method, required, grace_days)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (role_name) DO UPDATE SET
           method = EXCLUDED.method,
           required = EXCLUDED.required,
           grace_days = EXCLUDED.grace_days",
    )
    .bind(id)
    .bind(role)
    .bind(&method)
    .bind(req.required)
    .bind(grace)
    .execute(pool)
    .await?;

    sqlx::query_as(
        "SELECT id, role_name, method, required, grace_days FROM mfa_policies WHERE role_name = $1",
    )
    .bind(role)
    .fetch_one(pool)
    .await
    .map_err(|e| e.into())
}

pub async fn list_air_gap_bundles(pool: &PgPool) -> anyhow::Result<Vec<AirGapBundleRow>> {
    sqlx::query_as(
        "SELECT id, name, checksum, manifest_json, size_bytes, exported_at
         FROM air_gap_bundles ORDER BY exported_at DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.into())
}

pub async fn create_air_gap_bundle(
    pool: &PgPool,
    req: &CreateAirGapBundleRequest,
) -> anyhow::Result<AirGapBundleRow> {
    let name = req.name.trim();
    if name.is_empty() {
        anyhow::bail!("name required");
    }

    let hosts: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM hosts")
        .fetch_one(pool)
        .await
        .unwrap_or(0);
    let vms: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM vms")
        .fetch_one(pool)
        .await
        .unwrap_or(0);
    let templates: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM templates")
        .fetch_one(pool)
        .await
        .unwrap_or(0);
    let pools: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM storage_pools")
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    let manifest = serde_json::json!({
        "bundle": name,
        "version": "1.0.0",
        "kind": "machina-air-gap-inventory",
        "generated_at": chrono::Utc::now().to_rfc3339(),
        "inventory": {
            "hosts": hosts,
            "vms": vms,
            "templates": templates,
            "storage_pools": pools,
        },
        "includes": ["cluster-settings.yaml", "templates/", "policies/", "certificates/"],
        "note": "Simulated export manifest — no live Vault or bundle runner on main."
    });

    let manifest_str = manifest.to_string();
    let size_bytes = manifest_str.len() as i64;
    let checksum = format!("sha256:{:x}", simple_checksum(&manifest_str));
    let id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO air_gap_bundles (id, name, checksum, manifest_json, size_bytes)
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(id)
    .bind(name)
    .bind(&checksum)
    .bind(&manifest)
    .bind(size_bytes)
    .execute(pool)
    .await?;

    sqlx::query_as(
        "SELECT id, name, checksum, manifest_json, size_bytes, exported_at
         FROM air_gap_bundles WHERE id = $1",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.into())
}

pub async fn get_air_gap_bundle(pool: &PgPool, id: Uuid) -> anyhow::Result<AirGapBundleRow> {
    sqlx::query_as(
        "SELECT id, name, checksum, manifest_json, size_bytes, exported_at
         FROM air_gap_bundles WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| anyhow::anyhow!("bundle not found"))
}

fn simple_checksum(s: &str) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    s.hash(&mut h);
    h.finish()
}
