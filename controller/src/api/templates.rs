// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::{Path, Query, State};
use axum::Extension;
use axum::Json;
use machina_spec::VmTemplate;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::ApiError;
use crate::auth::AuthUser;
use crate::state::AppState;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TemplateRow {
    pub id: Uuid,
    pub name: String,
    pub version: String,
    pub source_disk: String,
    pub cloud_init: bool,
    pub os_family: Option<String>,
    pub category: String,
    pub description: String,
    pub featured: bool,
    pub marketplace: bool,
    pub icon: Option<String>,
    pub firewall_profile: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTemplateBody {
    pub name: String,
    pub version: String,
    pub source_disk: String,
    #[serde(default)]
    pub cloud_init: bool,
    #[serde(default)]
    pub os_family: Option<String>,
    #[serde(default = "default_category")]
    pub category: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub featured: bool,
    #[serde(default = "default_marketplace")]
    pub marketplace: bool,
    #[serde(default)]
    pub icon: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListTemplatesQuery {
    pub marketplace: Option<bool>,
    pub featured: Option<bool>,
}

fn default_category() -> String {
    "Linux".into()
}

fn default_marketplace() -> bool {
    true
}

const TEMPLATE_SELECT: &str =
    "SELECT id, name, version, source_disk, cloud_init, os_family, category, description, featured, marketplace, icon, firewall_profile FROM templates";

pub async fn list_templates(
    State(state): State<AppState>,
    Query(q): Query<ListTemplatesQuery>,
) -> Result<Json<Vec<TemplateRow>>, ApiError> {
    let rows = match (q.marketplace, q.featured) {
        (Some(true), Some(true)) => {
            sqlx::query_as::<_, TemplateRow>(&format!(
                "{TEMPLATE_SELECT} WHERE marketplace = TRUE AND featured = TRUE ORDER BY name, version"
            ))
            .fetch_all(&state.pool)
            .await?
        }
        (Some(true), _) => {
            sqlx::query_as::<_, TemplateRow>(&format!(
                "{TEMPLATE_SELECT} WHERE marketplace = TRUE ORDER BY featured DESC, name, version"
            ))
            .fetch_all(&state.pool)
            .await?
        }
        (_, Some(true)) => {
            sqlx::query_as::<_, TemplateRow>(&format!(
                "{TEMPLATE_SELECT} WHERE featured = TRUE ORDER BY name, version"
            ))
            .fetch_all(&state.pool)
            .await?
        }
        _ => {
            sqlx::query_as::<_, TemplateRow>(&format!("{TEMPLATE_SELECT} ORDER BY name, version"))
                .fetch_all(&state.pool)
                .await?
        }
    };
    Ok(Json(rows))
}

pub async fn list_marketplace_templates(
    State(state): State<AppState>,
) -> Result<Json<Vec<TemplateRow>>, ApiError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM templates WHERE marketplace = TRUE")
        .fetch_one(&state.pool)
        .await?;
    if count == 0 {
        let _ = crate::engine::template_catalog::seed_default_templates(&state.pool).await;
    }
    let rows = sqlx::query_as::<_, TemplateRow>(&format!(
        "{TEMPLATE_SELECT} WHERE marketplace = TRUE ORDER BY featured DESC, category, name, version"
    ))
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

pub async fn seed_templates(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let inserted = crate::engine::template_catalog::seed_default_templates(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    let rows = sqlx::query_as::<_, TemplateRow>(&format!(
        "{TEMPLATE_SELECT} WHERE marketplace = TRUE ORDER BY featured DESC, category, name, version"
    ))
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(serde_json::json!({
        "inserted": inserted,
        "templates": rows,
    })))
}

pub async fn create_template(
    State(state): State<AppState>,
    Extension(_actor): Extension<AuthUser>,
    Json(body): Json<CreateTemplateBody>,
) -> Result<Json<TemplateRow>, ApiError> {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO templates (id, name, version, source_disk, cloud_init, os_family, category, description, featured, marketplace, icon)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.version)
    .bind(&body.source_disk)
    .bind(body.cloud_init)
    .bind(&body.os_family)
    .bind(&body.category)
    .bind(&body.description)
    .bind(body.featured)
    .bind(body.marketplace)
    .bind(&body.icon)
    .execute(&state.pool)
    .await?;

    fetch_template_by_id(&state, id).await
}

pub async fn get_template(
    State(state): State<AppState>,
    Path((name, version)): Path<(String, String)>,
) -> Result<Json<TemplateRow>, ApiError> {
    let row = sqlx::query_as::<_, TemplateRow>(&format!(
        "{TEMPLATE_SELECT} WHERE name = $1 AND version = $2"
    ))
    .bind(&name)
    .bind(&version)
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(row))
}

pub async fn get_template_readiness(
    State(state): State<AppState>,
    Path((name, version)): Path<(String, String)>,
) -> Result<Json<crate::engine::template_readiness::TemplateReadiness>, ApiError> {
    let readiness = crate::engine::template_readiness::check_template_readiness(&state.pool, &name, &version)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    Ok(Json(readiness))
}

pub async fn delete_template(
    State(state): State<AppState>,
    Path((name, version)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let deleted = sqlx::query("DELETE FROM templates WHERE name = $1 AND version = $2")
        .bind(&name)
        .bind(&version)
        .execute(&state.pool)
        .await?;
    if deleted.rows_affected() == 0 {
        return Err(ApiError::bad_request("template not found"));
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}

async fn fetch_template_by_id(state: &AppState, id: Uuid) -> Result<Json<TemplateRow>, ApiError> {
    let row = sqlx::query_as::<_, TemplateRow>(&format!("{TEMPLATE_SELECT} WHERE id = $1"))
        .bind(id)
        .fetch_one(&state.pool)
        .await?;
    Ok(Json(row))
}

pub fn template_to_spec(t: &TemplateRow) -> VmTemplate {
    VmTemplate {
        name: t.name.clone(),
        version: t.version.clone(),
        source_disk: t.source_disk.clone(),
        cloud_init: t.cloud_init,
        os_family: t.os_family.clone(),
    }
}
