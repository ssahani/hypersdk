// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Clone)]
pub struct WsTokenStore {
    inner: Arc<RwLock<HashMap<String, WsTokenEntry>>>,
}

#[derive(Clone)]
struct WsTokenEntry {
    vm_id: Uuid,
    read_only: bool,
    expires: Instant,
}

/// Resolved ws-token grant: which VM, and whether the holder may only view
/// (input frames must be dropped and interactive serial refused).
#[derive(Clone, Copy)]
pub struct WsGrant {
    pub vm_id: Uuid,
    pub read_only: bool,
}

impl WsTokenStore {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn issue(&self, vm_id: Uuid, read_only: bool) -> String {
        let token = Uuid::new_v4().to_string();
        let mut map = self.inner.write().await;
        map.retain(|_, v| v.expires > Instant::now());
        map.insert(
            token.clone(),
            WsTokenEntry {
                vm_id,
                read_only,
                expires: Instant::now() + Duration::from_secs(120),
            },
        );
        token
    }

    pub async fn consume(&self, token: &str) -> Option<WsGrant> {
        let mut map = self.inner.write().await;
        let entry = map.remove(token)?;
        if entry.expires < Instant::now() {
            return None;
        }
        Some(WsGrant {
            vm_id: entry.vm_id,
            read_only: entry.read_only,
        })
    }

    /// Validate a token without removing it (supports React Strict Mode and reconnect retries).
    pub async fn validate(&self, token: &str) -> Option<WsGrant> {
        let map = self.inner.read().await;
        let entry = map.get(token)?;
        if entry.expires < Instant::now() {
            return None;
        }
        Some(WsGrant {
            vm_id: entry.vm_id,
            read_only: entry.read_only,
        })
    }
}
