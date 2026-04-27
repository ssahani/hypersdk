use std::sync::{Arc, Mutex};

use virt::connect::Connect;

use crate::LibvirtError;

#[derive(Clone)]
pub struct LibvirtManager {
    conn: Arc<Mutex<Connect>>,
    uri: String,
}

impl LibvirtManager {
    pub fn new(uri: &str) -> Result<Self, LibvirtError> {
        let conn = Connect::open(Some(uri))
            .map_err(|e| LibvirtError::Connection(format!("Failed to connect to libvirt: {e}")))?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            uri: uri.to_string(),
        })
    }

    pub fn with_conn<F, R>(&self, f: F) -> Result<R, LibvirtError>
    where
        F: FnOnce(&Connect) -> Result<R, LibvirtError>,
    {
        let mut conn = self.conn.lock().unwrap_or_else(|e| {
            tracing::warn!("Recovering from poisoned mutex");
            e.into_inner()
        });

        // Check if connection is alive, reconnect if needed
        if conn.is_alive().unwrap_or(false) {
            return f(&conn);
        }

        // Try to reconnect — close old connection first
        tracing::warn!("Libvirt connection lost, reconnecting to {}", self.uri);
        let _ = conn.close();
        match Connect::open(Some(&self.uri)) {
            Ok(new_conn) => {
                *conn = new_conn;
                tracing::info!("Reconnected to libvirt");
                f(&conn)
            }
            Err(e) => Err(LibvirtError::Connection(format!(
                "Failed to reconnect to libvirt: {e}"
            ))),
        }
    }
}
