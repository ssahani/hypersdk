// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::Json;

use crate::engine::developer;

pub async fn overview() -> Json<developer::DeveloperOverview> {
    Json(developer::overview())
}

pub async fn terraform_schema() -> Json<Vec<developer::TerraformResourceSchema>> {
    Json(developer::terraform_schemas())
}
