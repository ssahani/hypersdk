use std::sync::{Arc, Mutex};

use virt::connect::Connect;

use crate::error::AppError;

#[derive(Clone)]
pub struct LibvirtManager {
    conn: Arc<Mutex<Connect>>,
}

impl LibvirtManager {
    pub fn new(uri: &str) -> Result<Self, AppError> {
        let conn = Connect::open(Some(uri))
            .map_err(|e| AppError::Libvirt(format!("Failed to connect to libvirt: {e}")))?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn with_conn<F, R>(&self, f: F) -> Result<R, AppError>
    where
        F: FnOnce(&Connect) -> Result<R, AppError>,
    {
        let conn = self
            .conn
            .lock()
            .map_err(|e| AppError::Internal(format!("Mutex poisoned: {e}")))?;
        f(&conn)
    }
}
