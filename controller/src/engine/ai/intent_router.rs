// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct SpotlightIntent {
    pub id: String,
    pub label: String,
    pub review: String,
    pub action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vm_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub navigate: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prefill: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SearchHit {
    pub kind: String,
    pub id: String,
    pub label: String,
    pub sublabel: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SpotlightResult {
    pub intents: Vec<SpotlightIntent>,
    pub search_hits: Vec<SearchHit>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggested_action: Option<SpotlightIntent>,
}

pub fn route_spotlight(query: &str, online_hosts: i64, vm_hits: Vec<SearchHit>) -> SpotlightResult {
    let q = query.trim();
    let mut intents = Vec::new();
    let mut search_hits = vm_hits;

    if q.is_empty() {
        return SpotlightResult {
            intents,
            search_hits,
            suggested_action: None,
        };
    }

    let ql = q.to_lowercase();

    if ql.contains("import") && ql.contains("network") {
        intents.push(intent(
            "import-networks",
            "Import networks",
            &format!("Import libvirt networks from {online_hosts} online host(s)."),
            "import_networks",
            None,
            None,
            None,
        ));
    }
    if ql.contains("import") && ql.contains("storage") {
        intents.push(intent(
            "import-storage",
            "Import storage",
            &format!("Discover storage pools from {online_hosts} online host(s)."),
            "import_storage",
            None,
            None,
            None,
        ));
    }
    if ql.contains("sync") && ql.contains("host") {
        intents.push(intent(
            "sync-hosts",
            "Sync hosts",
            "Queue inventory sync for all hypervisors.",
            "sync_hosts",
            None,
            None,
            None,
        ));
    }
    if ql.contains("offline") && ql.contains("host") {
        intents.push(intent(
            "show-offline-hosts",
            "Show offline hosts",
            "Navigate to hosts filtered to offline.",
            "navigate",
            None,
            Some("/platform/hosts?filter=offline".into()),
            None,
        ));
    }
    if let Some(name) = extract_after(&ql, "create vm ") {
        intents.push(intent(
            "create-vm",
            "Create VM",
            &format!("Open VM wizard for \"{name}\"."),
            "create_vm",
            Some(name.to_string()),
            None,
            None,
        ));
    } else if let Some(create) = parse_nl_create_vm(q) {
        intents.push(create);
    }
    if ql.contains("high cpu") || ql.contains("cpu") && ql.contains("consum") {
        intents.push(intent(
            "high-cpu",
            "High CPU VMs",
            "Open Activity Monitor sorted by CPU.",
            "navigate",
            None,
            Some("/platform/activity".into()),
            None,
        ));
    }
    if ql.contains("failed") && ql.contains("migrat") {
        intents.push(intent(
            "failed-migrations",
            "Failed migrations",
            "View migration tasks and jobs.",
            "navigate",
            None,
            Some("/platform/migration".into()),
            None,
        ));
    }
    if ql.contains("cost") || ql.contains("finops") {
        intents.push(intent(
            "cost-guardian",
            "Cost Guardian",
            "Open FinOps and rightsizing report.",
            "navigate",
            None,
            Some("/platform/reports".into()),
            None,
        ));
    }
    if ql.contains("capacity") || ql.contains("headroom") {
        intents.push(intent(
            "capacity",
            "Capacity Planner",
            "View cluster capacity and projections.",
            "navigate",
            None,
            Some("/platform/reports".into()),
            None,
        ));
    }
    if ql.contains("security") || ql.contains("risk") {
        intents.push(intent(
            "security",
            "Security Sentinel",
            "View security findings.",
            "navigate",
            None,
            Some("/platform/reports".into()),
            None,
        ));
    }
    if ql.contains("reach") || (ql.contains("can't") && ql.contains("connect")) || ql.contains("network path") {
        intents.push(intent(
            "network-lens",
            "Network Lens",
            "Analyze VM-to-VM connectivity on Topology.",
            "navigate",
            None,
            Some("/platform/topology".into()),
            None,
        ));
    }

    if let Some(vm_name) = extract_nl_vm_name(q) {
        if ql.contains("backup") || ql.contains("back up") {
            let label = format!("Backup VM {vm_name}");
            let review = format!("Queue a backup for {vm_name} — review before running.");
            intents.push(intent(
                "backup-vm",
                &label,
                &review,
                "backup_vm",
                Some(vm_name.clone()),
                None,
                None,
            ));
        }
        if ql.contains("migrate") {
            let target = extract_after(&ql, "to host ")
                .or_else(|| extract_after(&ql, " onto "))
                .or_else(|| extract_after(&ql, " to "))
                .map(|s| s.to_string());
            let review = match &target {
                Some(h) => format!("Migrate {vm_name} to host {h} — pre-check and review required."),
                None => format!("Open migration workflow for {vm_name}."),
            };
            let label = format!("Migrate VM {vm_name}");
            intents.push(intent(
                "migrate-vm",
                &label,
                &review,
                "migrate_vm",
                Some(vm_name.clone()),
                None,
                target.map(|host| serde_json::json!({ "target_host": host })),
            ));
        }
        if (ql.contains("enable") || ql.contains("turn on")) && ql.contains("ha") {
            let label = format!("Enable HA for {vm_name}");
            let review = format!("Enable high availability policy for {vm_name} — review before applying.");
            intents.push(intent(
                "enable-ha-vm",
                &label,
                &review,
                "enable_ha_vm",
                Some(vm_name),
                None,
                None,
            ));
        }
    }

    if ql.contains("environment") || ql.contains("gpu cluster")
        || (ql.contains("staging") && (ql.contains("for") || ql.contains("developer")))
        || ql.contains("medium staging")
    {
        let plan = super::environment_intent::plan_environment(q, 0.04, 0.008);
        let label = plan.label.clone();
        let review = plan.review.clone();
        intents.push(intent(
            "environment-plan",
            &label,
            &review,
            "environment_plan",
            None,
            Some("/platform/topology".into()),
            Some(serde_json::json!({ "query": q })),
        ));
    }

    if ql.contains("what breaks") || ql.contains("shut down") || (ql.contains("shutdown") && ql.contains("host")) {
        let host_hint = extract_after(&ql, "host ")
            .or_else(|| extract_after(&ql, "down "))
            .unwrap_or("host-01");
        let label = format!("Impact: shutdown host {host_hint}");
        let review = format!("Simulate blast radius if host {host_hint} goes offline.");
        intents.push(intent(
            "twin-impact",
            &label,
            &review,
            "twin_impact",
            None,
            Some("/platform/topology".into()),
            Some(serde_json::json!({
                "action": "shutdown",
                "target_kind": "host",
                "target_id": host_hint,
            })),
        ));
    }

    let suggested_action = intents.first().cloned();
    SpotlightResult {
        intents,
        search_hits,
        suggested_action,
    }
}

pub fn intent(
    id: &str,
    label: &str,
    review: &str,
    action: &str,
    vm_name: Option<String>,
    navigate: Option<String>,
    prefill: Option<serde_json::Value>,
) -> SpotlightIntent {
    SpotlightIntent {
        id: id.into(),
        label: label.into(),
        review: review.into(),
        action: action.into(),
        vm_name,
        navigate,
        prefill,
    }
}

fn extract_after<'a>(hay: &'a str, needle: &str) -> Option<&'a str> {
    let idx = hay.find(needle)?;
    let rest = hay[idx + needle.len()..].trim();
    if rest.is_empty() {
        None
    } else {
        Some(rest.split_whitespace().next().unwrap_or(rest))
    }
}

