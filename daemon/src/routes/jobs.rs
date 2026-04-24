use std::convert::Infallible;
use std::time::Duration;

use axum::extract::{Extension, Path, State};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::routing::{get, post};
use axum::{Json, Router};
use futures_util::stream;
use serde_json::{json, Value};
use uuid::Uuid;
use virt_image_build::BuildDiskRequest;
use virtspawn_core::{audit, AuditEvent, LibvirtError, LibvirtManager, VirtspawnConfig};

use crate::error::AppError;
use crate::job_registry::{JobDetail, JobRegistry, JobStatus, JobSummary};

fn log_audit(action: &str, target: &str, result: &str) {
    let event = AuditEvent {
        timestamp: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        action: action.to_string(),
        target: target.to_string(),
        result: result.to_string(),
    };
    audit::write_audit_event(&event);
}

async fn list_jobs(Extension(jobs): Extension<std::sync::Arc<JobRegistry>>) -> Json<Vec<JobSummary>> {
    Json(jobs.list_summaries())
}

async fn get_job_handler(
    Extension(jobs): Extension<std::sync::Arc<JobRegistry>>,
    Path(id): Path<String>,
) -> Result<Json<JobDetail>, AppError> {
    let uid = Uuid::parse_str(&id).map_err(|_| AppError::from(LibvirtError::Invalid("invalid job id".into())))?;
    jobs
        .get_detail(&uid)
        .map(Json)
        .ok_or_else(|| AppError::from(LibvirtError::NotFound(format!("job not found: {id}"))))
}

async fn post_virt_image_build_job(
    State(manager): State<LibvirtManager>,
    Extension(jobs): Extension<std::sync::Arc<JobRegistry>>,
    Json(req): Json<BuildDiskRequest>,
) -> Result<Json<Value>, AppError> {
    if !VirtspawnConfig::load().libvirt.virt_builder_allowed {
        return Err(AppError::from(LibvirtError::Invalid(
            "virt-builder / virt-image-build is disabled ([libvirt] virt_builder_allowed = false)".into(),
        )));
    }
    if req.output.trim().is_empty() {
        return Err(AppError::from(LibvirtError::Invalid("output is required".into())));
    }

    let id = jobs.start_virt_image_build(req.os.trim(), req.output.trim());
    let mgr = manager.clone();
    let jobs_bg = jobs.clone();
    let req_bg = req.clone();
    let out_path = req.output.trim().to_string();

    tokio::spawn(async move {
        let res = tokio::task::spawn_blocking(move || {
            mgr.with_conn(|conn| {
                crate::virt_image_validate::validate_virt_image_build(conn, &req_bg)?;
                virt_image_build::build_disk_image_with_logs(&req_bg, |line| {
                    jobs_bg.append_log(id, line);
                })
                .map_err(|e| LibvirtError::Operation(e.to_string()))
            })
        })
        .await;

        match res {
            Ok(Ok(())) => {
                log_audit("virt-image-build", &out_path, "ok");
                jobs_bg.complete_virt_image(id, &out_path);
            }
            Ok(Err(e)) => {
                jobs_bg.fail(id, &e.to_string());
            }
            Err(e) => {
                jobs_bg.fail(id, &format!("Task failed: {e}"));
            }
        }
    });

    Ok(Json(json!({
        "id": id.to_string(),
        "status": "started",
        "message": "Subscribe to GET /jobs/{id}/stream for live logs or poll GET /jobs/{id}",
    })))
}

async fn job_stream_handler(
    Extension(jobs): Extension<std::sync::Arc<JobRegistry>>,
    Path(id): Path<String>,
) -> Result<Sse<impl futures_util::Stream<Item = Result<Event, Infallible>> + Send>, AppError> {
    let uid = Uuid::parse_str(&id).map_err(|_| AppError::from(LibvirtError::Invalid("invalid job id".into())))?;
    if jobs.get_detail(&uid).is_none() {
        return Err(AppError::from(LibvirtError::NotFound(format!("job not found: {id}"))));
    }

    let jobs2 = jobs.clone();
    let job_uid = uid;
    let stream = stream::unfold(
        (
            tokio::time::interval(Duration::from_millis(420)),
            0usize,
            false,
        ),
        move |(mut interval, mut offset, mut terminal_sent)| {
            let jobs = jobs2.clone();
            let uid = job_uid;
            async move {
                if terminal_sent {
                    return None;
                }
                interval.tick().await;
                let Some(detail) = jobs.get_detail(&uid) else {
                    terminal_sent = true;
                    return Some((
                        Ok(Event::default()
                            .event("error")
                            .data("job no longer available")),
                        (interval, offset, terminal_sent),
                    ));
                };
                if offset < detail.logs.len() {
                    let chunk = detail.logs[offset..].join("\n");
                    offset = detail.logs.len();
                    return Some((Ok(Event::default().data(chunk)), (interval, offset, terminal_sent)));
                }
                match detail.summary.status {
                    JobStatus::Running => Some((
                        Ok(Event::default().comment("poll")),
                        (interval, offset, terminal_sent),
                    )),
                    JobStatus::Completed => {
                        terminal_sent = true;
                        let payload = json!({
                            "status": "completed",
                            "path": detail.summary.target_path,
                            "job": detail.summary,
                        })
                        .to_string();
                        Some((
                            Ok(Event::default().event("complete").data(payload)),
                            (interval, offset, terminal_sent),
                        ))
                    }
                    JobStatus::Failed => {
                        terminal_sent = true;
                        let msg = detail
                            .summary
                            .error
                            .clone()
                            .unwrap_or_else(|| "failed".into());
                        Some((
                            Ok(Event::default().event("error").data(msg)),
                            (interval, offset, terminal_sent),
                        ))
                    }
                }
            }
        },
    );

    Ok(
        Sse::new(stream).keep_alive(
            KeepAlive::new()
                .interval(Duration::from_secs(25))
                .text("keepalive"),
        ),
    )
}

pub fn job_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/jobs", get(list_jobs))
        .route("/jobs/virt-image-build", post(post_virt_image_build_job))
        .route("/jobs/{id}/stream", get(job_stream_handler))
        .route("/jobs/{id}", get(get_job_handler))
}
