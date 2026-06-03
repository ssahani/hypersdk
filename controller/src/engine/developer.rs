// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Developer ecosystem — schema export for Terraform + SDK (Phase 30).

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct DeveloperOverview {
    pub openapi_url: String,
    pub sdk_typescript: SdkPackageInfo,
    pub terraform: TerraformInfo,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SdkPackageInfo {
    pub path: String,
    pub version: String,
    pub install: String,
    pub resources: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TerraformInfo {
    pub provider_source: String,
    pub examples_path: String,
    pub resources: Vec<TerraformResourceSchema>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TerraformResourceSchema {
    pub name: String,
    pub kind: String,
    pub api_path: String,
    pub attributes: Vec<String>,
}

pub fn overview() -> DeveloperOverview {
    DeveloperOverview {
        openapi_url: "/api/v1/openapi.json".into(),
        sdk_typescript: SdkPackageInfo {
            path: "sdk/typescript".into(),
            version: "0.1.0".into(),
            install: "npm install ../sdk/typescript".into(),
            resources: vec![
                "listHosts".into(),
                "listVms".into(),
                "createVm".into(),
                "getOperationsOverview".into(),
                "getObservabilityOverview".into(),
            ],
        },
        terraform: TerraformInfo {
            provider_source: "zyvor/machina".into(),
            examples_path: "terraform/machina/examples".into(),
            resources: terraform_schemas(),
        },
        summary: "TypeScript SDK + Terraform schemas aligned to /api/v1 (GA v1)".into(),
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct VmExportBundle {
    pub vm_id: String,
    pub vm_name: String,
    pub terraform: String,
    pub ansible_role: String,
    pub cloud_init: String,
    pub domain_xml: String,
}

pub async fn export_vm_bundle(
    pool: &sqlx::PgPool,
    agent_addr: &str,
    vm_id: uuid::Uuid,
) -> anyhow::Result<VmExportBundle> {
    let row: (String, serde_json::Value) = sqlx::query_as(
        "SELECT name, spec_json FROM vms WHERE id = $1",
    )
    .bind(vm_id)
    .fetch_one(pool)
    .await?;
    let (name, spec) = row;
    let vcpus = spec["spec"]["resources"]["vcpu"].as_u64().unwrap_or(2);
    let memory_mib = spec["spec"]["resources"]["memory_mib"].as_u64().unwrap_or(4096);
    let project = spec["metadata"]["project"].as_str().unwrap_or("default");

    let mut client = crate::agent_client::connect(agent_addr).await?;
    let domain_xml = crate::agent_client::get_domain_xml(&mut client, &name).await?;

    let cloud_init = spec["spec"]["cloud_init"]
        .as_object()
        .map(|c| {
            format!(
                "#cloud-config\nusers:\n  - name: {}\n    ssh_authorized_keys:\n      - {}\n",
                c.get("user").and_then(|v| v.as_str()).unwrap_or("ubuntu"),
                c.get("ssh_pubkey").and_then(|v| v.as_str()).unwrap_or("")
            )
        })
        .unwrap_or_else(|| "#cloud-config\n# (no cloud-init in spec)\n".into());

    let terraform = format!(
        r#"resource "machina_vm" "{name}" {{
  name         = "{name}"
  vcpus        = {vcpus}
  memory_mib   = {memory_mib}
  desired_state = "running"
  project      = "{project}"
}}
"#
    );

    let ansible_role = format!(
        r#"- name: Configure {name}
  hosts: localhost
  tasks:
    - name: Ensure VM is registered in Machina
      debug:
        msg: "Deploy via machina-controller POST /api/v1/vms"
"#
    );

    Ok(VmExportBundle {
        vm_id: vm_id.to_string(),
        vm_name: name,
        terraform,
        ansible_role,
        cloud_init,
        domain_xml,
    })
}

pub fn terraform_schemas() -> Vec<TerraformResourceSchema> {
    vec![
        TerraformResourceSchema {
            name: "machina_vm".into(),
            kind: "resource".into(),
            api_path: "POST /api/v1/vms".into(),
            attributes: vec![
                "name".into(),
                "vcpus".into(),
                "memory_mib".into(),
                "desired_state".into(),
                "project".into(),
            ],
        },
        TerraformResourceSchema {
            name: "machina_host".into(),
            kind: "data".into(),
            api_path: "GET /api/v1/hosts".into(),
            attributes: vec!["id".into(), "hostname".into(), "state".into()],
        },
        TerraformResourceSchema {
            name: "machina_storage_pool".into(),
            kind: "resource".into(),
            api_path: "POST /api/v1/storage/pools".into(),
            attributes: vec!["name".into(), "path".into(), "capacity_gib".into()],
        },
        TerraformResourceSchema {
            name: "machina_network".into(),
            kind: "resource".into(),
            api_path: "POST /api/v1/networks".into(),
            attributes: vec!["name".into(), "vlan_id".into(), "bridge".into()],
        },
    ]
}
