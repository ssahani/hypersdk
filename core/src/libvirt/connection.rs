//! Libvirt connections: single configured URI or dual `qemu:///system` + `qemu:///session`.

use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use virt::connect::Connect;

use crate::config::LibvirtConfig;
use crate::libvirt::{domain, metrics};
use crate::state::{VmInfo, VmMetrics};
use crate::LibvirtError;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LibvirtTarget {
    /// Non-dual mode: `[libvirt] uri`.
    Primary,
    System,
    Session,
}

#[derive(Clone)]
struct UriSlot {
    uri: String,
    conn: Arc<Mutex<Connect>>,
}

#[derive(Clone)]
pub struct LibvirtManager {
    dual: bool,
    primary: Option<UriSlot>,
    primary_uri: String,
    system: Option<UriSlot>,
    session: Option<UriSlot>,
}

impl LibvirtManager {
    pub fn new(cfg: &LibvirtConfig) -> Result<Self, LibvirtError> {
        if cfg.dual_connection {
            let mut system = None;
            let mut session = None;
            match Connect::open(Some("qemu:///system")) {
                Ok(c) => {
                    system = Some(UriSlot {
                        uri: "qemu:///system".into(),
                        conn: Arc::new(Mutex::new(c)),
                    });
                }
                Err(e) => tracing::warn!("dual libvirt: qemu:///system unavailable: {e}"),
            }
            match Connect::open(Some("qemu:///session")) {
                Ok(c) => {
                    session = Some(UriSlot {
                        uri: "qemu:///session".into(),
                        conn: Arc::new(Mutex::new(c)),
                    });
                }
                Err(e) => tracing::warn!("dual libvirt: qemu:///session unavailable: {e}"),
            }
            if system.is_none() && session.is_none() {
                return Err(LibvirtError::Connection(
                    "dual_connection enabled but neither qemu:///system nor qemu:///session could be opened"
                        .into(),
                ));
            }
            tracing::info!(
                "Libvirt dual mode: system={}, session={}",
                system.is_some(),
                session.is_some()
            );
            return Ok(Self {
                dual: true,
                primary: None,
                primary_uri: String::new(),
                system,
                session,
            });
        }

        let uri = cfg.uri.clone();
        let conn = Connect::open(Some(&uri))
            .map_err(|e| LibvirtError::Connection(format!("Failed to connect to libvirt: {e}")))?;
        Ok(Self {
            dual: false,
            primary: Some(UriSlot {
                uri: uri.clone(),
                conn: Arc::new(Mutex::new(conn)),
            }),
            primary_uri: uri,
            system: None,
            session: None,
        })
    }

    #[inline]
    pub fn dual_enabled(&self) -> bool {
        self.dual
    }

    #[inline]
    pub fn primary_uri_display(&self) -> &str {
        if self.dual {
            "(dual: qemu:///system + qemu:///session)"
        } else {
            &self.primary_uri
        }
    }

    /// URI string for subprocess tools (`virt-xml`, `virt-install`).
    pub fn virt_uri_for_target(&self, target: LibvirtTarget) -> String {
        match (self.dual, target) {
            (false, _) => self.primary_uri.clone(),
            (true, LibvirtTarget::Session) => "qemu:///session".into(),
            (true, _) => "qemu:///system".into(),
        }
    }

    /// Resolve optional `?connection=system|session` (Cockpit-style). Single-URI mode ignores it.
    pub fn resolve_query(&self, connection: Option<&str>) -> LibvirtTarget {
        if !self.dual {
            return LibvirtTarget::Primary;
        }
        match connection.unwrap_or("system") {
            "session" => LibvirtTarget::Session,
            _ => LibvirtTarget::System,
        }
    }

    pub fn default_target(&self) -> LibvirtTarget {
        if self.dual {
            LibvirtTarget::System
        } else {
            LibvirtTarget::Primary
        }
    }

