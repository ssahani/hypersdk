// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::State;
use axum::Json;

use crate::api::ApiError;
use crate::engine::recommendations;
use crate::state::AppState;

pub async fn list_recommendations(
    State(state): State<AppState>,
) -> Result<Json<Vec<recommendations::Recommendation>>, ApiError> {
    let rows = recommendations::generate_recommendations(&state.pool)
        .await
        .map_err(|e| ApiErrorernal(e.to_string()))?;
    Ok(Json(rows))
}
