// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct MissionStackPlan {
    pub label: String,
    pub review: String,
    pub gpu_node_count: i32,
    pub inference_ready: bool,
    pub preview_only: bool,
    pub estimated_monthly_usd: f64,
    pub phases: Vec<MissionStackPhase>,
}

#[derive(Debug, Serialize)]
pub struct MissionStackPhase {
    pub name: String,
    pub steps: Vec<String>,
    pub automated: bool,
}

pub fn plan_mission_stack(query: &str, vcpu_rate: f64, gib_rate: f64) -> MissionStackPlan {
    let ql = query.to_lowercase();
    let gpu_nodes = if ql.contains("cluster") { 4 } else { 2 };
    let vcpus = 16 * gpu_nodes;
    let mem_gib = 64 * gpu_nodes;
    let hourly = vcpus as f64 * vcpu_rate + mem_gib as f64 * gib_rate;
    let estimated_monthly_usd = hourly * 730.0;

    let label = if ql.contains("llama") || ql.contains("inference") {
        "GPU inference stack for Llama serving".into()
    } else if ql.contains("gpu") {
        "GPU compute cluster".into()
    } else {
        "AI mission stack".into()
    };

    let phases = vec![
        MissionStackPhase {
            name: "Infrastructure".into(),
            steps: vec![
                format!("Create {gpu_nodes} GPU-capable VMs (16 vCPU, 64 GiB each)"),
                "Create isolated high-bandwidth network segment".into(),
                "Provision NVMe storage pool for model weights".into(),
            ],
            automated: true,
        },
        MissionStackPhase {
            name: "Kubernetes".into(),
            steps: vec![
                "Install K3s/RKE2 control plane on node-01".into(),
                "Join worker nodes with GPU taints".into(),
                "Install NVIDIA GPU Operator / device plugin".into(),
            ],
            automated: false,
        },
        MissionStackPhase {
            name: "Inference".into(),
            steps: vec![
                "Deploy vLLM or TGI Helm chart".into(),
                "Mount model volume from storage pool".into(),
                "Expose inference API behind platform load balancer".into(),
            ],
            automated: false,
        },
    ];

    MissionStackPlan {
        review: format!(
            "{gpu_nodes} GPU nodes · ~${estimated_monthly_usd:.0}/mo infra · K8s + inference phases require review"
        ),
        label,
        gpu_node_count: gpu_nodes,
        inference_ready: false,
        preview_only: true,
        estimated_monthly_usd,
        phases,
    }
}
