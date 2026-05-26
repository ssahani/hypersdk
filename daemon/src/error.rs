// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use machina_core::LibvirtError;
use serde_json::json;

pub fn ok_json(status: &str, name: &str) -> Json<serde_json::Value> {
    Json(json!({ "status": status, "name": name }))
}

/// Response wrapper that sets Content-Type: text/xml for XML endpoints.
pub struct Xml(pub String);

impl IntoResponse for Xml {
    fn into_response(self) -> Response {
        ([(header::CONTENT_TYPE, "text/xml; charset=utf-8")], self.0).into_response()
    }
}

pub struct AppError(LibvirtError);

impl From<LibvirtError> for AppError {
    fn from(err: LibvirtError) -> Self {
        Self(err)
    }
}

fn libvirt_error_code(err: &LibvirtError) -> &'static str {
    match err {
        LibvirtError::NotFound(_) => "not_found",
        LibvirtError::Invalid(_) => "invalid_request",
        LibvirtError::Forbidden(_) => "forbidden",
        LibvirtError::Connection(_) => "libvirt_connection",
        LibvirtError::Operation(_) => "operation_failed",
        LibvirtError::Internal(_) => "internal_error",
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self.0 {
            LibvirtError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            LibvirtError::Invalid(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            LibvirtError::Forbidden(msg) => (StatusCode::FORBIDDEN, msg.clone()),
            LibvirtError::Connection(msg)
            | LibvirtError::Operation(msg)
            | LibvirtError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg.clone()),
        };

        let code = libvirt_error_code(&self.0);
        let body = axum::Json(json!({
            "error": message,
            "error_code": code,
        }));
        (status, body).into_response()
    }
}
