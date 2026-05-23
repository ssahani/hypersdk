//! Optional `?connection=system|session` for Cockpit-style dual libvirt hypervisors.

use serde::Deserialize;
use virt::connect::Connect;

use machina_core::{LibvirtError, LibvirtManager, LibvirtTarget};

use crate::error::AppError;

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ConnQuery {
    #[serde(default)]
    pub connection: Option<String>,
}

impl ConnQuery {
    pub fn target(&self, mgr: &LibvirtManager) -> LibvirtTarget {
        mgr.resolve_query(self.connection.as_deref())
    }
}

pub fn connection_label(dual: bool, target: LibvirtTarget) -> Option<String> {
    if !dual {
        return None;
    }
    Some(
        match target {
            LibvirtTarget::Session => "session",
            _ => "system",
        }
        .to_string(),
    )
}

/// Run a libvirt call on the hypervisor selected by [`ConnQuery`] (blocking pool).
pub async fn spawn_libvirt<R>(
    manager: LibvirtManager,
    conn_q: ConnQuery,
    op: impl FnOnce(&Connect) -> Result<R, LibvirtError> + Send + 'static,
) -> Result<R, AppError>
where
    R: Send + 'static,
{
    let mgr = manager;
    tokio::task::spawn_blocking(move || {
        let t = conn_q.target(&mgr);
        mgr.with_conn_target(t, op)
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    .map_err(AppError::from)
}
