// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::{Path, State};
use axum::Extension;
use axum::Json;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::ApiError;
use crate::auth::{require_admin, AuthUser};
use crate::state::AppState;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UserRow {
    pub id: Uuid,
    pub username: String,
    pub role: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateUserBody {
    pub username: String,
    pub password: String,
    #[serde(default = "default_role")]
    pub role: String,
}

fn default_role() -> String {
    "operator".into()
}

#[derive(Debug, Deserialize)]
pub struct PatchUserBody {
    pub role: Option<String>,
    pub password: Option<String>,
}

pub async fn list_users(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
) -> Result<Json<Vec<UserRow>>, ApiError> {
    require_admin(&actor)?;
    let rows = sqlx::query_as::<_, UserRow>(
        "SELECT id, username, role, created_at FROM users ORDER BY username",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

pub async fn create_user(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Json(body): Json<CreateUserBody>,
) -> Result<Json<UserRow>, ApiError> {
    require_admin(&actor)?;
    let id = Uuid::new_v4();
    let hash = bcrypt::hash(&body.password, bcrypt::DEFAULT_COST)
        .map_err(|e| ApiError::internal(e.to_string()))?;
    sqlx::query("INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)")
        .bind(id)
        .bind(&body.username)
        .bind(hash)
        .bind(&body.role)
        .execute(&state.pool)
        .await?;
    let row = sqlx::query_as::<_, UserRow>(
        "SELECT id, username, role, created_at FROM users WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(row))
}

pub async fn patch_user(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(body): Json<PatchUserBody>,
) -> Result<Json<UserRow>, ApiError> {
    require_admin(&actor)?;
    if let Some(role) = &body.role {
        sqlx::query("UPDATE users SET role = $1 WHERE id = $2")
            .bind(role)
            .bind(id)
            .execute(&state.pool)
            .await?;
    }
    if let Some(pass) = &body.password {
        let hash = bcrypt::hash(pass, bcrypt::DEFAULT_COST)
            .map_err(|e| ApiError::internal(e.to_string()))?;
        sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
            .bind(hash)
            .bind(id)
            .execute(&state.pool)
            .await?;
    }
    let row = sqlx::query_as::<_, UserRow>(
        "SELECT id, username, role, created_at FROM users WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(row))
}

pub async fn delete_user(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_admin(&actor)?;
    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

pub async fn me(Extension(actor): Extension<AuthUser>) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "username": actor.username,
        "role": actor.role,
    }))
}
