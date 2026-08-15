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
//!
//! Backend-agnostic: a sprite boots on either libvirt/QEMU
//! (`machina_core::libvirt::sprite`) or Cloud Hypervisor
//! (`machina_core::cloud_hypervisor::sprite`) — see `SpriteBackendHandle`.

use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use chrono::{DateTime, Utc};
use machina_core::cloud_hypervisor::sprite::teardown_sprite_chv;
use machina_core::libvirt::domain::{delete_vm_with_options, UndefineOptions};
use machina_core::LibvirtManager;
use machina_spec::{SpriteBackend, SpriteHandle, SpriteState};

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

/// Guest vsock CIDs are arbitrated host-wide by the kernel's `vhost_vsock`
/// module regardless of hypervisor — 0/1/2 are reserved
/// (hypervisor/reserved/host), so assignable guest CIDs start at 3.
const FIRST_VSOCK_CID: u32 = 3;

/// Identifies which hypervisor booted a sprite and what's needed to tear it
/// down. Libvirt sprites are supervised by libvirtd (`domain_name` is
/// enough to find and destroy the domain); Cloud Hypervisor sprites are
/// supervised directly by this daemon as a child process, so their handle
/// carries everything `teardown_sprite_chv` needs.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SpriteBackendHandle {
    Libvirt {
        domain_name: String,
    },
    CloudHypervisor {
        pid: u32,
        api_socket: PathBuf,
        disk_path: PathBuf,
        vsock_socket: PathBuf,
        /// `Some` when the sprite was booted with `network_egress` — needed
        /// so teardown can remove the TAP device.
        tap_name: Option<String>,
    },
}

impl SpriteBackendHandle {
    /// The API-visible `SpriteBackend` this handle represents — derived from
    /// the variant itself (not a separately-tracked field) so it can never
    /// drift from which backend actually booted the sprite.
    fn kind(&self) -> SpriteBackend {
        match self {
            SpriteBackendHandle::Libvirt { .. } => SpriteBackend::Libvirt,
            SpriteBackendHandle::CloudHypervisor { .. } => SpriteBackend::CloudHypervisor,
        }
    }

    /// Short label for reaper/audit log lines.
    pub(crate) fn describe(&self) -> String {
        match self {
            SpriteBackendHandle::Libvirt { domain_name } => domain_name.clone(),
            SpriteBackendHandle::CloudHypervisor { pid, .. } => format!("cloud-hypervisor pid {pid}"),
        }
    }
}

struct SpriteEntry {
    handle: SpriteHandle,
    backend: SpriteBackendHandle,
    expires_at: DateTime<Utc>,
}

#[derive(Clone)]
pub struct SpriteRegistry {
    inner: Arc<Mutex<HashMap<String, SpriteEntry>>>,
    /// CIDs currently in use by *either* backend — populated eagerly by
    /// `next_vsock_cid()` for Cloud Hypervisor (which must pick a CID before
    /// it can boot) and by `register()` for libvirt (whose CID is only known
    /// after boot, once its `<cid auto='yes'/>` assignment is read back from
    /// the running domain's XML). A single shared set is what actually
    /// closes the collision this replaced a blind per-backend counter for:
    /// two independent counters both starting at `FIRST_VSOCK_CID` reliably
    /// collided the first time each backend's first sprite booted around the
    /// same time (reproduced live — see the sprites design notes).
    claimed_vsock_cids: Arc<Mutex<HashSet<u32>>>,
}

impl Default for SpriteRegistry {
    fn default() -> Self {
        Self {
            inner: Arc::new(Mutex::new(HashMap::new())),
            claimed_vsock_cids: Arc::new(Mutex::new(HashSet::new())),
        }
    }
}

