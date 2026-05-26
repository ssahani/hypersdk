// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

use axum::routing::get;
use axum::{Json, Router};

use machina_core::{LibvirtManager, VmTemplate};

async fn list_templates() -> Json<Vec<VmTemplate>> {
    Json(VmTemplate::all())
}

async fn list_saved_templates() -> Json<Vec<VmTemplate>> {
    Json(machina_core::libvirt::extras::list_saved_templates())
}

pub fn template_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/templates", get(list_templates))
        .route("/templates/saved", get(list_saved_templates))
}
