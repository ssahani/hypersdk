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
