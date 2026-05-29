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
        ));
    }
    if ql.contains("high cpu") || ql.contains("cpu") && ql.contains("consum") {
        intents.push(intent(
            "high-cpu",
            "High CPU VMs",
            "Open Activity Monitor sorted by CPU.",
            "navigate",
            None,
            Some("/platform/activity".into()),
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
        ));
    }

    let suggested_action = intents.first().cloned();
    SpotlightResult {
        intents,
        search_hits,
        suggested_action,
    }
}

fn intent(
    id: &str,
    label: &str,
    review: &str,
    action: &str,
    vm_name: Option<String>,
    navigate: Option<String>,
) -> SpotlightIntent {
    SpotlightIntent {
        id: id.into(),
        label: label.into(),
        review: review.into(),
        action: action.into(),
        vm_name,
        navigate,
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
