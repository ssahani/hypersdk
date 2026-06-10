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
    expires: Instant,
}

impl WsTokenStore {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn issue(&self, vm_id: Uuid) -> String {
        let token = Uuid::new_v4().to_string();
        let mut map = self.inner.write().await;
        map.retain(|_, v| v.expires > Instant::now());
        map.insert(
            token.clone(),
            WsTokenEntry {
                vm_id,
                expires: Instant::now() + Duration::from_secs(120),
            },
        );
        token
    }

    pub async fn consume(&self, token: &str) -> Option<Uuid> {
        let mut map = self.inner.write().await;
        let entry = map.remove(token)?;
        if entry.expires < Instant::now() {
            return None;
        }
        Some(entry.vm_id)
    }

    /// Validate a token without removing it (supports React Strict Mode and reconnect retries).
    pub async fn validate(&self, token: &str) -> Option<Uuid> {
        let map = self.inner.read().await;
        let entry = map.get(token)?;
        if entry.expires < Instant::now() {
            return None;
        }
        Some(entry.vm_id)
    }
}