fn parse_nl_create_vm(query: &str) -> Option<SpotlightIntent> {
    let ql = query.to_lowercase();
    let wants_vm = ql.contains("create")
        && (ql.contains("vm")
            || ql.contains("vcpu")
            || ql.contains("windows")
            || ql.contains("linux")
            || ql.contains("ubuntu"));
    if !wants_vm {
        return None;
    }

    let cores = extract_number_before(&ql, &["vcpu", "vcpus", "cpu", "cpus", "core", "cores"]);
    let memory_gib = extract_memory_gib(&ql);
    let os = if ql.contains("windows") {
        "windows-server-2022"
    } else if ql.contains("rocky") {
        "rocky-9"
    } else if ql.contains("debian") {
        "debian-12"
    } else {
        "ubuntu-24.04"
    };

    let name = extract_quoted_name(query)
        .or_else(|| extract_after(&ql, "named ").map(|s| s.to_string()))
        .or_else(|| extract_after(&ql, "called ").map(|s| s.to_string()))
        .or_else(|| {
            query
                .split_whitespace()
                .find(|w| w.contains('-') && w.len() > 2)
                .map(|s| s.trim_matches(|c: char| !c.is_alphanumeric() && c != '-').to_string())
        })
        .unwrap_or_else(|| "new-vm".into());

    let size = match (cores, memory_gib) {
        (Some(c), Some(m)) if c >= 8 || m >= 16 => "large",
        (Some(c), Some(m)) if c >= 4 || m >= 8 => "medium",
        _ => "small",
    };

    let review = match (cores, memory_gib) {
        (Some(c), Some(m)) => format!("Create {name} — {c} vCPU, {m} GiB, {os}."),
        (Some(c), None) => format!("Create {name} — {c} vCPU, {os}."),
        (None, Some(m)) => format!("Create {name} — {m} GiB RAM, {os}."),
        _ => format!("Create {name} with {os}."),
    };

    let prefill = serde_json::json!({
        "name": name,
        "os": os,
        "size": size,
        "network": "default",
        "cores": cores,
        "memory_gib": memory_gib,
    });

    Some(intent(
        "create-vm",
        "Create VM (NL)",
        &review,
        "create_vm",
        Some(name),
        None,
        Some(prefill),
    ))
}