impl SpriteRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Hand out a fresh guest vsock CID for a Cloud Hypervisor sprite,
    /// distinct from every CID any *currently running* sprite of either
    /// backend holds (checked against `claimed_vsock_cids`, which
    /// `register()` populates for libvirt sprites too — see that field's
    /// doc comment for why a shared set, not a per-backend counter, is what
    /// this needs). Claims the CID immediately, under the same lock as the
    /// scan, so two concurrent Cloud Hypervisor creations can never both
    /// pick the same value. Reused after a sprite is torn down (`remove()`
    /// releases its CID) — safe, since by then nothing holds it — but never
    /// explicitly released if the boot that requested it then fails; sprite
    /// churn stays well below `u32`'s range, so a CID leaked on a failed
    /// boot isn't worth the extra plumbing to reclaim.
    pub fn next_vsock_cid(&self) -> u32 {
        let mut claimed = self.claimed_vsock_cids.lock().unwrap_or_else(|e| e.into_inner());
        let mut candidate = FIRST_VSOCK_CID;
        while claimed.contains(&candidate) {
            candidate += 1;
        }
        claimed.insert(candidate);
        candidate
    }

    /// Record a sprite whose backend is already running (boot happens
    /// synchronously in the route handler before this is called — there's
    /// no separate async "booting" phase to track).
    ///
    /// `sprite_id` must be the same id the caller used when booting (e.g.
    /// to derive `domain_name` via `sprite_domain_name()`, or to namespace
    /// a Cloud Hypervisor sprite's run directory) — minting a fresh id here
    /// instead would desync the id handed back to API clients from the
    /// actual running sprite, making `virsh`/manual ops on a returned id
    /// impossible.
    pub fn register(
        &self,
        sprite_id: String,
        backend: SpriteBackendHandle,
        ttl_seconds: u64,
        vsock_cid: Option<u32>,
        network_egress: bool,
    ) -> Result<SpriteHandle, &'static str> {
        let mut g = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        if g.len() >= MAX_SPRITES {
            return Err("sprite registry is full — the reaper may have fallen behind");
        }
        if let Some(cid) = vsock_cid {
            // Idempotent for Cloud Hypervisor (already claimed by
            // next_vsock_cid()); this is the only claim point for libvirt,
            // whose CID is only known after boot.
            self.claimed_vsock_cids
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .insert(cid);
        }
        let now = Utc::now();
        let expires_at = now + chrono::Duration::seconds(ttl_seconds as i64);
        let handle = SpriteHandle {
            sprite_id: sprite_id.clone(),
            state: SpriteState::Running,
            created_at: now.to_rfc3339(),
            expires_at: expires_at.to_rfc3339(),
            vsock_cid,
            backend: backend.kind(),
            network_egress,
        };
        g.insert(
            sprite_id,
            SpriteEntry {
                handle: handle.clone(),
                backend,
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

    /// Remove the bookkeeping entry and return its backend handle for the
    /// caller to actually tear down. Bookkeeping-only: does not touch
    /// libvirt or spawn any process itself, so it's safe to call from
    /// either the reaper or an explicit `DELETE /v1/sprites/{id}` handler
    /// without a teardown call in the registry's lock scope. Releases the
    /// removed sprite's vsock CID (if any) back to `claimed_vsock_cids` so
    /// `next_vsock_cid()` can hand it out again.
    pub fn remove(&self, id: &str) -> Option<SpriteBackendHandle> {
        let mut g = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let entry = g.remove(id)?;
        if let Some(cid) = entry.handle.vsock_cid {
            self.claimed_vsock_cids
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .remove(&cid);
        }
        Some(entry.backend)
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

/// Tear down one sprite, dispatching on which backend booted it. Shared by
/// the reaper loop and the explicit `DELETE /v1/sprites/{id}` handler so
/// both paths do exactly the same cleanup.
///
/// Libvirt: `delete_disks: true` only ever unlinks the domain's *own*
/// `<source file>` (the overlay) — never the golden image, whose path lives
/// inside the overlay qcow2's internal backing header, not in domain XML
/// (verified by reading `domain::collect_disk_paths`). Correctly a no-op
/// (`Ok`) if the domain is already gone — see `delete_vm_with_options`'s
/// `NotFound` short-circuit — so a reaper retry after a partial failure is
/// safe.
///
/// Cloud Hypervisor: `teardown_sprite_chv` applies the same "already gone
/// is success" rule for the same reason.
pub async fn teardown_sprite(manager: &LibvirtManager, backend: SpriteBackendHandle) -> Result<(), String> {
    match backend {
        SpriteBackendHandle::Libvirt { domain_name } => {
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
        SpriteBackendHandle::CloudHypervisor {
            pid,
            api_socket,
            disk_path,
            vsock_socket,
            tap_name,
        } => teardown_sprite_chv(pid, &api_socket, &disk_path, &vsock_socket, tap_name.as_deref()).await,
    }
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
                let Some(backend) = registry.remove(&id) else {
                    // Raced with an explicit DELETE that already removed it.
                    continue;
                };
                let label = backend.describe();
                match teardown_sprite(&manager, backend).await {
                    Ok(()) => tracing::info!("sprite reaper: tore down {id} ({label})"),
                    Err(e) => tracing::warn!("sprite reaper: failed to tear down {id} ({label}): {e}"),
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn libvirt_backend(domain_name: &str) -> SpriteBackendHandle {
        SpriteBackendHandle::Libvirt {
            domain_name: domain_name.into(),
        }
    }

    fn chv_backend(pid: u32) -> SpriteBackendHandle {
        SpriteBackendHandle::CloudHypervisor {
            pid,
            api_socket: PathBuf::from(format!("/var/lib/machina/sprite-run/{pid}/api.sock")),
            disk_path: PathBuf::from(format!("/var/lib/machina/sprite-run/{pid}/overlay.qcow2")),
            vsock_socket: PathBuf::from(format!("/var/lib/machina/sprite-run/{pid}/vsock.sock")),
            tap_name: None,
        }
    }

    #[test]
    fn register_then_get_round_trips() {
        let reg = SpriteRegistry::new();
        let handle = reg
            .register("abc".into(), libvirt_backend("sprite-abc"), 300, Some(3), false)
            .unwrap();
        assert_eq!(handle.sprite_id, "abc");
        let fetched = reg.get(&handle.sprite_id).expect("registered sprite present");
        assert_eq!(fetched.sprite_id, handle.sprite_id);
        assert_eq!(fetched.vsock_cid, Some(3));
        assert_eq!(fetched.state, SpriteState::Running);
        assert_eq!(fetched.backend, SpriteBackend::Libvirt);
    }

    #[test]
    fn register_reports_network_egress() {
        let reg = SpriteRegistry::new();
        let handle = reg
            .register("egress1".into(), libvirt_backend("sprite-egress1"), 300, Some(3), true)
            .unwrap();
        assert!(handle.network_egress);
        assert!(reg.get(&handle.sprite_id).unwrap().network_egress);
    }

    #[test]
    fn register_reports_cloud_hypervisor_backend_kind() {
        let reg = SpriteRegistry::new();
        let handle = reg.register("chv-kind".into(), chv_backend(1), 300, Some(3), false).unwrap();
        assert_eq!(handle.backend, SpriteBackend::CloudHypervisor);
    }

    #[test]
    fn get_unknown_id_is_none() {
        let reg = SpriteRegistry::new();
        assert!(reg.get("does-not-exist").is_none());
    }

    #[test]
    fn remove_returns_backend_handle_once() {
        let reg = SpriteRegistry::new();
        let handle = reg
            .register("xyz".into(), libvirt_backend("sprite-xyz"), 300, None, false)
            .unwrap();
        assert_eq!(reg.remove(&handle.sprite_id), Some(libvirt_backend("sprite-xyz")));
        // Second remove is a no-op, not an error — the reaper and an explicit
        // DELETE could race on the same id.
        assert_eq!(reg.remove(&handle.sprite_id), None);
        assert!(reg.get(&handle.sprite_id).is_none());
    }

    #[test]
    fn register_and_remove_round_trips_cloud_hypervisor_backend() {
        let reg = SpriteRegistry::new();
        let backend = chv_backend(4242);
        let handle = reg.register("chv1".into(), backend.clone(), 300, Some(7), false).unwrap();
        assert_eq!(reg.get(&handle.sprite_id).unwrap().vsock_cid, Some(7));
        assert_eq!(reg.remove(&handle.sprite_id), Some(backend));
    }

    #[test]
    fn expired_ids_only_returns_past_ttl() {
        let reg = SpriteRegistry::new();
        let long_lived = reg
            .register("long".into(), libvirt_backend("sprite-long"), 3600, None, false)
            .unwrap();
        let already_expired = reg
            .register("expired".into(), libvirt_backend("sprite-expired"), 0, None, false)
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
        reg.register("a".into(), libvirt_backend("sprite-a"), 300, None, false).unwrap();
        reg.register("b".into(), chv_backend(99), 300, None, false).unwrap();
        assert_eq!(reg.list().len(), 2);
    }

    #[test]
    fn next_vsock_cid_hands_out_distinct_increasing_values() {
        let reg = SpriteRegistry::new();
        let a = reg.next_vsock_cid();
        let b = reg.next_vsock_cid();
        let c = reg.next_vsock_cid();
        assert!(a >= FIRST_VSOCK_CID);
        assert!(b > a);
        assert!(c > b);
    }

    /// Reproduces a real collision seen live: a libvirt sprite's
    /// kernel-auto-assigned CID and a Cloud Hypervisor sprite's
    /// registry-allocated CID both independently landed on
    /// `FIRST_VSOCK_CID` because each backend's allocator started fresh.
    /// `next_vsock_cid()` must see the libvirt sprite's already-registered
    /// CID and skip past it, not just avoid its own prior allocations.
    #[test]
    fn next_vsock_cid_skips_a_cid_a_registered_libvirt_sprite_already_holds() {
        let reg = SpriteRegistry::new();
        reg.register(
            "libvirt-first".into(),
            libvirt_backend("sprite-libvirt-first"),
            300,
            Some(FIRST_VSOCK_CID),
            false,
        )
        .unwrap();

        let allocated = reg.next_vsock_cid();
        assert_ne!(allocated, FIRST_VSOCK_CID);
    }

    #[test]
    fn removing_a_sprite_frees_its_vsock_cid_for_reuse() {
        let reg = SpriteRegistry::new();
        let cid = reg.next_vsock_cid();
        let handle = reg.register("chv1".into(), chv_backend(1), 300, Some(cid), false).unwrap();
        reg.remove(&handle.sprite_id);

        // The registry has no other claims left, so the freed CID is the
        // lowest one available again.
        assert_eq!(reg.next_vsock_cid(), cid);
    }
}
