// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

//! Shared helpers for engine unit tests: an `AppState` backed by a fresh
//! in-memory SQLite database and an in-memory task bus. Keep the returned
//! receiver alive for the duration of the test — dropping it makes every
//! `enqueue_task` publish fail (useful for exercising enqueue-failure paths).

use std::sync::Arc;

use tokio::sync::mpsc::UnboundedReceiver;

use crate::config::ControllerConfig;
use crate::state::AppState;
use crate::tasks::{bus::InMemoryTaskBus, TaskBus, TaskMessage};

pub(crate) async fn test_state() -> (AppState, UnboundedReceiver<TaskMessage>) {
    let pool = sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap();
    crate::db::migrate(&pool).await.expect("migrate failed");
    let config = Arc::new(ControllerConfig::default());
    let (task_bus, rx) = InMemoryTaskBus::new();
    let task_bus = task_bus as Arc<dyn TaskBus>;
    let leader = crate::leader::spawn(pool.clone(), "test-engine".into());
    (AppState::new(pool, config, task_bus, leader), rx)
}
