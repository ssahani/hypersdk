// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Zeus Firewall — unified machine firewall abstraction.

pub mod adapters;
pub mod apply;
pub mod detect;
pub mod diff;
pub mod inventory;
pub mod profiles;
pub mod scan;
pub mod score;
pub mod types;

pub use apply::{apply_plan, compile_profile_plan};
pub use detect::detect_backend;
pub use diff::compute_diff;
pub use inventory::gather_firewall_inventory;
pub use profiles::{builtin_profiles, profile_by_name};
pub use score::compute_firewall_score;
pub use types::*;
