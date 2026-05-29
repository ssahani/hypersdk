// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use futures_util::StreamExt;
use tokio::sync::mpsc;

use super::TaskMessage;

pub fn spawn(nats_url: String, tx: mpsc::UnboundedSender<TaskMessage>) {
    tokio::spawn(async move {
        loop {
            match run(&nats_url, tx.clone()).await {
                Ok(()) => tracing::warn!("NATS task subscriber ended; reconnecting in 5s"),
                Err(e) => tracing::warn!("NATS task subscriber: {e:#}; reconnecting in 5s"),
            }
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        }
    });
}

async fn run(nats_url: &str, tx: mpsc::UnboundedSender<TaskMessage>) -> anyhow::Result<()> {
    let client = async_nats::connect(nats_url).await?;
    let mut sub = client.subscribe("machina.tasks").await?;
    tracing::info!("NATS task subscriber listening on machina.tasks");
    while let Some(msg) = sub.next().await {
        match serde_json::from_slice::<TaskMessage>(&msg.payload) {
            Ok(task) => {
                if tx.send(task).is_err() {
                    anyhow::bail!("local task channel closed");
                }
            }
            Err(e) => tracing::warn!("NATS task decode failed: {e}"),
        }
    }
    Ok(())
}
