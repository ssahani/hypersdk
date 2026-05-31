// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Helm-based Tetragon install for Kubernetes clusters.

use std::process::Command;

use crate::config::ControllerConfig;

pub struct K8sTetragonInstallResult {
    pub ok: bool,
    pub helm_output: String,
    pub message: String,
}

fn helm_available() -> bool {
    Command::new("helm")
        .arg("version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

pub fn install_tetragon_helm(
    cfg: &ControllerConfig,
    namespace: &str,
    cluster_name: &str,
) -> K8sTetragonInstallResult {
    if !helm_available() {
        return K8sTetragonInstallResult {
            ok: false,
            helm_output: String::new(),
            message: "helm not found on controller — install Helm CLI or run enrollment from a bastion".into(),
        };
    }

    let export_url = if cfg.packetwolf_enabled {
        format!(
            "{}/api/v1/ingest",
            cfg.packetwolf_base_url.trim_end_matches('/')
        )
    } else {
        "http://127.0.0.1:9091/api/v1/ingest".into()
    };

    let _ = Command::new("helm")
        .args(["repo", "add", "cilium", "https://helm.cilium.io/"])
        .output();
    let _ = Command::new("helm")
        .args(["repo", "update", "cilium"])
        .output();

    let values = format!(
        "tetragon.enabled=true,tetragon.export.stdout.enabled=true,tetragon.exportAllowList={{\"process_exec\",\"process_exit\",\"process_kprobe\"}}"
    );
    let output = Command::new("helm")
        .args([
            "upgrade",
            "--install",
            "tetragon",
            "cilium/tetragon",
            "--namespace",
            namespace,
            "--create-namespace",
            "--set",
            &values,
        ])
        .output();

    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout).into_owned();
            let stderr = String::from_utf8_lossy(&o.stderr).into_owned();
            let combined = format!("{stdout}{stderr}").trim().to_string();
            K8sTetragonInstallResult {
                ok: o.status.success(),
                helm_output: combined.clone(),
                message: if o.status.success() {
                    format!(
                        "Tetragon Helm release installed in {namespace} for cluster {cluster_name}; configure PacketWolf export at {export_url}"
                    )
                } else {
                    format!("Helm install failed: {combined}")
                },
            }
        }
        Err(e) => K8sTetragonInstallResult {
            ok: false,
            helm_output: String::new(),
            message: format!("helm exec failed: {e}"),
        },
    }
}