fn extract_number_before(hay: &str, units: &[&str]) -> Option<i32> {
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
                if n > 0 && n <= 128 {
                    return Some(n);
                }
            }
        }
    }
    None
}

fn extract_memory_gib(hay: &str) -> Option<i32> {
    for token in hay.split_whitespace() {
        let digits: String = token.chars().take_while(|c| c.is_ascii_digit()).collect();
        if let Ok(n) = digits.parse::<i32>() {
            let rest = token[digits.len()..].to_lowercase();
            if rest.starts_with("gb") || rest.starts_with("gib") || rest.starts_with("gi") {
                return Some(n.clamp(1, 1024));
            }
        }
    }
    None
}

fn extract_quoted_name(query: &str) -> Option<String> {
    for (open, close) in [('\"', '\"'), ('\'', '\'')] {
        if let Some(start) = query.find(open) {
            let rest = &query[start + 1..];
            if let Some(end) = rest.find(close) {
                let name = rest[..end].trim();
                if !name.is_empty() {
                    return Some(name.to_string());
                }
            }
        }
    }
    None
}

fn extract_nl_vm_name(query: &str) -> Option<String> {
    let ql = query.to_lowercase();
    if let Some(name) = extract_quoted_name(query) {
        return Some(name);
    }
    if let Some(rest) = extract_after(&ql, "vm ") {
        let token = rest
            .split_whitespace()
            .next()?
            .trim_matches(|c: char| !c.is_alphanumeric() && c != '-' && c != '_');
        if !token.is_empty() && token.len() <= 64 {
            return Some(token.to_string());
        }
    }
    query
        .split_whitespace()
        .find(|w| w.contains('-') && w.len() > 2)
        .map(|s| {
            s.trim_matches(|c: char| !c.is_alphanumeric() && c != '-' && c != '_')
                .to_string()
        })
}
