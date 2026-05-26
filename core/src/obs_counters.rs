//! Process-wide observability counters (incremented from core; read by the daemon for Prometheus).

use std::sync::atomic::{AtomicU64, Ordering};

/// Libvirt reconnect attempts after a dead connection.
pub static LIBVIRT_RECONNECTS: AtomicU64 = AtomicU64::new(0);

pub fn inc_libvirt_reconnect() {
    LIBVIRT_RECONNECTS.fetch_add(1, Ordering::Relaxed);
}
