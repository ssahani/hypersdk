// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use super::types::{FirewallProfile, FirewallProfileRule, StealthLevel};

pub fn builtin_profiles() -> Vec<FirewallProfile> {
    vec![
        profile(
            "Public",
            "Public",
            "Untrusted networks — minimal inbound",
            "deny",
            "allow",
            StealthLevel::Standard,
            vec![allow_tcp("22", vec!["admin-network"]), allow_tcp("443", vec!["any"])],
        ),
        profile(
            "Private",
            "Private",
            "Trusted internal network",
            "allow",
            "allow",
            StealthLevel::Off,
            vec![],
        ),
        profile(
            "ProductionServer",
            "Production Server",
            "Hardened production defaults",
            "deny",
            "allow",
            StealthLevel::Standard,
            vec![
                allow_tcp("22", vec!["admin-network"]),
                allow_tcp("9100", vec!["monitoring"]),
            ],
        ),
        profile(
            "DatabaseServer",
            "Database Server",
            "Database workloads — no public exposure",
            "deny",
            "allow",
            StealthLevel::Strict,
            vec![
                allow_tcp("22", vec!["bastion"]),
                allow_tcp("5432", vec!["app-servers"]),
                allow_tcp("3306", vec!["app-servers"]),
            ],
        ),
        profile(
            "WebServer",
            "Web Server",
            "HTTP/HTTPS with restricted SSH",
            "deny",
            "allow",
            StealthLevel::Standard,
            vec![
                allow_tcp("80", vec!["any"]),
                allow_tcp("443", vec!["any"]),
                allow_tcp("22", vec!["admin-network"]),
            ],
        ),
        profile(
            "KubernetesNode",
            "Kubernetes Node",
            "Worker node CNI and kubelet traffic",
            "deny",
            "allow",
            StealthLevel::Standard,
            vec![
                allow_tcp("10250", vec!["control-plane"]),
                allow_tcp("30000-32767", vec!["internal"]),
            ],
        ),
        profile(
            "StorageNode",
            "Storage Node",
            "Ceph/NFS/storage replication",
            "deny",
            "allow",
            StealthLevel::Standard,
            vec![allow_tcp("6789", vec!["storage-network"]), allow_tcp("2049", vec!["internal"])],
        ),
        profile(
            "ManagementNode",
            "Management Node",
            "Management plane access only",
            "deny",
            "allow",
            StealthLevel::Strict,
            vec![allow_tcp("22", vec!["admin-network"]), allow_tcp("443", vec!["admin-network"])],
        ),
        profile(
            "DevelopmentVm",
            "Development VM",
            "Relaxed dev access",
            "allow",
            "allow",
            StealthLevel::Off,
            vec![],
        ),
        profile(
            "LockedDown",
            "Locked Down",
            "Deny all except essentials",
            "deny",
            "deny",
            StealthLevel::Strict,
            vec![allow_tcp("22", vec!["admin-network"])],
        ),
        profile(
            "EmergencyIsolation",
            "Emergency Isolation",
            "Incident response — management only",
            "deny",
            "deny",
            StealthLevel::Emergency,
            vec![allow_tcp("22", vec!["zeus-management"]), allow_tcp("443", vec!["backup-network"])],
        ),
    ]
}

pub fn profile_by_name(name: &str) -> Option<FirewallProfile> {
    builtin_profiles()
        .into_iter()
        .find(|p| p.name.eq_ignore_ascii_case(name))
}

fn profile(
    name: &str,
    display_name: &str,
    description: &str,
    default_inbound: &str,
    default_outbound: &str,
    stealth_level: StealthLevel,
    rules: Vec<FirewallProfileRule>,
) -> FirewallProfile {
    FirewallProfile {
        name: name.into(),
        display_name: display_name.into(),
        description: description.into(),
        default_inbound: default_inbound.into(),
        default_outbound: default_outbound.into(),
        stealth_level,
        rules,
    }
}

fn allow_tcp(ports: &str, sources: Vec<&str>) -> FirewallProfileRule {
    FirewallProfileRule {
        name: format!("allow-{ports}"),
        direction: "inbound".into(),
        protocol: "tcp".into(),
        ports: ports.into(),
        sources: sources.into_iter().map(String::from).collect(),
        action: "allow".into(),
    }
}
