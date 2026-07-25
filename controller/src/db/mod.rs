// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::str::FromStr;
use std::time::Duration;
use uuid::Uuid;

pub async fn connect(database_url: &str) -> anyhow::Result<SqlitePool> {
    let options = SqliteConnectOptions::from_str(database_url)?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .pragma("foreign_keys", "ON")
        .busy_timeout(Duration::from_secs(5));

    let pool = SqlitePoolOptions::new()
        .max_connections(4)
        .connect_with(options)
        .await?;

    Ok(pool)
}

pub async fn migrate(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::migrate!().run(pool).await?;
    Ok(())
}

pub async fn ensure_bootstrap(
    pool: &SqlitePool,
    admin_user: &str,
    admin_password: &str,
) -> anyhow::Result<()> {
    // Reap tasks left 'running' by a worker that died or was restarted mid-task.
    // Nothing else transitions running->failed, so without this they stay
    // 'running' forever (never retried, since a re-publish only matches 'pending')
    // and block reconcile from healing the affected VM.
    //
    // When a STABLE controller id is configured (MACHINA_CONTROLLER_ID), reap only
    // OUR own orphans (+ legacy NULL-owner rows) so we never fail a peer
    // controller's in-flight task in a multi-controller deployment.
    //
    // Without a configured id, this process's own id (`config.controller_id`) is a
    // fresh random value each boot (see config.rs), so claimed_by-scoping would
    // never match our OWN prior-run tasks either — we can't tell "my own orphan"
    // from "a peer's live task" by identity alone in that case. Nothing enforces
    // that MACHINA_CONTROLLER_ID is set in every multi-controller deployment, so
    // do NOT assume "unset" means "single controller, safe to fail every running
    // row": if a peer happens to also be unset, that would fail its in-flight
    // work every time any one of them restarts. Fall back to a staleness check
    // instead: only reap rows that have had no progress in a long time (or were
    // never claimed at all). A live task's `updated_at` is refreshed at claim
    // time and again by any progress update, so a peer's genuinely in-flight task
    // stays well inside the window; a truly orphaned task (worker died, no peer
    // owns it) eventually crosses it and gets recovered on a later restart. The
    // threshold is intentionally generous (some operations — backup/clone of a
    // large disk — may run a long time between progress updates) to bias toward
    // never killing live work over reaping instantly.
    let reaped = if let Some(id) = std::env::var("MACHINA_CONTROLLER_ID").ok().filter(|s| !s.is_empty()) {
        sqlx::query(
            "UPDATE tasks SET status = 'failed', message = 'controller restarted while task was running', \
             updated_at = datetime('now') WHERE status = 'running' AND (claimed_by = ? OR claimed_by IS NULL)",
        )
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected()
    } else {
        sqlx::query(
            "UPDATE tasks SET status = 'failed', message = 'controller restarted while task was running', \
             updated_at = datetime('now') \
             WHERE status = 'running' \
               AND (claimed_by IS NULL OR updated_at < datetime('now', '-60 minutes'))",
        )
        .execute(pool)
        .await?
        .rows_affected()
    };
    if reaped > 0 {
        tracing::warn!("reaped {reaped} task(s) left in 'running' state after restart");
    }

    // These three "check count == 0, then insert" blocks are check-then-act:
    // in a multi-controller deployment sharing one DB (see the reaper's
    // MACHINA_CONTROLLER_ID handling above), two controllers can both boot
    // against an empty DB and both observe count == 0 before either commits
    // its insert. clusters.name, users.username, and hosts(cluster_id,
    // hostname) are all UNIQUE, so a plain INSERT would make the loser crash
    // the whole ensure_bootstrap (and thus startup) on a constraint
    // violation instead of just no-op'ing. Use INSERT OR IGNORE so the loser
    // of the race silently defers to whichever controller won it, instead of
    // failing to start.
    let cluster_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM clusters")
        .fetch_one(pool)
        .await?;
    if cluster_count == 0 {
        let cluster_id = Uuid::new_v4();
        sqlx::query("INSERT OR IGNORE INTO clusters (id, name) VALUES (?, ?)")
            .bind(cluster_id)
            .bind("default")
            .execute(pool)
            .await?;
    }

    let user_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;
    if user_count == 0 {
        let hash = bcrypt::hash(admin_password, bcrypt::DEFAULT_COST)?;
        sqlx::query(
            "INSERT OR IGNORE INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)",
        )
        .bind(Uuid::new_v4())
        .bind(admin_user)
        .bind(hash)
        .bind("admin")
        .execute(pool)
        .await?;
    }

    let host_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM hosts")
        .fetch_one(pool)
        .await?;
    if host_count == 0 {
        let cluster_id: Uuid =
            sqlx::query_scalar::<_, Uuid>("SELECT id FROM clusters LIMIT 1")
                .fetch_one(pool)
                .await?;
        sqlx::query(
            "INSERT OR IGNORE INTO hosts (id, cluster_id, hostname, address, state, agent_grpc_addr)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(Uuid::new_v4())
        .bind(cluster_id)
        .bind("localhost")
        .bind("127.0.0.1")
        .bind("online")
        .bind(
            std::env::var("MACHINA_AGENT_ADDR")
                .unwrap_or_else(|_| "127.0.0.1:50051".into()),
        )
        .execute(pool)
        .await?;
    }

    crate::engine::template_catalog::ensure_default_templates(pool).await?;

    Ok(())
}

pub async fn ensure_machina_db_ownership() -> anyhow::Result<()> {
    Ok(())
}