    fn slot_for(&self, target: LibvirtTarget) -> Result<&UriSlot, LibvirtError> {
        match (self.dual, target) {
            (false, LibvirtTarget::Primary) | (false, LibvirtTarget::System) => {
                self.primary.as_ref()
            }
            (false, LibvirtTarget::Session) => None,
            (true, LibvirtTarget::Primary) | (true, LibvirtTarget::System) => self.system.as_ref(),
            (true, LibvirtTarget::Session) => self.session.as_ref(),
        }
        .ok_or_else(|| {
            LibvirtError::Connection(format!(
                "libvirt connection not available for target {target:?}"
            ))
        })
    }

    fn open_uri(uri: &str) -> Result<Connect, LibvirtError> {
        Connect::open(Some(uri)).map_err(|e| LibvirtError::Connection(e.to_string()))
    }

    fn with_slot<F, R>(slot: &UriSlot, f: F) -> Result<R, LibvirtError>
    where
        F: FnOnce(&Connect) -> Result<R, LibvirtError>,
    {
        let mut conn = slot.conn.lock().unwrap_or_else(|e| {
            tracing::warn!("Recovering from poisoned libvirt mutex");
            e.into_inner()
        });

        if conn.is_alive().unwrap_or(false) {
            return f(&conn);
        }

        tracing::warn!("Libvirt connection lost, reconnecting to {}", slot.uri);
        let _ = conn.close();
        match Self::open_uri(&slot.uri) {
            Ok(new_conn) => {
                *conn = new_conn;
                tracing::info!("Reconnected to libvirt ({})", slot.uri);
                f(&conn)
            }
            Err(e) => Err(LibvirtError::Connection(format!(
                "Failed to reconnect to {}: {e}",
                slot.uri
            ))),
        }
    }

    pub fn with_conn_target<F, R>(&self, target: LibvirtTarget, f: F) -> Result<R, LibvirtError>
    where
        F: FnOnce(&Connect) -> Result<R, LibvirtError>,
    {
        let slot = self.slot_for(target)?;
        Self::with_slot(slot, f)
    }

    /// Same as single-hypervisor default: configured URI, or **system** when dual.
    pub fn with_conn<F, R>(&self, f: F) -> Result<R, LibvirtError>
    where
        F: FnOnce(&Connect) -> Result<R, LibvirtError>,
    {
        self.with_conn_target(self.default_target(), f)
    }

    pub fn list_all_vms(&self) -> Result<Vec<VmInfo>, LibvirtError> {
        if !self.dual {
            return self.with_conn_target(LibvirtTarget::Primary, domain::list_vms);
        }
        let mut out = Vec::new();
        if let Some(ref slot) = self.system {
            let mut vms = Self::with_slot(slot, domain::list_vms)?;
            for vm in &mut vms {
                vm.libvirt_connection = Some("system".into());
            }
            out.extend(vms);
        }
        if let Some(ref slot) = self.session {
            let mut vms = Self::with_slot(slot, domain::list_vms)?;
            for vm in &mut vms {
                vm.libvirt_connection = Some("session".into());
            }
            out.extend(vms);
        }
        Ok(out)
    }

    pub fn merge_all_metrics(&self) -> Result<Vec<VmMetrics>, LibvirtError> {
        if !self.dual {
            return self.with_conn_target(LibvirtTarget::Primary, metrics::get_all_vm_metrics);
        }
        let mut out = Vec::new();
        if let Some(ref slot) = self.system {
            let mut m = Self::with_slot(slot, metrics::get_all_vm_metrics)?;
            for x in &mut m {
                x.libvirt_connection = Some("system".into());
            }
            out.extend(m);
        }
        if let Some(ref slot) = self.session {
            let mut m = Self::with_slot(slot, metrics::get_all_vm_metrics)?;
            for x in &mut m {
                x.libvirt_connection = Some("session".into());
            }
            out.extend(m);
        }
        Ok(out)
    }

    /// UI / discovery: dual mode and which sockets opened at daemon start.
    #[must_use]
    pub fn api_connection_summary(&self) -> serde_json::Value {
        serde_json::json!({
            "dual_connection": self.dual,
            "qemu_system_connected": self.system.is_some(),
            "qemu_session_connected": self.session.is_some(),
            "configured_uri": self.primary_uri_display(),
        })
    }
}
