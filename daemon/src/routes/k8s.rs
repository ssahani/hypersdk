use axum::extract::{DefaultBodyLimit, Extension, Query};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::Path;
use std::time::Duration;
use tokio::process::Command;
use tokio::time::timeout;
use tracing::warn;

use machina_core::{LibvirtError, LibvirtManager};

use crate::auth::{require_browser_session_for_host_insight, RequestActor};
use crate::error::AppError;

const KUBECTL_TIMEOUT_SECS: u64 = 30;
const KUBECTL_PROBE_TIMEOUT_SECS: u64 = 8;
const KUBECTL_LOGS_TIMEOUT_SECS: u64 = 60;
const KUBECTL_APPLY_MAX_MANIFEST_BYTES: usize = 512 * 1024;
const SNIPPET_MAX_BYTES: usize = 18_432;

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
    /// Best-effort: `k3s`, `rke2`, `eks`, `gke`, `aks`, `minikube`, `kind`, `generic`, or `unknown`.
    #[serde(default)]
    distribution: String,
    #[serde(default)]
    distribution_hints: Vec<String>,
    #[serde(default)]
    extra_resource_counts: BTreeMap<String, usize>,
}

#[derive(Debug, Serialize)]
struct K8sHostSignals {
    k3s_config_present: bool,
    k3s_data_dir_present: bool,
    rke2_config_present: bool,
    rke2_data_dir_present: bool,
    k3s_systemd: String,
    k3s_agent_systemd: String,
    rke2_server_systemd: String,
    rke2_agent_systemd: String,
    k3s_binary_version: Option<String>,
    rke2_binary_version: Option<String>,
    helm_version: Option<String>,
    crictl_version: Option<String>,
}

#[derive(Debug, Serialize)]
struct K8sEnvironment {
    kubectl_on_path: bool,
    kubectl_client_version: Option<String>,
    kubectl_server_reachable: bool,
    kubeconfig_hint: Option<String>,
    kubeconfig_from_env: bool,
    /// When set, machina injects `--kubeconfig` with this path for all cluster kubectl calls (auto-detected).
    #[serde(skip_serializing_if = "Option::is_none")]
    kubeconfig_auto_selected: Option<String>,
    current_context: Option<String>,
    cluster_distribution: String,
    cluster_distribution_hints: Vec<String>,
    host: K8sHostSignals,
    /// Truncated command output for quick operator inspection (fixed allowlist only).
    snippets: BTreeMap<String, String>,
}

