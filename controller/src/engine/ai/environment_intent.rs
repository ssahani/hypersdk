// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use serde::Serialize;

use super::intent_router::SpotlightIntent;

#[derive(Debug, Serialize)]
pub struct EnvironmentResourcePlan {
    pub label: String,
    pub review: String,
    pub developer_count: i32,
    pub vm_count: i32,
    pub vcpus_per_vm: i32,
    pub memory_gib_per_vm: i32,
    pub total_vcpus: i32,
    pub total_memory_gib: i32,
    pub storage_gib: i32,
    pub network: String,
    pub backup_policy: String,
    pub estimated_monthly_usd: f64,
    pub environment_type: String,
    pub gpu_required: bool,
    pub preview_only: bool,
    pub build_steps: Vec<String>,
    pub spotlight_intents: Vec<SpotlightIntent>,
}

pub fn plan_environment(query: &str, vcpu_rate: f64, gib_rate: f64) -> EnvironmentResourcePlan {
    let ql = query.to_lowercase();
    let gpu_required = ql.contains("gpu") || ql.contains("llama") || ql.contains("inference")
        || ql.contains("cuda") || ql.contains("training");

    let developers = extract_count(&ql, &["developer", "developers", "engineer", "engineers", "user", "users"])
        .unwrap_or_else(|| {
            if ql.contains("team") { 10 } else { 5 }
        });

    let env_type = if ql.contains("prod") || ql.contains("production") {
        "production"
    } else if ql.contains("staging") || ql.contains("stage") {
        "staging"
    } else if ql.contains("dev") {
        "development"
    } else {
        "general"
    };

    let size = if ql.contains("large") || ql.contains("gpu cluster") {
        "large"
    } else if ql.contains("small") || ql.contains("minimal") {
        "small"
    } else if ql.contains("medium") {
        "medium"
    } else if developers >= 30 {
        "large"
    } else if developers <= 8 {
        "small"
    } else {
        "medium"
    };

    let (vcpus, mem_gib) = match size {
        "large" => (8, 32),
        "small" => (2, 8),
        _ => (4, 16),
    };

    let vm_count = if gpu_required {
        (developers / 4).max(2).min(16)
    } else {
        developers.max(1).min(40)
    };

    let total_vcpus = vm_count * vcpus;
    let total_memory_gib = vm_count * mem_gib;
    let storage_gib = vm_count * if env_type == "production" { 200 } else { 80 };
    let hourly = total_vcpus as f64 * vcpu_rate + total_memory_gib as f64 * gib_rate;
    let estimated_monthly_usd = hourly * 730.0;

    let backup_policy = match env_type {
        "production" => "daily + 7d retention",
        "staging" => "weekly snapshots",
        _ => "on-demand backups",
    };

    let network = if env_type == "production" {
        "isolated prod VLAN + LB segment"
    } else {
        "shared dev/staging network"
    };

    let label = if gpu_required {
        format!("GPU cluster preview for {developers} seats")
    } else {
        format!("{env_type} environment for {developers} developers")
    };

    let review = format!(
        "{vm_count} VMs × {vcpus} vCPU × {mem_gib} GiB, {storage_gib} GiB storage, ~${estimated_monthly_usd:.0}/mo"
    );

    let mut build_steps = vec![
        format!("Provision {vm_count} VMs on {network}"),
        format!("Attach {storage_gib} GiB total storage ({backup_policy})"),
        "Import networks and storage pools if missing".into(),
    ];

    if gpu_required {
        build_steps.push("GPU passthrough / KubeVirt GPU operator (preview — manual validation required)".into());
        build_steps.push("Deploy inference stack via blueprint (coming soon)".into());
    } else {
        build_steps.push("Apply backup policy via blueprint".into());
    }

    let mut spotlight_intents = Vec::new();
    for i in 0..vm_count.min(5) {
        let name = format!("{env_type}-dev-{:02}", i + 1);
        spotlight_intents.push(super::intent_router::intent(
            &format!("env-vm-{i}"),
            &format!("Create VM {name}"),
            &format!("{vcpus} vCPU, {mem_gib} GiB — part of {label}"),
            "create_vm",
            Some(name),
            None,
            Some(serde_json::json!({
                "name": format!("{env_type}-dev-{:02}", i + 1),
                "os": "ubuntu-24.04",
                "size": size,
                "network": "default",
                "cores": vcpus,
                "memory_gib": mem_gib,
            })),
        ));
    }

    EnvironmentResourcePlan {
        label,
        review,
        developer_count: developers,
        vm_count,
        vcpus_per_vm: vcpus,
        memory_gib_per_vm: mem_gib,
        total_vcpus,
        total_memory_gib,
        storage_gib,
        network: network.into(),
        backup_policy: backup_policy.into(),
        estimated_monthly_usd,
        environment_type: env_type.into(),
        gpu_required,
        preview_only: gpu_required,
        build_steps,
        spotlight_intents,
    }
}

fn extract_count(hay: &str, units: &[&str]) -> Option<i32> {
    for unit in units {
        if let Some(idx) = hay.find(unit) {
            let prefix = hay[..idx].trim();
            let num: String = prefix
                .chars()
                .rev()
                .take_while(|c| c.is_ascii_digit())
                .collect::<String>()
                .chars()
                .rev()
                .collect();
            if let Ok(n) = num.parse::<i32>() {
                if n > 0 && n <= 10_000 {
                    return Some(n);
                }
            }
        }
    }
    if let Some(n) = hay.split_whitespace().find_map(|w| w.parse::<i32>().ok()) {
        if n > 0 && n <= 10_000 {
            return Some(n);
        }
    }
    None
}
