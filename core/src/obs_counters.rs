//! Process-wide observability counters (incremented from core; read by the daemon for Prometheus).

use std::sync::atomic::{AtomicU64, Ordering};

/// Libvirt reconnect attempts after a dead connection.
pub static LIBVIRT_RECONNECTS: AtomicU64 = AtomicU64::new(0);
/// Successful API token validations (`Bearer mach_…`).
pub static API_TOKEN_AUTH_OK: AtomicU64 = AtomicU64::new(0);
/// Rejected API token attempts.
pub static API_TOKEN_AUTH_FAIL: AtomicU64 = AtomicU64::new(0);

pub fn inc_libvirt_reconnect() {
    LIBVIRT_RECONNECTS.fetch_add(1, Ordering::Relaxed);
}

pub fn inc_api_token_ok() {
    API_TOKEN_AUTH_OK.fetch_add(1, Ordering::Relaxed);
}

pub fn inc_api_token_fail() {
    API_TOKEN_AUTH_FAIL.fetch_add(1, Ordering::Relaxed);
}
