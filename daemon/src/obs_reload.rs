// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! Bump counter so background observability workers reload config from disk.

use std::sync::atomic::{AtomicU64, Ordering};

static OBS_RELOAD_GENERATION: AtomicU64 = AtomicU64::new(0);

pub fn bump_observability_reload() {
    OBS_RELOAD_GENERATION.fetch_add(1, Ordering::SeqCst);
    tracing::info!("observability workers will reload config on next tick");
}

pub fn observability_reload_generation() -> u64 {
    OBS_RELOAD_GENERATION.load(Ordering::SeqCst)
}
