use axum::routing::get;
use axum::{Json, Router};

use virtspawn_core::{LibvirtManager, VmTemplate};

async fn list_templates() -> Json<Vec<VmTemplate>> {
    Json(VmTemplate::all())
}

pub fn template_routes() -> Router<LibvirtManager> {
    Router::new().route("/templates", get(list_templates))
}
