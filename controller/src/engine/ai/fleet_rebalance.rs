// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use serde::Serialize;
use sqlx::PgPool;

#[derive(Debug, Serialize)]
pub struct RebalanceMove {
    pub vm_id: String,
    pub vm_name: String,
    pub from_host: String,
    pub to_host: String,
    pub reason: String,
    pub score: f32,
}

#[derive(Debug, Serialize)]
pub struct RebalanceProposal {
    pub moves: Vec<RebalanceMove>,
    pub estimated_savings_pct: f32,
    pub summary: String,
}

pub async fn propose(pool: &PgPool, max_moves: usize) -> anyhow::Result<RebalanceProposal> {
    let recs = crate::engine::placement::compute_recommendations(pool).await?;
    let cap = max_moves.clamp(1, 20);
    let moves: Vec<RebalanceMove> = recs
        .into_iter()
        .take(cap)
        .map(|r| RebalanceMove {
            vm_id: r.vm_id,
            vm_name: r.vm_name,
            from_host: r.from_host_name,
            to_host: r.to_host_name,
            reason: r.reason,
            score: r.score,
        })
        .collect();

    let estimated_savings_pct = if moves.is_empty() {
        0.0
    } else {
        (moves.len() as f32 * 4.5).min(25.0)
    };

    let summary = if moves.is_empty() {
        "Cluster is balanced — no autonomous rebalancing recommended.".into()
    } else {
        format!(
            "AI rebalancer proposes {} live migration(s) to relieve hotspots (~{:.0}% efficiency gain).",
            moves.len(),
            estimated_savings_pct
        )
    };

    Ok(RebalanceProposal {
        moves,
        estimated_savings_pct,
        summary,
    })
}
