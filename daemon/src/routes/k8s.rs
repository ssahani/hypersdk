use axum::extract::{Extension, Query};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::time::Duration;
use tokio::process::Command;
use tokio::time::timeout;
use tracing::warn;

use machina_core::{LibvirtError, LibvirtManager};

use crate::auth::{require_browser_session_for_host_insight, RequestActor};
use crate::error::AppError;

const KUBECTL_TIMEOUT_SECS: u64 = 30;

#[derive(Debug, Serialize)]
struct KubectlResult {
    command: String,
    stdout: String,
    stderr: String,
    exit_code: i32,
    ok: bool,
}

#[derive(Debug, Serialize)]
struct K8sNodeInfo {
    name: String,
    roles: Vec<String>,
    ready: bool,
    kubelet_version: String,
    os_image: String,
    kernel_version: String,
    container_runtime: String,
    architecture: String,
    capacity: BTreeMap<String, String>,
    allocatable: BTreeMap<String, String>,
    labels: BTreeMap<String, String>,
}

#[derive(Debug, Serialize)]
struct K8sOverview {
    version: String,
    nodes: usize,
    ready_nodes: usize,
    namespaces: usize,
    pods: usize,
    deployments: usize,
    services: usize,
}

#[derive(Debug, Deserialize)]
struct K8sListQuery {
    namespace: Option<String>,
    all_namespaces: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
enum K8sAction {
    NodeCordon,
    NodeUncordon,
    NodeDrain,
    RolloutRestartDeployment,
    DeletePod,
    ScaleDeployment,
}

#[derive(Debug, Deserialize)]
struct K8sActionRequest {
    action: K8sAction,
    name: String,
    namespace: Option<String>,
    replicas: Option<u32>,
}

fn ensure_safe_name(value: &str, field: &str) -> Result<(), LibvirtError> {
    if value.is_empty() {
        return Err(LibvirtError::Invalid(format!("{field} is required")));
    }
    let ok = value
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.' || c == '_');
    if !ok {
        return Err(LibvirtError::Invalid(format!(
            "{field} contains invalid characters"
        )));
    }
    Ok(())
}

fn safe_namespace(value: Option<&str>) -> Result<String, LibvirtError> {
    let ns = value.unwrap_or("default");
    ensure_safe_name(ns, "namespace")?;
    Ok(ns.to_string())
}

async fn run_kubectl(args: &[String]) -> Result<KubectlResult, LibvirtError> {
    let mut cmd = Command::new("kubectl");
    cmd.args(args);
    let command_text = format!("kubectl {}", args.join(" "));
    let output = timeout(Duration::from_secs(KUBECTL_TIMEOUT_SECS), cmd.output())
        .await
        .map_err(|_| LibvirtError::Operation("kubectl command timed out".into()))?
        .map_err(|e| LibvirtError::Operation(format!("failed to start kubectl: {e}")))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code().unwrap_or(-1);
    let ok = output.status.success();

    Ok(KubectlResult {
        command: command_text,
        stdout,
        stderr,
        exit_code,
        ok,
    })
}

async fn run_kubectl_json(args: &[String]) -> Result<Value, LibvirtError> {
    let mut full_args = args.to_vec();
    full_args.push("-o".into());
    full_args.push("json".into());
    let res = run_kubectl(&full_args).await?;
    if !res.ok {
        let msg = if res.stderr.trim().is_empty() {
            "kubectl command failed".to_string()
        } else {
            res.stderr
        };
        return Err(LibvirtError::Operation(msg));
    }
    serde_json::from_str::<Value>(&res.stdout)
        .map_err(|e| LibvirtError::Operation(format!("failed to parse kubectl JSON output: {e}")))
}

async fn k8s_nodes(
    Extension(actor): Extension<RequestActor>,
) -> Result<Json<Vec<K8sNodeInfo>>, AppError> {
    require_browser_session_for_host_insight(&actor)?;
    let v = run_kubectl_json(&["get".into(), "nodes".into()]).await?;
    let items = v
        .get("items")
        .and_then(|x| x.as_array())
        .cloned()
        .unwrap_or_default();

    let mut out = Vec::with_capacity(items.len());
    for item in items {
        let metadata = item.get("metadata").and_then(|x| x.as_object());
        let status = item.get("status").and_then(|x| x.as_object());
        let node_info = status
            .and_then(|s| s.get("nodeInfo"))
            .and_then(|x| x.as_object());
        let labels = metadata
            .and_then(|m| m.get("labels"))
            .and_then(|x| x.as_object())
            .cloned()
            .unwrap_or_default();

        let mut roles = Vec::new();
        let mut safe_labels = BTreeMap::new();
        for (k, v) in labels {
            if let Some(s) = v.as_str() {
                safe_labels.insert(k.clone(), s.to_string());
                if let Some(role) = k.strip_prefix("node-role.kubernetes.io/") {
                    if !role.is_empty() {
                        roles.push(role.to_string());
                    }
                }
            }
        }
        if roles.is_empty() {
            roles.push("worker".to_string());
        }

        let conditions = status
            .and_then(|s| s.get("conditions"))
            .and_then(|x| x.as_array())
            .cloned()
            .unwrap_or_default();
        let ready = conditions.iter().any(|c| {
            c.get("type").and_then(|x| x.as_str()) == Some("Ready")
                && c.get("status").and_then(|x| x.as_str()) == Some("True")
        });

        let capacity_map = status
            .and_then(|s| s.get("capacity"))
            .and_then(|x| x.as_object())
            .cloned()
            .unwrap_or_default();
        let alloc_map = status
            .and_then(|s| s.get("allocatable"))
            .and_then(|x| x.as_object())
            .cloned()
            .unwrap_or_default();

        let mut capacity = BTreeMap::new();
        for (k, v) in capacity_map {
            if let Some(s) = v.as_str() {
                capacity.insert(k, s.to_string());
            }
        }
        let mut allocatable = BTreeMap::new();
        for (k, v) in alloc_map {
            if let Some(s) = v.as_str() {
                allocatable.insert(k, s.to_string());
            }
        }

        out.push(K8sNodeInfo {
            name: metadata
                .and_then(|m| m.get("name"))
                .and_then(|x| x.as_str())
                .unwrap_or("unknown")
                .to_string(),
            roles,
            ready,
            kubelet_version: node_info
                .and_then(|n| n.get("kubeletVersion"))
                .and_then(|x| x.as_str())
                .unwrap_or("unknown")
                .to_string(),
            os_image: node_info
                .and_then(|n| n.get("osImage"))
                .and_then(|x| x.as_str())
                .unwrap_or("unknown")
                .to_string(),
            kernel_version: node_info
                .and_then(|n| n.get("kernelVersion"))
                .and_then(|x| x.as_str())
                .unwrap_or("unknown")
                .to_string(),
            container_runtime: node_info
                .and_then(|n| n.get("containerRuntimeVersion"))
                .and_then(|x| x.as_str())
                .unwrap_or("unknown")
                .to_string(),
            architecture: node_info
                .and_then(|n| n.get("architecture"))
                .and_then(|x| x.as_str())
                .unwrap_or("unknown")
                .to_string(),
            capacity,
            allocatable,
            labels: safe_labels,
        });
    }
    Ok(Json(out))
}

async fn k8s_resource_list(
    Extension(actor): Extension<RequestActor>,
    Query(q): Query<K8sListQuery>,
    resource: &'static str,
) -> Result<Json<Value>, AppError> {
    require_browser_session_for_host_insight(&actor)?;
    if let Some(ns) = q.namespace.as_deref() {
        ensure_safe_name(ns, "namespace")?;
    }
    let all_ns = q.all_namespaces.unwrap_or(false);

    let mut args = vec!["get".to_string(), resource.to_string()];
    if all_ns {
        args.push("-A".to_string());
    } else if let Some(ns) = q.namespace {
        args.push("-n".to_string());
        args.push(ns);
    }

    let v = run_kubectl_json(&args).await?;
    Ok(Json(v))
}

async fn k8s_namespaces(
    Extension(actor): Extension<RequestActor>,
) -> Result<Json<Value>, AppError> {
    require_browser_session_for_host_insight(&actor)?;
    let v = run_kubectl_json(&["get".into(), "namespaces".into()]).await?;
    Ok(Json(v))
}

async fn k8s_pods(
    Extension(actor): Extension<RequestActor>,
    Query(q): Query<K8sListQuery>,
) -> Result<Json<Value>, AppError> {
    k8s_resource_list(Extension(actor), Query(q), "pods").await
}

async fn k8s_deployments(
    Extension(actor): Extension<RequestActor>,
    Query(q): Query<K8sListQuery>,
) -> Result<Json<Value>, AppError> {
    k8s_resource_list(Extension(actor), Query(q), "deployments").await
}

async fn k8s_services(
    Extension(actor): Extension<RequestActor>,
    Query(q): Query<K8sListQuery>,
) -> Result<Json<Value>, AppError> {
    k8s_resource_list(Extension(actor), Query(q), "services").await
}

async fn k8s_overview(
    Extension(actor): Extension<RequestActor>,
) -> Result<Json<K8sOverview>, AppError> {
    require_browser_session_for_host_insight(&actor)?;

    let version_res = run_kubectl_json(&["version".into()]).await;
    let nodes_res = run_kubectl_json(&["get".into(), "nodes".into()]).await;
    let ns_res = run_kubectl_json(&["get".into(), "namespaces".into()]).await;
    let pods_res = run_kubectl_json(&["get".into(), "pods".into(), "-A".into()]).await;
    let deploys_res = run_kubectl_json(&["get".into(), "deployments".into(), "-A".into()]).await;
    let svc_res = run_kubectl_json(&["get".into(), "services".into(), "-A".into()]).await;

    let version = match version_res {
        Ok(v) => v
            .get("serverVersion")
            .and_then(|x| x.get("gitVersion"))
            .and_then(|x| x.as_str())
            .unwrap_or("unknown")
            .to_string(),
        Err(e) => {
            warn!("k8s overview version error: {e}");
            "unknown".to_string()
        }
    };

    let nodes = nodes_res
        .ok()
        .and_then(|v| {
            v.get("items")
                .and_then(|x| x.as_array())
                .map(|a| a.to_vec())
        })
        .unwrap_or_default();

    let ready_nodes = nodes
        .iter()
        .filter(|n| {
            n.get("status")
                .and_then(|s| s.get("conditions"))
                .and_then(|c| c.as_array())
                .map(|conds| {
                    conds.iter().any(|c| {
                        c.get("type").and_then(|x| x.as_str()) == Some("Ready")
                            && c.get("status").and_then(|x| x.as_str()) == Some("True")
                    })
                })
                .unwrap_or(false)
        })
        .count();

    let namespaces = ns_res
        .ok()
        .and_then(|v| v.get("items").and_then(|x| x.as_array()).map(|a| a.len()))
        .unwrap_or(0);
    let pods = pods_res
        .ok()
        .and_then(|v| v.get("items").and_then(|x| x.as_array()).map(|a| a.len()))
        .unwrap_or(0);
    let deployments = deploys_res
        .ok()
        .and_then(|v| v.get("items").and_then(|x| x.as_array()).map(|a| a.len()))
        .unwrap_or(0);
    let services = svc_res
        .ok()
        .and_then(|v| v.get("items").and_then(|x| x.as_array()).map(|a| a.len()))
        .unwrap_or(0);

    Ok(Json(K8sOverview {
        version,
        nodes: nodes.len(),
        ready_nodes,
        namespaces,
        pods,
        deployments,
        services,
    }))
}

async fn k8s_action(
    Extension(actor): Extension<RequestActor>,
    Json(req): Json<K8sActionRequest>,
) -> Result<Json<KubectlResult>, AppError> {
    require_browser_session_for_host_insight(&actor)?;
    ensure_safe_name(&req.name, "name")?;

    let args = match req.action {
        K8sAction::NodeCordon => vec!["cordon".into(), req.name],
        K8sAction::NodeUncordon => vec!["uncordon".into(), req.name],
        K8sAction::NodeDrain => vec![
            "drain".into(),
            req.name,
            "--ignore-daemonsets".into(),
            "--delete-emptydir-data".into(),
            "--force".into(),
        ],
        K8sAction::RolloutRestartDeployment => {
            let ns = safe_namespace(req.namespace.as_deref())?;
            vec![
                "rollout".into(),
                "restart".into(),
                format!("deployment/{}", req.name),
                "-n".into(),
                ns,
            ]
        }
        K8sAction::DeletePod => {
            let ns = safe_namespace(req.namespace.as_deref())?;
            vec!["delete".into(), "pod".into(), req.name, "-n".into(), ns]
        }
        K8sAction::ScaleDeployment => {
            let ns = safe_namespace(req.namespace.as_deref())?;
            let replicas = req
                .replicas
                .ok_or_else(|| LibvirtError::Invalid("replicas is required".into()))?;
            vec![
                "scale".into(),
                format!("deployment/{}", req.name),
                format!("--replicas={replicas}"),
                "-n".into(),
                ns,
            ]
        }
    };

    let res = run_kubectl(&args).await?;
    if !res.ok {
        let msg = if res.stderr.trim().is_empty() {
            format!("k8s action failed: {}", res.command)
        } else {
            res.stderr.clone()
        };
        return Err(LibvirtError::Operation(msg).into());
    }
    Ok(Json(res))
}

pub fn k8s_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/k8s/overview", get(k8s_overview))
        .route("/k8s/nodes", get(k8s_nodes))
        .route("/k8s/namespaces", get(k8s_namespaces))
        .route("/k8s/pods", get(k8s_pods))
        .route("/k8s/deployments", get(k8s_deployments))
        .route("/k8s/services", get(k8s_services))
        .route("/k8s/action", post(k8s_action))
}
