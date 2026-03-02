use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;
use virtspawn_core::LibvirtError;

pub fn ok_json(status: &str, name: &str) -> Json<serde_json::Value> {
    Json(json!({ "status": status, "name": name }))
}

pub struct AppError(LibvirtError);

impl From<LibvirtError> for AppError {
    fn from(err: LibvirtError) -> Self {
        Self(err)
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self.0 {
            LibvirtError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            LibvirtError::Connection(msg)
            | LibvirtError::Operation(msg)
            | LibvirtError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg.clone()),
        };

        let body = axum::Json(json!({ "error": message }));
        (status, body).into_response()
    }
}
