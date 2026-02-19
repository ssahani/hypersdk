use std::sync::{Arc, Mutex};

use virt::connect::Connect;

use crate::LibvirtError;

#[derive(Clone)]
pub struct LibvirtManager {
    conn: Arc<Mutex<Connect>>,
}

impl LibvirtManager {
    pub fn new(uri: &str) -> Result<Self, LibvirtError> {
        let conn = Connect::open(Some(uri))
            .map_err(|e| LibvirtError::Connection(format!("Failed to connect to libvirt: {e}")))?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn with_conn<F, R>(&self, f: F) -> Result<R, LibvirtError>
    where
        F: FnOnce(&Connect) -> Result<R, LibvirtError>,
    {
        let conn = self
            .conn
            .lock()
            .map_err(|e| LibvirtError::Internal(format!("Mutex poisoned: {e}")))?;
        f(&conn)
    }
}
