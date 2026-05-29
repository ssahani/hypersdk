// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct MigrationAdvisorReport {
    pub vm_name: String,
    pub provider: String,
    pub readiness_percent: u8,
    pub safe: Vec<String>,
    pub risks: Vec<String>,
    pub recommended_target: serde_json::Value,
    pub remediation: Vec<String>,
}

pub fn advise_vmware_vm(vm_name: &str, os_hint: &str, has_rdm: bool) -> MigrationAdvisorReport {
    let mut safe = vec![
        "Standard libvirt/KVM target supported".into(),
        "HyperSDK conversion path available".into(),
    ];
    let mut risks = Vec::new();
    let mut remediation = Vec::new();
    let mut score: i32 = 85;

    if has_rdm {
        risks.push("RDM disk detected — may require storage conversion".into());
        remediation.push("Convert RDM to VMDK or map to shared storage pool".into());
        score -= 25;
    }
    if os_hint.to_lowercase().contains("windows") {
        safe.push("Windows — use virtio-win drivers and UEFI template".into());
    } else {
        safe.push("Linux — virtio-scsi recommended".into());
    }
    if vm_name.is_empty() {
        score = 50;
        risks.push("VM name unknown — run scan first".into());
    }

    risks.push("Verify static IP and VMware Tools removal post-migrate".into());
    remediation.push("Run preflight migrate check after import".into());

    MigrationAdvisorReport {
        vm_name: vm_name.into(),
        provider: "vmware".into(),
        readiness_percent: score.clamp(0, 100) as u8,
        safe,
        risks,
        recommended_target: serde_json::json!({
            "platform": "libvirt",
            "vcpu": 4,
            "memory_gib": 16,
            "disk_bus": "virtio-scsi",
            "network": "default"
        }),
        remediation,
    }
}