#[derive(Debug, Deserialize)]
struct K8sListQuery {
    namespace: Option<String>,
    #[serde(default)]
    all_namespaces: Option<bool>,
    /// Optional `kubectl --context` (must match a context name in the merged kubeconfig).
    #[serde(default)]
    context: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct K8sOverviewQuery {
    #[serde(default)]
    context: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct K8sContextQuery {
    #[serde(default)]
    context: Option<String>,
}

#[derive(Debug, Deserialize)]
struct K8sLogsQuery {
    pod: String,
    namespace: Option<String>,
    #[serde(default)]
    container: Option<String>,
    #[serde(default)]
    tail_lines: Option<u32>,
    #[serde(default)]
    previous: Option<bool>,
    #[serde(default)]
    context: Option<String>,
}

#[derive(Debug, Deserialize)]
struct K8sEventsQuery {
    namespace: Option<String>,
    #[serde(default)]
    all_namespaces: Option<bool>,
    #[serde(default)]
    context: Option<String>,
}

#[derive(Debug, Deserialize)]
struct K8sApplyRequest {
    manifest: String,
    #[serde(default)]
    dry_run: Option<bool>,
    #[serde(default)]
    context: Option<String>,
}

#[derive(Debug, Deserialize)]
struct K8sAuthCanIRequest {
    verb: String,
    resource: String,
    #[serde(default)]
    namespace: Option<String>,
    #[serde(default)]
    resource_name: Option<String>,
    #[serde(default)]
    context: Option<String>,
}

#[derive(Debug, Deserialize)]
struct K8sHelmQuery {
    #[serde(default)]
    namespace: Option<String>,
    #[serde(default)]
    context: Option<String>,
}

fn ensure_k8s_context_name(ctx: &str) -> Result<(), LibvirtError> {
    let t = ctx.trim();
    if t.is_empty() || t.len() > 200 {
        return Err(LibvirtError::Invalid("invalid kubectl context".into()));
    }
    let ok = t.chars().all(|c| {
        c.is_ascii_alphanumeric()
            || matches!(
                c,
                '.' | '-' | '_' | ':' | '/' | '@' | '#' | '+' | '%' | '[' | ']'
            )
    });
    if !ok {
        return Err(LibvirtError::Invalid(
            "kubectl context contains unsupported characters".into(),
        ));
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
enum K8sAction {
    NodeCordon,
    NodeUncordon,
    NodeDrain,
    RolloutRestartDeployment,
    RolloutRestartStatefulSet,
    RolloutRestartDaemonSet,
    DeletePod,
    DeleteJob,
    ScaleDeployment,
    ScaleStatefulSet,
}

#[derive(Debug, Deserialize)]
struct K8sActionRequest {
    action: K8sAction,
    name: String,
    namespace: Option<String>,
    replicas: Option<u32>,
    #[serde(default)]
    context: Option<String>,
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

async fn run_kubectl_timeout(
    args: &[String],
    timeout_secs: u64,
    context: Option<&str>,
) -> Result<KubectlResult, LibvirtError> {
    let choice = crate::k8s_kubeconfig::kubectl_kubeconfig_choice().await;
    let mut full = choice.prefix.clone();
    if let Some(ctx) = context {
        let t = ctx.trim();
        if !t.is_empty() {
            ensure_k8s_context_name(t)?;
            full.push("--context".into());
            full.push(t.to_string());
        }
    }
    full.extend_from_slice(args);

    let mut cmd = Command::new("kubectl");
    cmd.args(&full);
    let command_text = format!("kubectl {}", full.join(" "));
    let output = timeout(Duration::from_secs(timeout_secs), cmd.output())
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

async fn run_kubectl(args: &[String]) -> Result<KubectlResult, LibvirtError> {
    run_kubectl_timeout(args, KUBECTL_TIMEOUT_SECS, None).await
}

async fn run_kubectl_ctx(
    args: &[String],
    context: Option<&str>,
) -> Result<KubectlResult, LibvirtError> {
    run_kubectl_timeout(args, KUBECTL_TIMEOUT_SECS, context).await
}

async fn run_kubectl_json_timeout(
    args: &[String],
    timeout_secs: u64,
    context: Option<&str>,
) -> Result<Value, LibvirtError> {
    let mut full_args = args.to_vec();
    full_args.push("-o".into());
    full_args.push("json".into());
    let res = run_kubectl_timeout(&full_args, timeout_secs, context).await?;
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

async fn run_kubectl_json(args: &[String]) -> Result<Value, LibvirtError> {
    run_kubectl_json_timeout(args, KUBECTL_TIMEOUT_SECS, None).await
}

async fn run_kubectl_json_ctx(
    args: &[String],
    timeout_secs: u64,
    context: Option<&str>,
) -> Result<Value, LibvirtError> {
    run_kubectl_json_timeout(args, timeout_secs, context).await
}

fn truncate_snippet(text: &str) -> String {
    let t = text.trim();
    if t.len() <= SNIPPET_MAX_BYTES {
        return t.to_string();
    }
    format!(
        "{}\n… ({} more bytes)",
        &t[..SNIPPET_MAX_BYTES],
        t.len() - SNIPPET_MAX_BYTES
    )
}

async fn path_exists_async(p: &str) -> bool {
    tokio::fs::metadata(p).await.is_ok()
}

fn count_list_items(res: &Result<Value, LibvirtError>) -> usize {
    res.as_ref()
        .ok()
        .and_then(|v| v.get("items").and_then(|x| x.as_array()).map(|a| a.len()))
        .unwrap_or(0)
}

async fn systemctl_line(unit: &str) -> String {
    match timeout(
        Duration::from_secs(3),
        Command::new("systemctl").args(["is-active", unit]).output(),
    )
    .await
    {
        Ok(Ok(out)) => {
            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if out.status.success() && s == "active" {
                "active".into()
            } else if s.is_empty() {
                "inactive".into()
            } else {
                s
            }
        }
        _ => "unknown".into(),
    }
}

async fn cmd_first_line_timeout(program: &str, args: &[&str], secs: u64) -> Option<String> {
    let out = timeout(
        Duration::from_secs(secs),
        Command::new(program).args(args.iter().copied()).output(),
    )
    .await
    .ok()
    .and_then(|r| r.ok())?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&out.stdout);
    let line = s.lines().next().unwrap_or("").trim();
    if !line.is_empty() {
        return Some(line.to_string());
    }
    let e = String::from_utf8_lossy(&out.stderr);
    let el = e.lines().next().unwrap_or("").trim();
    if el.is_empty() {
        None
    } else {
        Some(el.to_string())
    }
}

fn kubeconfig_hint() -> (bool, Option<String>) {
    if let Ok(p) = std::env::var("KUBECONFIG") {
        let first = p.split(':').next().unwrap_or(&p).trim();
        if !first.is_empty() && Path::new(first).is_file() {
            return (true, Some(first.to_string()));
        }
        if !first.is_empty() {
            return (true, Some(first.to_string()));
        }
    }
    if let Ok(home) = std::env::var("HOME") {
        let def = format!("{home}/.kube/config");
        if Path::new(&def).is_file() {
            return (false, Some(def));
        }
    }
    (false, None)
}

async fn collect_host_signals() -> K8sHostSignals {
    let (
        k3s_cfg,
        k3s_data,
        r2_cfg,
        r2_data,
        u_k3s,
        u_k3sa,
        u_r2s,
        u_r2a,
        k3s_ver,
        r2_ver,
        helm_v,
        cri_v,
    ) = tokio::join!(
        path_exists_async("/etc/rancher/k3s/k3s.yaml"),
        path_exists_async("/var/lib/rancher/k3s"),
        path_exists_async("/etc/rancher/rke2/config.yaml"),
        path_exists_async("/var/lib/rancher/rke2"),
        systemctl_line("k3s"),
        systemctl_line("k3s-agent"),
        systemctl_line("rke2-server"),
        systemctl_line("rke2-agent"),
        cmd_first_line_timeout("k3s", &["--version"], 5),
        cmd_first_line_timeout("rke2", &["--version"], 5),
        cmd_first_line_timeout("helm", &["version", "--short"], 5),
        cmd_first_line_timeout("crictl", &["--version"], 5),
    );
    K8sHostSignals {
        k3s_config_present: k3s_cfg,
        k3s_data_dir_present: k3s_data,
        rke2_config_present: r2_cfg,
        rke2_data_dir_present: r2_data,
        k3s_systemd: u_k3s,
        k3s_agent_systemd: u_k3sa,
        rke2_server_systemd: u_r2s,
        rke2_agent_systemd: u_r2a,
        k3s_binary_version: k3s_ver,
        rke2_binary_version: r2_ver,
        helm_version: helm_v,
        crictl_version: cri_v,
    }
}

fn infer_cluster_distribution(items: &[Value], host: &K8sHostSignals) -> (String, Vec<String>) {
    let mut hints = Vec::new();

    for n in items {
        let ni = n.get("status").and_then(|s| s.get("nodeInfo"));
        let kubelet = ni
            .and_then(|x| x.get("kubeletVersion"))
            .and_then(|x| x.as_str())
            .unwrap_or("");
        let os_img = ni
            .and_then(|x| x.get("osImage"))
            .and_then(|x| x.as_str())
            .unwrap_or("");
        let crt = ni
            .and_then(|x| x.get("containerRuntimeVersion"))
            .and_then(|x| x.as_str())
            .unwrap_or("");
        let blob = format!("{kubelet} {os_img} {crt}").to_lowercase();
        if blob.contains("k3s") {
            hints.push(format!("node kubelet/OS/runtime mentions k3s ({kubelet})"));
            return ("k3s".to_string(), hints);
        }
        if blob.contains("rke2") {
            hints.push(format!("node kubelet/OS/runtime mentions rke2 ({kubelet})"));
            return ("rke2".to_string(), hints);
        }
    }

    for n in items {
        let prov = n
            .get("spec")
            .and_then(|s| s.get("providerID"))
            .and_then(|x| x.as_str())
            .unwrap_or("");
        if prov.starts_with("aws://") {
            hints.push(format!("providerID {prov}"));
            return ("eks".to_string(), hints);
        }
        if prov.starts_with("gce://") || prov.starts_with("gcp://") {
            hints.push(format!("providerID {prov}"));
            return ("gke".to_string(), hints);
        }
        if prov.starts_with("azure://") {
            hints.push(format!("providerID {prov}"));
            return ("aks".to_string(), hints);
        }
    }

    for n in items {
        let labels = n
            .get("metadata")
            .and_then(|m| m.get("labels"))
            .and_then(|x| x.as_object());
        if let Some(lab) = labels {
            if lab.contains_key("minikube.k8s.io/version")
                || lab.contains_key("minikube.k8s.io/name")
            {
                hints.push("minikube node labels".into());
                return ("minikube".to_string(), hints);
            }
            if lab.contains_key("kind.sigs.k8s.io/cluster") {
                hints.push("kind.sigs.k8s.io/cluster label".into());
                return ("kind".to_string(), hints);
            }
        }
    }

    for n in items {
        if let Some(name) = n
            .get("metadata")
            .and_then(|m| m.get("name"))
            .and_then(|x| x.as_str())
        {
            if name == "minikube" {
                hints.push("node named minikube".into());
                return ("minikube".to_string(), hints);
            }
            if name.contains("kind-control-plane") || name.contains("kind-worker") {
                hints.push(format!("node name suggests kind ({name})"));
                return ("kind".to_string(), hints);
            }
        }
    }

    if host.k3s_config_present {
        hints.push("/etc/rancher/k3s/k3s.yaml present on host".into());
        return ("k3s".to_string(), hints);
    }
    if host.k3s_data_dir_present && host.k3s_systemd == "active" {
        hints.push("k3s data dir + systemd k3s active".into());
        return ("k3s".to_string(), hints);
    }
    if host.rke2_config_present {
        hints.push("/etc/rancher/rke2/config.yaml present".into());
        return ("rke2".to_string(), hints);
    }
    if host.rke2_server_systemd == "active" {
        hints.push("rke2-server systemd active".into());
        return ("rke2".to_string(), hints);
    }

    if items.is_empty() {
        ("unknown".to_string(), hints)
    } else {
        hints.push("no known distro markers; cluster API reachable".into());
        ("generic".to_string(), hints)
    }
}

async fn kubectl_client_version_short() -> Option<String> {
    let res = run_kubectl_timeout(
        &[
            "version".into(),
            "--client=true".into(),
            "-o".into(),
            "json".into(),
        ],
        6,
        None,
    )
    .await
    .ok()?;
    if !res.ok {
        return None;
    }
    let v: Value = serde_json::from_str(&res.stdout).ok()?;
    let gv = v
        .get("clientVersion")
        .and_then(|c| c.get("gitVersion"))
        .and_then(|x| x.as_str())?;
    Some(gv.to_string())
}

async fn k8s_environment(
    Extension(actor): Extension<RequestActor>,
) -> Result<Json<K8sEnvironment>, AppError> {
    require_browser_session_for_host_insight(&actor)?;

    let host = collect_host_signals().await;
    let kubectl_probe =
        run_kubectl_timeout(&["version".into(), "--client=true".into()], 5, None).await;
    let kubectl_on_path = matches!(&kubectl_probe, Ok(r) if r.ok);

    let client_ver = if kubectl_on_path {
        kubectl_client_version_short().await
    } else {
        None
    };

    let nodes_res = run_kubectl_json_timeout(
        &["get".into(), "nodes".into()],
        KUBECTL_PROBE_TIMEOUT_SECS,
        None,
    )
    .await;
    let server_ok = nodes_res.is_ok();
    let node_items = nodes_res
        .as_ref()
        .ok()
        .and_then(|v| v.get("items").and_then(|x| x.as_array()).cloned())
        .unwrap_or_default();

    let (dist, hints) = infer_cluster_distribution(&node_items, &host);

    let (kubeconfig_from_env, kubeconfig_hint) = kubeconfig_hint();
    let kubeconfig_auto_selected = crate::k8s_kubeconfig::kubectl_kubeconfig_choice()
        .await
        .auto_selected_path
        .clone();

    let current_context = if kubectl_on_path {
        match run_kubectl_timeout(
            &[
                "config".into(),
                "view".into(),
                "--minify".into(),
                "-o".into(),
                "jsonpath={.current-context}".into(),
            ],
            6,
            None,
        )
        .await
        {
            Ok(r) if r.ok => {
                let s = r.stdout.trim();
                if s.is_empty() {
                    None
                } else {
                    Some(s.to_string())
                }
            }
            _ => None,
        }
    } else {
        None
    };

    let mut snippets = BTreeMap::new();
    if kubectl_on_path {
        if let Ok(r) =
            run_kubectl_timeout(&["cluster-info".into()], KUBECTL_PROBE_TIMEOUT_SECS, None).await
        {
            snippets.insert(
                "kubectl_cluster_info".into(),
                truncate_snippet(&format!(
                    "exit={} stderr={}\n{}",
                    r.exit_code,
                    r.stderr.trim(),
                    r.stdout
                )),
            );
        }
        if let Ok(r) = run_kubectl_timeout(
            &["get".into(), "nodes".into(), "-o".into(), "wide".into()],
            KUBECTL_PROBE_TIMEOUT_SECS,
            None,
        )
        .await
        {
            snippets.insert(
                "kubectl_get_nodes_wide".into(),
                truncate_snippet(&format!(
                    "exit={} stderr={}\n{}",
                    r.exit_code,
                    r.stderr.trim(),
                    r.stdout
                )),
            );
        }
        if let Ok(r) = run_kubectl_timeout(
            &["get".into(), "--raw".into(), "/version".into()],
            KUBECTL_PROBE_TIMEOUT_SECS,
            None,
        )
        .await
        {
            snippets.insert(
                "kubectl_get_raw_version".into(),
                truncate_snippet(&r.stdout),
            );
        }
        if let Ok(r) = run_kubectl_timeout(
            &["config".into(), "get-contexts".into()],
            KUBECTL_PROBE_TIMEOUT_SECS,
            None,
        )
        .await
        {
            snippets.insert(
                "kubectl_config_get_contexts".into(),
                truncate_snippet(&r.stdout),
            );
        }
        if let Ok(r) = run_kubectl_timeout(
            &["api-resources".into(), "--verbs=list".into()],
            KUBECTL_PROBE_TIMEOUT_SECS,
            None,
        )
        .await
        {
            snippets.insert(
                "kubectl_api_resources_listable".into(),
                truncate_snippet(&r.stdout),
            );
        }
    }

    Ok(Json(K8sEnvironment {
        kubectl_on_path,
        kubectl_client_version: client_ver,
        kubectl_server_reachable: server_ok,
        kubeconfig_hint,
        kubeconfig_from_env,
        kubeconfig_auto_selected,
        current_context,
        cluster_distribution: dist.clone(),
        cluster_distribution_hints: hints.clone(),
        host,
        snippets,
    }))
}

async fn k8s_nodes(
    Extension(actor): Extension<RequestActor>,
    Query(q): Query<K8sContextQuery>,
) -> Result<Json<Vec<K8sNodeInfo>>, AppError> {
    require_browser_session_for_host_insight(&actor)?;
    let ctx = q.context.as_deref();
    if let Some(c) = ctx {
        ensure_k8s_context_name(c)?;
    }
    let v =
        run_kubectl_json_ctx(&["get".into(), "nodes".into()], KUBECTL_TIMEOUT_SECS, ctx).await?;
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
    let ctx = q.context.as_deref();
    if let Some(c) = ctx {
        ensure_k8s_context_name(c)?;
    }
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

    let v = run_kubectl_json_timeout(&args, KUBECTL_TIMEOUT_SECS, ctx).await?;
    Ok(Json(v))
}

async fn k8s_namespaces(
    Extension(actor): Extension<RequestActor>,
    Query(q): Query<K8sContextQuery>,
) -> Result<Json<Value>, AppError> {
    require_browser_session_for_host_insight(&actor)?;
    let ctx = q.context.as_deref();
    if let Some(c) = ctx {
        ensure_k8s_context_name(c)?;
    }
    let v = run_kubectl_json_ctx(
        &["get".into(), "namespaces".into()],
        KUBECTL_TIMEOUT_SECS,
        ctx,
    )
    .await?;
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

async fn k8s_statefulsets(
    Extension(actor): Extension<RequestActor>,
    Query(q): Query<K8sListQuery>,
) -> Result<Json<Value>, AppError> {
    k8s_resource_list(Extension(actor), Query(q), "statefulsets").await
}

async fn k8s_daemonsets(
    Extension(actor): Extension<RequestActor>,
    Query(q): Query<K8sListQuery>,
) -> Result<Json<Value>, AppError> {
    k8s_resource_list(Extension(actor), Query(q), "daemonsets").await
}

async fn k8s_jobs(
    Extension(actor): Extension<RequestActor>,
    Query(q): Query<K8sListQuery>,
) -> Result<Json<Value>, AppError> {
    k8s_resource_list(Extension(actor), Query(q), "jobs").await
}

async fn k8s_cronjobs(
    Extension(actor): Extension<RequestActor>,
    Query(q): Query<K8sListQuery>,
) -> Result<Json<Value>, AppError> {
    k8s_resource_list(Extension(actor), Query(q), "cronjobs").await
}

async fn k8s_ingresses(
    Extension(actor): Extension<RequestActor>,
    Query(q): Query<K8sListQuery>,
) -> Result<Json<Value>, AppError> {
    k8s_resource_list(Extension(actor), Query(q), "ingresses.networking.k8s.io").await
}

async fn k8s_persistentvolumeclaims(
    Extension(actor): Extension<RequestActor>,
    Query(q): Query<K8sListQuery>,
) -> Result<Json<Value>, AppError> {
    k8s_resource_list(Extension(actor), Query(q), "persistentvolumeclaims").await
}

async fn k8s_persistentvolumes(
    Extension(actor): Extension<RequestActor>,
    Query(q): Query<K8sContextQuery>,
) -> Result<Json<Value>, AppError> {
    require_browser_session_for_host_insight(&actor)?;
    let ctx = q.context.as_deref();
    if let Some(c) = ctx {
        ensure_k8s_context_name(c)?;
    }
    let args = vec!["get".into(), "persistentvolumes".into()];
    let v = run_kubectl_json_timeout(&args, KUBECTL_TIMEOUT_SECS, ctx).await?;
    Ok(Json(v))
}

async fn k8s_storageclasses(
    Extension(actor): Extension<RequestActor>,
    Query(q): Query<K8sContextQuery>,
) -> Result<Json<Value>, AppError> {
    require_browser_session_for_host_insight(&actor)?;
    let ctx = q.context.as_deref();
    if let Some(c) = ctx {
        ensure_k8s_context_name(c)?;
    }
    let args = vec!["get".into(), "storageclasses".into()];
    let v = run_kubectl_json_timeout(&args, KUBECTL_TIMEOUT_SECS, ctx).await?;
    Ok(Json(v))
}

async fn k8s_events(
    Extension(actor): Extension<RequestActor>,
    Query(q): Query<K8sEventsQuery>,
) -> Result<Json<Value>, AppError> {
    require_browser_session_for_host_insight(&actor)?;
    let ctx = q.context.as_deref();
    if let Some(c) = ctx {
        ensure_k8s_context_name(c)?;
    }
    let all_ns = q.all_namespaces.unwrap_or(false);
    let mut args = vec![
        "get".into(),
        "events".into(),
        "-o".into(),
        "json".into(),
        "--sort-by=.metadata.creationTimestamp".into(),
    ];
    if all_ns {
        args.push("-A".into());
    } else if let Some(ns) = q.namespace.clone() {
        ensure_safe_name(&ns, "namespace")?;
        args.push("-n".into());
        args.push(ns);
    } else {
        args.push("-n".into());
        args.push("default".into());
    }
    let v = run_kubectl_json_timeout(&args, KUBECTL_TIMEOUT_SECS, ctx).await?;
    Ok(Json(v))
}

async fn k8s_pod_logs(
    Extension(actor): Extension<RequestActor>,
    Query(q): Query<K8sLogsQuery>,
) -> Result<Json<KubectlResult>, AppError> {
    require_browser_session_for_host_insight(&actor)?;
    ensure_safe_name(&q.pod, "pod")?;
    let ns = safe_namespace(q.namespace.as_deref())?;
    let ctx = q.context.as_deref();
    if let Some(c) = ctx {
        ensure_k8s_context_name(c)?;
    }
    let tail = q.tail_lines.unwrap_or(200).clamp(1, 50_000);
    let mut args = vec![
        "logs".into(),
        q.pod.clone(),
        "-n".into(),
        ns,
        format!("--tail={tail}"),
    ];
    if let Some(ref c) = q.container {
        ensure_safe_name(c, "container")?;
        args.push("-c".into());
        args.push(c.clone());
    }
    if q.previous == Some(true) {
        args.push("--previous".into());
    }
    let res = run_kubectl_timeout(&args, KUBECTL_LOGS_TIMEOUT_SECS, ctx).await?;
    Ok(Json(res))
}

fn ensure_safe_k8s_token(s: &str, field: &str) -> Result<(), LibvirtError> {
    let t = s.trim();
    if t.is_empty() || t.len() > 80 {
        return Err(LibvirtError::Invalid(format!("{field} is invalid")));
    }
    let ok = t.chars().all(|c| {
        c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, '*' | '/' | '.' | '-')
    });
    if !ok {
        return Err(LibvirtError::Invalid(format!(
            "{field} has invalid characters"
        )));
    }
    Ok(())
}

async fn k8s_auth_can_i(
    Extension(actor): Extension<RequestActor>,
    Json(body): Json<K8sAuthCanIRequest>,
) -> Result<Json<KubectlResult>, AppError> {
    require_browser_session_for_host_insight(&actor)?;
    ensure_safe_k8s_token(&body.verb, "verb")?;
    ensure_safe_k8s_token(&body.resource, "resource")?;
    let ctx = body.context.as_deref();
    if let Some(c) = ctx {
        ensure_k8s_context_name(c)?;
    }
    let mut args = vec![
        "auth".into(),
        "can-i".into(),
        body.verb.clone(),
        body.resource.clone(),
    ];
    if let Some(ref n) = body.resource_name {
        ensure_safe_name(n, "resource_name")?;
        args.push(n.clone());
    }
    if let Some(ref ns) = body.namespace {
        ensure_safe_name(ns, "namespace")?;
        args.push("-n".into());
        args.push(ns.clone());
    }
    let res = run_kubectl_timeout(&args, KUBECTL_TIMEOUT_SECS, ctx).await?;
    Ok(Json(res))
}

async fn k8s_apply_manifest(
    Extension(actor): Extension<RequestActor>,
    Json(body): Json<K8sApplyRequest>,
) -> Result<Json<KubectlResult>, AppError> {
    require_browser_session_for_host_insight(&actor)?;
    if body.manifest.len() > KUBECTL_APPLY_MAX_MANIFEST_BYTES {
        return Err(LibvirtError::Invalid(format!(
            "manifest exceeds {} bytes",
            KUBECTL_APPLY_MAX_MANIFEST_BYTES
        ))
        .into());
    }
    let ctx = body.context.as_deref();
    if let Some(c) = ctx {
        ensure_k8s_context_name(c)?;
    }
    let path = std::env::temp_dir().join(format!(
        "machina-k8s-apply-{}.yaml",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    ));
    tokio::fs::write(&path, body.manifest.as_bytes())
        .await
        .map_err(|e| LibvirtError::Operation(format!("temp manifest: {e}")))?;
    let ps = path.to_string_lossy().to_string();
    let mut args = vec!["apply".into(), "-f".into(), ps.clone()];
    if body.dry_run == Some(true) {
        args.push("--dry-run=server".into());
    }
    let out = run_kubectl_timeout(&args, KUBECTL_TIMEOUT_SECS, ctx).await;
    let _ = tokio::fs::remove_file(&path).await;
    Ok(Json(out?))
}

async fn k8s_contexts_list(
    Extension(actor): Extension<RequestActor>,
) -> Result<Json<Value>, AppError> {
    require_browser_session_for_host_insight(&actor)?;
    let res = run_kubectl_timeout(
        &[
            "config".into(),
            "get-contexts".into(),
            "-o".into(),
            "name".into(),
        ],
        20,
        None,
    )
    .await?;
    let contexts: Vec<String> = res
        .stdout
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();
    Ok(Json(serde_json::json!({ "contexts": contexts })))
}

async fn run_helm_timeout(
    args: &[String],
    timeout_secs: u64,
) -> Result<KubectlResult, LibvirtError> {
    let mut cmd = Command::new("helm");
    cmd.args(args);
    let command_text = format!("helm {}", args.join(" "));
    let output = timeout(Duration::from_secs(timeout_secs), cmd.output())
        .await
        .map_err(|_| LibvirtError::Operation("helm command timed out".into()))?
        .map_err(|e| LibvirtError::Operation(format!("failed to start helm: {e}")))?;
    Ok(KubectlResult {
        command: command_text,
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
        ok: output.status.success(),
    })
}

async fn k8s_helm_releases(
    Extension(actor): Extension<RequestActor>,
    Query(q): Query<K8sHelmQuery>,
) -> Result<Json<Value>, AppError> {
    require_browser_session_for_host_insight(&actor)?;
    let ctx = q.context.as_deref();
    if let Some(c) = ctx {
        ensure_k8s_context_name(c)?;
    }
    let mut args: Vec<String> = Vec::new();
    if let Some(c) = ctx {
        args.push("--kube-context".into());
        args.push(c.to_string());
    }
    args.extend([
        "list".into(),
        "-o".into(),
        "json".into(),
        "--max".into(),
        "200".into(),
    ]);
    if q.namespace.as_deref() == Some("all") || q.namespace.as_deref() == Some("*") {
        args.push("-A".into());
    } else if let Some(ns) = q.namespace.clone() {
        ensure_safe_name(&ns, "namespace")?;
        args.push("-n".into());
        args.push(ns);
    } else {
        args.push("-A".into());
    }
    let res = run_helm_timeout(&args, 45).await?;
    if !res.ok {
        return Err(LibvirtError::Operation(res.stderr.clone()).into());
    }
    let v: Value = serde_json::from_str(&res.stdout)
        .map_err(|e| LibvirtError::Operation(format!("helm list JSON: {e}")))?;
    Ok(Json(v))
}

#[derive(Debug, Serialize)]
struct KubeVirtVmSummaryRow {
    name: String,
    namespace: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    spec_running: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    vm_printable_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    vm_ready: Option<bool>,
    /// Primary guest-visible IP(s) from the VMI `status.interfaces` list.
    #[serde(skip_serializing_if = "Option::is_none")]
    guest_ip: Option<String>,
    /// Virt-launcher / pod network IP when reported on the VMI (`status.podIP` or first interface).
    #[serde(skip_serializing_if = "Option::is_none")]
    pod_ip: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    vmi_phase: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    node_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    node_internal_ip: Option<String>,
    /// Run on a machine with cluster credentials (often same host as machina).
    virtctl_console: String,
    virtctl_vnc: String,
    /// `virtctl vnc` with SOCKS proxy for browsers / clients that support it.
    virtctl_vnc_socks: String,
    /// API path segment (use with `kubectl proxy` + authorized WebSocket client).
    vnc_subresource_path: String,
}

fn node_internal_ip_map(nodes: &[Value]) -> BTreeMap<String, String> {
    let mut m = BTreeMap::new();
    for n in nodes {
        let Some(name) = n
            .get("metadata")
            .and_then(|x| x.get("name"))
            .and_then(|x| x.as_str())
        else {
            continue;
        };
        let Some(addrs) = n
            .get("status")
            .and_then(|s| s.get("addresses"))
            .and_then(|x| x.as_array())
        else {
            continue;
        };
        for a in addrs {
            if a.get("type").and_then(|x| x.as_str()) == Some("InternalIP") {
                if let Some(ip) = a.get("address").and_then(|x| x.as_str()) {
                    m.insert(name.to_string(), ip.to_string());
                    break;
                }
            }
        }
    }
    m
}

fn vmi_guest_ips(vmi: &Value) -> Option<String> {
    let ifs = vmi
        .get("status")
        .and_then(|s| s.get("interfaces"))
        .and_then(|x| x.as_array())?;
    let mut ips = Vec::new();
    for i in ifs {
        if let Some(ip) = i.get("ipAddress").and_then(|x| x.as_str()) {
            if !ip.is_empty() && !ip.starts_with("127.") && !ips.iter().any(|e| e == ip) {
                ips.push(ip.to_string());
            }
        }
    }
    if ips.is_empty() {
        None
    } else {
        Some(ips.join(", "))
    }
}

fn vmi_pod_ip_strict(vmi: &Value) -> Option<String> {
    vmi.get("status")
        .and_then(|s| s.get("podIP"))
        .and_then(|x| x.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
}

fn vmi_node_and_phase(vmi: &Value) -> (Option<String>, Option<String>) {
    let st = vmi.get("status").and_then(|x| x.as_object());
    let node = st
        .and_then(|s| s.get("nodeName"))
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());
    let phase = st
        .and_then(|s| s.get("phase"))
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());
    (node, phase)
}

fn index_vmi_by_ns_name(items: &[Value]) -> BTreeMap<(String, String), Value> {
    let mut m = BTreeMap::new();
    for item in items {
        let meta = item.get("metadata").and_then(|x| x.as_object());
        let Some(ns) = meta
            .and_then(|x| x.get("namespace"))
            .and_then(|x| x.as_str())
        else {
            continue;
        };
        let Some(name) = meta.and_then(|x| x.get("name")).and_then(|x| x.as_str()) else {
            continue;
        };
        m.insert((ns.to_string(), name.to_string()), item.clone());
    }
    m
}

/// True when the API server has no KubeVirt `VirtualMachine` CRD (or similar), so an empty list is OK.
fn kubevirt_vm_list_unavailable(err: &LibvirtError) -> bool {
    let LibvirtError::Operation(msg) = err else {
        return false;
    };
    let m = msg.to_lowercase();
    m.contains("the server doesn't have a resource type")
        || m.contains("couldn't find resource")
        || m.contains("no matches for kind")
        || m.contains("does not support")
        || m.contains("unable to recognize")
}

/// `kubectl get virtualmachines.kubevirt.io` (KubeVirt). Returns an empty list when the CRD is not installed.
async fn k8s_kubevirt_virtualmachines(
    Extension(actor): Extension<RequestActor>,
    Query(q): Query<K8sListQuery>,
) -> Result<Json<Value>, AppError> {
    require_browser_session_for_host_insight(&actor)?;
    let ctx = q.context.as_deref();
    if let Some(c) = ctx {
        ensure_k8s_context_name(c)?;
    }
    if let Some(ns) = q.namespace.as_deref() {
        ensure_safe_name(ns, "namespace")?;
    }
    let all_ns = q.all_namespaces.unwrap_or(false);

    let mut args = vec!["get".into(), "virtualmachines.kubevirt.io".into()];
    if all_ns {
        args.push("-A".into());
    } else if let Some(ns) = q.namespace.clone() {
        args.push("-n".into());
        args.push(ns);
    }

    match run_kubectl_json_timeout(&args, KUBECTL_TIMEOUT_SECS, ctx).await {
        Ok(v) => Ok(Json(v)),
        Err(e) if kubevirt_vm_list_unavailable(&e) => {
            warn!("kubevirt VirtualMachine list skipped: {e}");
            Ok(Json(serde_json::json!({
                "apiVersion": "v1",
                "items": [],
                "kind": "List",
                "metadata": {}
            })))
        }
        Err(e) => Err(e.into()),
    }
}

/// VirtualMachines merged with VMIs and node InternalIPs, plus copy-paste `virtctl` / VNC API paths.
async fn k8s_kubevirt_vm_summary(
    Extension(actor): Extension<RequestActor>,
    Query(q): Query<K8sListQuery>,
) -> Result<Json<Vec<KubeVirtVmSummaryRow>>, AppError> {
    require_browser_session_for_host_insight(&actor)?;
    let ctx = q.context.as_deref();
    if let Some(c) = ctx {
        ensure_k8s_context_name(c)?;
    }
    if let Some(ns) = q.namespace.as_deref() {
        ensure_safe_name(ns, "namespace")?;
    }
    let all_ns = q.all_namespaces.unwrap_or(false);

    let mut vm_args = vec!["get".into(), "virtualmachines.kubevirt.io".into()];
    if all_ns {
        vm_args.push("-A".into());
    } else if let Some(ns) = q.namespace.clone() {
        vm_args.push("-n".into());
        vm_args.push(ns);
    }

    let vm_json = match run_kubectl_json_timeout(&vm_args, KUBECTL_TIMEOUT_SECS, ctx).await {
        Ok(v) => v,
        Err(e) if kubevirt_vm_list_unavailable(&e) => {
            return Ok(Json(vec![]));
        }
        Err(e) => return Err(e.into()),
    };

    let mut vmi_args = vec!["get".into(), "virtualmachineinstances.kubevirt.io".into()];
    if all_ns {
        vmi_args.push("-A".into());
    } else if let Some(ns) = q.namespace.clone() {
        vmi_args.push("-n".into());
        vmi_args.push(ns);
    }

    let args_nodes = vec!["get".into(), "nodes".into()];
    let (vmi_res, nodes_res) = tokio::join!(
        run_kubectl_json_timeout(&vmi_args, KUBECTL_TIMEOUT_SECS, ctx),
        run_kubectl_json_timeout(&args_nodes, KUBECTL_TIMEOUT_SECS, ctx),
    );

    let vmi_items = match vmi_res {
        Ok(v) => v
            .get("items")
            .and_then(|x| x.as_array())
            .cloned()
            .unwrap_or_default(),
        Err(e) if kubevirt_vm_list_unavailable(&e) => {
            warn!("kubevirt VMI list skipped: {e}");
            vec![]
        }
        Err(e) => return Err(e.into()),
    };

    let node_items = nodes_res
        .ok()
        .and_then(|v| v.get("items").and_then(|x| x.as_array()).cloned())
        .unwrap_or_default();
    let node_ips = node_internal_ip_map(&node_items);
    let vmi_index = index_vmi_by_ns_name(&vmi_items);

    let vm_items = vm_json
        .get("items")
        .and_then(|x| x.as_array())
        .cloned()
        .unwrap_or_default();

    let mut rows = Vec::with_capacity(vm_items.len());
    for vm in vm_items {
        let meta = vm.get("metadata").and_then(|x| x.as_object());
        let Some(ns) = meta
            .and_then(|m| m.get("namespace"))
            .and_then(|x| x.as_str())
        else {
            continue;
        };
        let Some(name) = meta.and_then(|m| m.get("name")).and_then(|x| x.as_str()) else {
            continue;
        };

        let spec_running = vm
            .get("spec")
            .and_then(|s| s.get("running"))
            .and_then(|x| x.as_bool());
        let vm_printable_status = vm
            .get("status")
            .and_then(|s| s.get("printableStatus"))
            .and_then(|x| x.as_str())
            .map(|s| s.to_string());
        let vm_ready = vm
            .get("status")
            .and_then(|s| s.get("ready"))
            .and_then(|x| x.as_bool());

        let key = (ns.to_string(), name.to_string());
        let (guest_ip, pod_ip, node_name, vmi_phase) = if let Some(vmi) = vmi_index.get(&key) {
            let guest = vmi_guest_ips(vmi);
            let pod = vmi_pod_ip_strict(vmi);
            let (nn, ph) = vmi_node_and_phase(vmi);
            (guest, pod, nn, ph)
        } else {
            (None, None, None, None)
        };

        let node_internal_ip = node_name.as_ref().and_then(|nn| node_ips.get(nn).cloned());

        let virtctl_console = format!("virtctl console {name} -n {ns}");
        let virtctl_vnc = format!("virtctl vnc {name} -n {ns}");
        let virtctl_vnc_socks = format!("virtctl vnc {name} -n {ns} --proxy-only");
        let vnc_subresource_path = format!(
            "/apis/subresources.kubevirt.io/v1/namespaces/{ns}/virtualmachineinstances/{name}/vnc"
        );

        rows.push(KubeVirtVmSummaryRow {
            name: name.to_string(),
            namespace: ns.to_string(),
            spec_running,
            vm_printable_status,
            vm_ready,
            guest_ip,
            pod_ip,
            vmi_phase,
            node_name,
            node_internal_ip,
            virtctl_console,
            virtctl_vnc,
            virtctl_vnc_socks,
            vnc_subresource_path,
        });
    }

    Ok(Json(rows))
}

async fn k8s_overview(
    Extension(actor): Extension<RequestActor>,
    Query(q): Query<K8sOverviewQuery>,
) -> Result<Json<K8sOverview>, AppError> {
    require_browser_session_for_host_insight(&actor)?;

    let host = collect_host_signals().await;
    let ctx = q.context.as_deref();
    if let Some(c) = ctx {
        ensure_k8s_context_name(c)?;
    }

    let (
        version_res,
        nodes_res,
        ns_res,
        pods_res,
        deploys_res,
        svc_res,
        sts_res,
        ds_res,
        cj_res,
        job_res,
        pv_res,
        pvc_res,
        sc_res,
        ing_res,
        apisvc_res,
        kvvm_res,
    ) = {
        let args_version = vec!["version".into()];
        let args_nodes = vec!["get".into(), "nodes".into()];
        let args_ns = vec!["get".into(), "namespaces".into()];
        let args_pods = vec!["get".into(), "pods".into(), "-A".into()];
        let args_deploy = vec!["get".into(), "deployments".into(), "-A".into()];
        let args_svc = vec!["get".into(), "services".into(), "-A".into()];
        let args_sts = vec!["get".into(), "statefulsets".into(), "-A".into()];
        let args_ds = vec!["get".into(), "daemonsets".into(), "-A".into()];
        let args_cj = vec!["get".into(), "cronjobs".into(), "-A".into()];
        let args_jobs = vec!["get".into(), "jobs".into(), "-A".into()];
        let args_pv = vec!["get".into(), "persistentvolumes".into()];
        let args_pvc = vec!["get".into(), "persistentvolumeclaims".into(), "-A".into()];
        let args_sc = vec!["get".into(), "storageclasses".into()];
        let args_ing = vec![
            "get".into(),
            "ingresses.networking.k8s.io".into(),
            "-A".into(),
        ];
        let args_apisvc = vec!["get".into(), "apiservices".into()];
        let args_kvvm = vec![
            "get".into(),
            "virtualmachines.kubevirt.io".into(),
            "-A".into(),
        ];

        tokio::join!(
            run_kubectl_json_timeout(&args_version, KUBECTL_TIMEOUT_SECS, ctx),
            run_kubectl_json_timeout(&args_nodes, KUBECTL_TIMEOUT_SECS, ctx),
            run_kubectl_json_timeout(&args_ns, KUBECTL_TIMEOUT_SECS, ctx),
            run_kubectl_json_timeout(&args_pods, KUBECTL_TIMEOUT_SECS, ctx),
            run_kubectl_json_timeout(&args_deploy, KUBECTL_TIMEOUT_SECS, ctx),
            run_kubectl_json_timeout(&args_svc, KUBECTL_TIMEOUT_SECS, ctx),
            run_kubectl_json_timeout(&args_sts, KUBECTL_TIMEOUT_SECS, ctx),
            run_kubectl_json_timeout(&args_ds, KUBECTL_TIMEOUT_SECS, ctx),
            run_kubectl_json_timeout(&args_cj, KUBECTL_TIMEOUT_SECS, ctx),
            run_kubectl_json_timeout(&args_jobs, KUBECTL_TIMEOUT_SECS, ctx),
            run_kubectl_json_timeout(&args_pv, KUBECTL_TIMEOUT_SECS, ctx),
            run_kubectl_json_timeout(&args_pvc, KUBECTL_TIMEOUT_SECS, ctx),
            run_kubectl_json_timeout(&args_sc, KUBECTL_TIMEOUT_SECS, ctx),
            run_kubectl_json_timeout(&args_ing, KUBECTL_TIMEOUT_SECS, ctx),
            run_kubectl_json_timeout(&args_apisvc, KUBECTL_TIMEOUT_SECS, ctx),
            run_kubectl_json_timeout(&args_kvvm, KUBECTL_TIMEOUT_SECS, ctx),
        )
    };

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
        .as_ref()
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

    let namespaces = count_list_items(&ns_res);
    let pods = count_list_items(&pods_res);
    let deployments = count_list_items(&deploys_res);
    let services = count_list_items(&svc_res);

    let mut extra_resource_counts = BTreeMap::new();
    extra_resource_counts.insert("statefulsets".into(), count_list_items(&sts_res));
    extra_resource_counts.insert("daemonsets".into(), count_list_items(&ds_res));
    extra_resource_counts.insert("cronjobs".into(), count_list_items(&cj_res));
    extra_resource_counts.insert("jobs".into(), count_list_items(&job_res));
    extra_resource_counts.insert("persistentvolumes".into(), count_list_items(&pv_res));
    extra_resource_counts.insert("persistentvolumeclaims".into(), count_list_items(&pvc_res));
    extra_resource_counts.insert("storageclasses".into(), count_list_items(&sc_res));
    extra_resource_counts.insert("ingresses".into(), count_list_items(&ing_res));
    extra_resource_counts.insert("apiservices".into(), count_list_items(&apisvc_res));
    extra_resource_counts.insert(
        "kubevirt_virtualmachines".into(),
        count_list_items(&kvvm_res),
    );

    let (distribution, distribution_hints) = infer_cluster_distribution(&nodes, &host);

    Ok(Json(K8sOverview {
        version,
        nodes: nodes.len(),
        ready_nodes,
        namespaces,
        pods,
        deployments,
        services,
        distribution,
        distribution_hints,
        extra_resource_counts,
    }))
}

async fn k8s_action(
    Extension(actor): Extension<RequestActor>,
    Json(req): Json<K8sActionRequest>,
) -> Result<Json<KubectlResult>, AppError> {
    require_browser_session_for_host_insight(&actor)?;
    ensure_safe_name(&req.name, "name")?;
    let ctx = req.context.as_deref();
    if let Some(c) = ctx {
        ensure_k8s_context_name(c)?;
    }

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
        K8sAction::RolloutRestartStatefulSet => {
            let ns = safe_namespace(req.namespace.as_deref())?;
            vec![
                "rollout".into(),
                "restart".into(),
                format!("statefulset/{}", req.name),
                "-n".into(),
                ns,
            ]
        }
        K8sAction::RolloutRestartDaemonSet => {
            let ns = safe_namespace(req.namespace.as_deref())?;
            vec![
                "rollout".into(),
                "restart".into(),
                format!("daemonset/{}", req.name),
                "-n".into(),
                ns,
            ]
        }
        K8sAction::DeletePod => {
            let ns = safe_namespace(req.namespace.as_deref())?;
            vec!["delete".into(), "pod".into(), req.name, "-n".into(), ns]
        }
        K8sAction::DeleteJob => {
            let ns = safe_namespace(req.namespace.as_deref())?;
            vec!["delete".into(), "job".into(), req.name, "-n".into(), ns]
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
        K8sAction::ScaleStatefulSet => {
            let ns = safe_namespace(req.namespace.as_deref())?;
            let replicas = req
                .replicas
                .ok_or_else(|| LibvirtError::Invalid("replicas is required".into()))?;
            vec![
                "scale".into(),
                format!("statefulset/{}", req.name),
                format!("--replicas={replicas}"),
                "-n".into(),
                ns,
            ]
        }
    };

    let res = run_kubectl_timeout(&args, KUBECTL_TIMEOUT_SECS, ctx).await?;
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
    let apply = Router::new()
        .route("/k8s/apply", post(k8s_apply_manifest))
        .layer(DefaultBodyLimit::max(
            KUBECTL_APPLY_MAX_MANIFEST_BYTES + 64 * 1024,
        ));

    Router::new()
        .merge(apply)
        .route("/k8s/overview", get(k8s_overview))
        .route("/k8s/environment", get(k8s_environment))
        .route("/k8s/contexts", get(k8s_contexts_list))
        .route("/k8s/nodes", get(k8s_nodes))
        .route("/k8s/namespaces", get(k8s_namespaces))
        .route("/k8s/pods", get(k8s_pods))
        .route("/k8s/deployments", get(k8s_deployments))
        .route("/k8s/services", get(k8s_services))
        .route("/k8s/statefulsets", get(k8s_statefulsets))
        .route("/k8s/daemonsets", get(k8s_daemonsets))
        .route("/k8s/jobs", get(k8s_jobs))
        .route("/k8s/cronjobs", get(k8s_cronjobs))
        .route("/k8s/ingresses", get(k8s_ingresses))
        .route(
            "/k8s/persistentvolumeclaims",
            get(k8s_persistentvolumeclaims),
        )
        .route("/k8s/persistentvolumes", get(k8s_persistentvolumes))
        .route("/k8s/storageclasses", get(k8s_storageclasses))
        .route("/k8s/events", get(k8s_events))
        .route("/k8s/logs", get(k8s_pod_logs))
        .route("/k8s/auth-can-i", post(k8s_auth_can_i))
        .route("/k8s/helm/releases", get(k8s_helm_releases))
        .route(
            "/k8s/kubevirt/virtualmachines",
            get(k8s_kubevirt_virtualmachines),
        )
        .route("/k8s/kubevirt/vm-summary", get(k8s_kubevirt_vm_summary))
        .route("/k8s/action", post(k8s_action))
}
