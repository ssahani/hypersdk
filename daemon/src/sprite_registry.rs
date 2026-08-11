// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! In-memory registry + TTL reaper for disposable "sprite" microVMs.
//!
//! Mirrors `job_registry.rs`'s shape (`Arc<Mutex<HashMap<...>>>`, cleared on
//! daemon restart) rather than persisting to a database — sprites are
//! disposable by design, so losing track of them across a daemon restart is
//! an acceptable tradeoff, not a shortcut. See the sprites design doc for
//! why this isn't wired into the controller's `vms` table / reconciler at
//! all.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use chrono::{DateTime, Utc};
use machina_core::libvirt::domain::{delete_vm_with_options, UndefineOptions};
use machina_core::LibvirtManager;
use machina_spec::{SpriteHandle, SpriteState};

/// Sized for a lot of short-lived sandboxes churning through, unlike
/// `JobRegistry`'s `MAX_JOBS=250` (long-running build/export jobs are much
/// rarer). Oldest-first eviction isn't implemented here (unlike
/// `JobRegistry`'s `order` deque) — a sprite past this count almost
/// certainly means the reaper has fallen behind or stalled, which is worth
/// surfacing as registration failures rather than silently dropping
/// bookkeeping for a VM that's still running.
const MAX_SPRITES: usize = 2000;

/// How often the reaper scans for expired sprites. Sprites are meant to
/// live seconds-to-minutes (see `spec::sprite`'s `MAX_TTL_SECONDS`), so this
/// trades a little teardown-latency slop for simplicity over a per-sprite
/// `tokio::time::sleep_until` timer — revisit only if TTL precision turns
/// out to matter in practice.
const REAP_INTERVAL: Duration = Duration::from_secs(5);

struct SpriteEntry {
    handle: SpriteHandle,
    domain_name: String,
    expires_at: DateTime<Utc>,
}

#[derive(Clone, Default)]
pub struct SpriteRegistry {
    inner: Arc<Mutex<HashMap<String, SpriteEntry>>>,
}

impl SpriteRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Record a sprite whose domain is already running (boot happens
    /// synchronously in the route handler before this is called — there's
    /// no separate async "booting" phase to track).
    ///
    /// `sprite_id` must be the same id the caller used to derive
    /// `domain_name` via `sprite_domain_name()` — minting a fresh id here
    /// instead would desync the id handed back to API clients from the
    /// actual `sprite-<id>` libvirt domain name, making `virsh`/manual ops
    /// on a returned id impossible.
    pub fn register(
        &self,
        sprite_id: String,
        domain_name: String,
        ttl_seconds: u64,
        vsock_cid: Option<u32>,
    ) -> Result<SpriteHandle, &'static str> {
        let mut g = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        if g.len() >= MAX_SPRITES {
            return Err("sprite registry is full — the reaper may have fallen behind");
        }
        let now = Utc::now();
        let expires_at = now + chrono::Duration::seconds(ttl_seconds as i64);
        let handle = SpriteHandle {
            sprite_id: sprite_id.clone(),
            state: SpriteState::Running,
            created_at: now.to_rfc3339(),
            expires_at: expires_at.to_rfc3339(),
            vsock_cid,
        };
        g.insert(
            sprite_id,
            SpriteEntry {
                handle: handle.clone(),
                domain_name,
                expires_at,
            },
        );
        Ok(handle)
    }

    pub fn get(&self, id: &str) -> Option<SpriteHandle> {
        let g = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        g.get(id).map(|e| e.handle.clone())
    }

    pub fn list(&self) -> Vec<SpriteHandle> {
        let g = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        g.values().map(|e| e.handle.clone()).collect()
    }

    /// Remove the bookkeeping entry and return its domain name for the
    /// caller to actually tear down. Bookkeeping-only: does not touch
    /// libvirt itself, so it's safe to call from either the reaper or an
    /// explicit `DELETE /v1/sprites/{id}` handler without a libvirt call in
    /// the registry's lock scope.
    pub fn remove(&self, id: &str) -> Option<String> {
        let mut g = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        g.remove(id).map(|e| e.domain_name)
    }

    /// Sprite ids whose TTL has passed.
    fn expired_ids(&self) -> Vec<String> {
        let now = Utc::now();
        let g = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        g.iter()
            .filter(|(_, e)| e.expires_at <= now)
            .map(|(id, _)| id.clone())
            .collect()
    }
}

