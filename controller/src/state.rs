// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use std::sync::Arc;

use sqlx::PgPool;
use tokio::sync::broadcast;

use crate::config::ControllerConfig;
use crate::leader::LeaderHandle;
use crate::tasks::TaskBus;
use crate::ws_tokens::WsTokenStore;
use crate::consolehub::ConsoleSessionStore;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Arc<ControllerConfig>,
    pub task_bus: Arc<dyn TaskBus>,
    pub leader: LeaderHandle,
    pub events: broadcast::Sender<String>,
    pub ws_tokens: WsTokenStore,
    pub console_sessions: ConsoleSessionStore,
}

impl AppState {
    pub fn new(
        pool: PgPool,
        config: Arc<ControllerConfig>,
        task_bus: Arc<dyn TaskBus>,
        leader: LeaderHandle,
    ) -> Self {
        let (events, _) = broadcast::channel(256);
        Self {
            pool,
            config,
            task_bus,
            leader,
            events,
            ws_tokens: WsTokenStore::new(),
            console_sessions: ConsoleSessionStore::new(),
        }
    }

    pub fn emit_event(&self, kind: &str, message: impl Into<String>) {
        let msg = message.into();
        let payload = serde_json::json!({
            "kind": kind,
            "message": &msg,
            "ts": chrono::Utc::now().to_rfc3339(),
        });
        let _ = self.events.send(payload.to_string());

        let pool = self.pool.clone();
        let kind = kind.to_string();
        let msg_db = msg.clone();
        tokio::spawn(async move {
            let _ = sqlx::query(
                "INSERT INTO events (id, kind, message) VALUES ($1, $2, $3)",
            )
            .bind(uuid::Uuid::new_v4())
            .bind(&kind)
            .bind(&msg_db)
            .execute(&pool)
            .await;
            crate::engine::webhooks::dispatch_webhooks(
                &pool,
                &kind,
                serde_json::json!({ "message": msg }),
            )
            .await;
        });
    }
}
