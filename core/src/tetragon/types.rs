// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SecurityBundleApplyResult {
    pub ok: bool,
    pub policy_dir: String,
    pub policies_written: usize,
    pub install_script_written: bool,
    pub tetragon_binary_found: bool,
    pub operations: Vec<String>,
    pub message: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SecurityFabricStatus {
    pub policy_dir: String,
    pub policy_files: Vec<String>,
    pub install_script_present: bool,
    pub tetragon_binary_found: bool,
    pub export_url: Option<String>,
}