/// Tear down one sprite's domain + overlay disk. Shared by the reaper loop
/// and the explicit `DELETE /v1/sprites/{id}` handler so both paths do
/// exactly the same cleanup. `delete_disks: true` only ever unlinks the
/// domain's *own* `<source file>` (the overlay) — never the golden image,
/// whose path lives inside the overlay qcow2's internal backing header, not
/// in domain XML (verified by reading `domain::collect_disk_paths`).
/// Correctly a no-op (`Ok`) if the domain is already gone — see
/// `delete_vm_with_options`'s `NotFound` short-circuit — so a reaper retry
/// after a partial failure is safe.
pub async fn teardown_sprite(manager: &LibvirtManager, domain_name: String) -> Result<(), String> {
    let mgr = manager.clone();
    tokio::task::spawn_blocking(move || {
        mgr.with_conn(|conn| {
            delete_vm_with_options(
                conn,
                &domain_name,
                &UndefineOptions {
                    delete_disks: true,
                    ..Default::default()
                },
            )
        })
    })
    .await
    .map_err(|e| format!("teardown task join error: {e}"))?
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Background loop: every `REAP_INTERVAL`, tear down any sprite past its
/// `expires_at`. Started once from `server::create_app` alongside the
/// daemon's other background workers (`ObservabilityWorkers`,
/// `systemd::spawn_watchdog_pinger`).
pub fn spawn_reaper(manager: LibvirtManager, registry: SpriteRegistry) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(REAP_INTERVAL);
        loop {
            interval.tick().await;
            for id in registry.expired_ids() {
                let Some(domain_name) = registry.remove(&id) else {
                    // Raced with an explicit DELETE that already removed it.
                    continue;
                };
                match teardown_sprite(&manager, domain_name.clone()).await {
                    Ok(()) => tracing::info!("sprite reaper: tore down {id} ({domain_name})"),
                    Err(e) => tracing::warn!(
                        "sprite reaper: failed to tear down {id} ({domain_name}): {e}"
                    ),
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn register_then_get_round_trips() {
        let reg = SpriteRegistry::new();
        let handle = reg
            .register("abc".into(), "sprite-abc".into(), 300, Some(3))
            .unwrap();
        assert_eq!(handle.sprite_id, "abc");
        let fetched = reg.get(&handle.sprite_id).expect("registered sprite present");
        assert_eq!(fetched.sprite_id, handle.sprite_id);
        assert_eq!(fetched.vsock_cid, Some(3));
        assert_eq!(fetched.state, SpriteState::Running);
    }

    #[test]
    fn get_unknown_id_is_none() {
        let reg = SpriteRegistry::new();
        assert!(reg.get("does-not-exist").is_none());
    }

    #[test]
    fn remove_returns_domain_name_once() {
        let reg = SpriteRegistry::new();
        let handle = reg
            .register("xyz".into(), "sprite-xyz".into(), 300, None)
            .unwrap();
        assert_eq!(reg.remove(&handle.sprite_id), Some("sprite-xyz".into()));
        // Second remove is a no-op, not an error — the reaper and an explicit
        // DELETE could race on the same id.
        assert_eq!(reg.remove(&handle.sprite_id), None);
        assert!(reg.get(&handle.sprite_id).is_none());
    }

    #[test]
    fn expired_ids_only_returns_past_ttl() {
        let reg = SpriteRegistry::new();
        let long_lived = reg
            .register("long".into(), "sprite-long".into(), 3600, None)
            .unwrap();
        let already_expired = reg
            .register("expired".into(), "sprite-expired".into(), 0, None)
            .unwrap();
        // ttl_seconds=0 means expires_at == created_at, which is <= now by
        // the time expired_ids() runs.
        let expired = reg.expired_ids();
        assert!(expired.contains(&already_expired.sprite_id));
        assert!(!expired.contains(&long_lived.sprite_id));
    }

    #[test]
    fn list_returns_all_registered_handles() {
        let reg = SpriteRegistry::new();
        reg.register("a".into(), "sprite-a".into(), 300, None).unwrap();
        reg.register("b".into(), "sprite-b".into(), 300, None).unwrap();
        assert_eq!(reg.list().len(), 2);
    }
}
