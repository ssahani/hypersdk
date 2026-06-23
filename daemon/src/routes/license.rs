// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

use axum::extract::Extension;
use axum::routing::get;
use axum::{Json, Router};
use machina_core::{license::License, LibvirtManager};
use serde_json::json;
use std::sync::Arc;

async fn license_status(
    Extension(lic): Extension<Arc<License>>,
) -> Json<serde_json::Value> {
    Json(json!({
        "licensee":      lic.licensee,
        "issued":        lic.issued.to_string(),
        "expires":       lic.expires.to_string(),
        "days_remaining": lic.days_remaining(),
        "is_valid":      lic.is_valid(),
        "product":       "machina / hyper2kvm",
    }))
}

pub fn license_routes() -> Router<LibvirtManager> {
    Router::new().route("/license", get(license_status))
}
