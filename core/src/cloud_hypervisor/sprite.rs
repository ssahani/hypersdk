// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! Boot/tear down a disposable "sprite" microVM on Cloud Hypervisor.
//!
//! Structurally mirrors `crate::libvirt::sprite`: same golden-image registry
//! (`crate::libvirt::sprite::resolve_golden_image`), same "throwaway,
//! headless, destroy-only" semantics. Two real differences, both discovered
//! by actually booting one rather than assumed up front:
//!
//! - **Full copy, not a COW overlay.** Cloud Hypervisor's built-in qcow2
//!   support rejects a disk with a `backing file` at all — even a single
//!   level — with `BlockError { kind: UnsupportedFeature, source:
//!   MaxNestingDepthExceeded }`. The libvirt backend's `"backing"` mode
//!   (instant, thin clone) isn't available here, so this materializes a full
//!   copy instead (`materialize_fast_copy`, below) — slower to prepare than
//!   an overlay, but the only mode Cloud Hypervisor's disk backend accepts.
//! - **Process ownership.** libvirt sprites are supervised by libvirtd, so
//!   `core::libvirt::sprite::boot_sprite` only has to issue one
//!   `Domain::create_xml` call and hand back a handle; here `machina-daemon`
//!   itself is the direct parent of the `cloud-hypervisor` process and owns
//!   its whole lifecycle (boot-readiness, and later teardown).

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

use tokio::io::AsyncBufReadExt;
use tokio::process::Command as TokioCommand;
use tokio::time::Instant;

use crate::LibvirtError;

use super::{find_ch_remote_binary, find_cloud_hypervisor_binary, find_cloud_hypervisor_firmware};

/// Per-sprite Cloud Hypervisor runtime artifacts (overlay disk, API socket,
/// vsock socket) live under here, namespaced by sprite id. Separate from
/// `crate::libvirt::sprite::SPRITE_IMAGES_DIR` (the shared, read-only golden
/// image registry) since these are per-instance and disposed of on
/// teardown.
const SPRITE_RUN_DIR: &str = "/var/lib/machina/sprite-run";

/// Sprites are meant to be near-instant; the API socket typically appears
/// within tens of milliseconds of the process starting. This bounds how
/// long a caller waits before treating a stuck/slow boot as a failure.
const BOOT_READY_TIMEOUT: Duration = Duration::from_secs(5);
const BOOT_READY_POLL_INTERVAL: Duration = Duration::from_millis(50);
/// How long to give `ch-remote shutdown-vmm` to take effect before falling
/// back to `SIGKILL`.
const SHUTDOWN_GRACE: Duration = Duration::from_millis(500);

pub struct ChvBootRequest<'a> {
    /// Namespaces this sprite's run directory — not embedded in any
    /// `cloud-hypervisor` argument.
    pub sprite_id: &'a str,
    pub golden_image_path: &'a Path,
    pub vcpus: u32,
    pub memory_mb: u64,
    /// Must not collide with any other sprite's CID (libvirt- or Cloud
    /// Hypervisor-backed) currently running on this host — see
    /// `daemon::sprite_registry`'s CID allocator. Unlike libvirt's
    /// `<cid auto='yes'/>`, Cloud Hypervisor requires the caller to name one
    /// explicitly.
    pub vsock_cid: u32,
    /// Attach a virtio-net TAP to the host's "default" NAT network
    /// (`virbr0`) instead of staying vsock-only. See
    /// `spec::SpriteCreateRequest::network_egress`'s doc comment for the
    /// isolation posture this implies.
    pub network_egress: bool,
}

pub struct ChvBootResult {
    /// Full-copy qcow2 path (see this module's doc comment for why it's a
    /// copy, not a backing-file overlay) — same teardown ownership rule as
    /// the libvirt backend regardless: only ever delete this, never
    /// `golden_image_path`.
    pub disk_path: PathBuf,
    pub pid: u32,
    pub api_socket: PathBuf,
    pub vsock_socket: PathBuf,
    /// `Some` when `network_egress` was requested — `teardown_sprite_chv`
    /// needs this to remove the TAP device.
    pub tap_name: Option<String>,
}

/// Bridge sprites-with-egress attach to — the host's pre-existing libvirt
/// "default" NAT network, not a new one this module sets up (see
/// `spec::SpriteCreateRequest::network_egress`'s doc comment for why: reuses
/// existing, already-tested NAT/DHCP infrastructure instead of duplicating
/// it, at the cost of sharing that network's posture with regular VMs).
const EGRESS_BRIDGE: &str = "virbr0";

/// Linux interface names are capped at 15 characters (`IFNAMSIZ` is 16
/// including the nul terminator) — a full sprite UUID doesn't fit, so this
/// derives a short, still-namespaced name from it.
fn tap_name_for(sprite_id: &str) -> String {
    let short: String = sprite_id.chars().filter(|c| c.is_ascii_alphanumeric()).take(8).collect();
    format!("chv-{short}")
}

fn run_ip(args: &[&str]) -> Result<(), LibvirtError> {
    let out = Command::new("ip")
        .args(args)
        .output()
        .map_err(|e| LibvirtError::Operation(format!("ip {args:?}: {e}")))?;
    if !out.status.success() {
        return Err(LibvirtError::Operation(format!(
            "ip {args:?} failed: {}",
            String::from_utf8_lossy(&out.stderr)
        )));
    }
    Ok(())
}

/// Create a TAP device and attach it to `EGRESS_BRIDGE`, matching the
/// libvirt "default" network's own NAT/DHCP setup — `ip tuntap add` +
/// `ip link set master` + `ip link set up`, cleaning up the TAP again if any
/// step after creation fails.
fn create_egress_tap(tap: &str) -> Result<(), LibvirtError> {
    run_ip(&["tuntap", "add", tap, "mode", "tap"])?;
    if let Err(e) = run_ip(&["link", "set", tap, "master", EGRESS_BRIDGE]) {
        delete_egress_tap(tap);
        return Err(e);
    }
    if let Err(e) = run_ip(&["link", "set", tap, "up"]) {
        delete_egress_tap(tap);
        return Err(e);
    }
    Ok(())
}

/// Best-effort: also detaches the TAP from its bridge, since deleting the
/// interface removes it from `EGRESS_BRIDGE` as a side effect.
fn delete_egress_tap(tap: &str) {
    let _ = Command::new("ip").args(["link", "del", tap]).output();
}

/// Full, uncompressed copy of `base` to `dest`. Deliberately doesn't reuse
/// `template_apply::materialize_from_base`'s `"copy"` mode — that runs
/// `qemu-img convert -c`, which zlib-compresses every cluster on write,
/// tuned for the VM-template use case where disk space matters more than
/// boot latency. A throwaway sprite wants the opposite tradeoff, so this
/// shells `cp --reflink=auto --sparse=always` instead: near-instant
/// copy-on-write extent sharing on filesystems that support it (btrfs, XFS
/// with reflink), transparently degrading to a plain byte copy — still
/// cheaper than compression — where it doesn't.
fn materialize_fast_copy(base: &Path, dest: &Path) -> Result<(), LibvirtError> {
    let out = Command::new("cp")
        .arg("--reflink=auto")
        .arg("--sparse=always")
        .arg(base)
        .arg(dest)
        .output()
        .map_err(|e| LibvirtError::Operation(format!("cp: {e}")))?;
    if !out.status.success() {
        let _ = fs::remove_file(dest);
        return Err(LibvirtError::Operation(format!(
            "cp --reflink=auto failed: {}",
            String::from_utf8_lossy(&out.stderr)
        )));
    }
    Ok(())
}

/// Materialize a full copy of `req.golden_image_path` (Cloud Hypervisor's
/// qcow2 backend rejects a backing-file overlay — see this module's doc
/// comment), then spawn `cloud-hypervisor` directly as a child of the
/// daemon process.
pub async fn boot_sprite_chv(req: &ChvBootRequest<'_>) -> Result<ChvBootResult, LibvirtError> {
    let chv_binary = find_cloud_hypervisor_binary()?;
    let firmware = find_cloud_hypervisor_firmware()?;

    let run_dir = PathBuf::from(SPRITE_RUN_DIR).join(req.sprite_id);
    fs::create_dir_all(&run_dir)
        .map_err(|e| LibvirtError::Operation(format!("failed to create sprite run dir: {e}")))?;
    let disk_path = run_dir.join("disk.qcow2");
    let api_socket = run_dir.join("api.sock");
    let vsock_socket = run_dir.join("vsock.sock");

    let materialize_result = {
        let src = req.golden_image_path.to_path_buf();
        let dst = disk_path.clone();
        // Blocking (cp, potentially a multi-hundred-MB copy) — off the async
        // executor so a slow copy doesn't stall other requests sharing this
        // worker thread.
        tokio::task::spawn_blocking(move || materialize_fast_copy(&src, &dst))
            .await
            .unwrap_or_else(|e| Err(LibvirtError::Internal(format!("materialize task join error: {e}"))))
    };
    if let Err(e) = materialize_result {
        let _ = fs::remove_dir_all(&run_dir);
        return Err(e);
    }

    let tap_name = if req.network_egress {
        let tap = tap_name_for(req.sprite_id);
        if let Err(e) = create_egress_tap(&tap) {
            let _ = fs::remove_dir_all(&run_dir);
            return Err(e);
        }
        Some(tap)
    } else {
        None
    };

    let mut command = TokioCommand::new(chv_binary);
    command
        .arg("--cpus")
        .arg(format!("boot={}", req.vcpus))
        .arg("--memory")
        .arg(format!("size={}M", req.memory_mb))
        .arg("--disk")
        // image_type=qcow2 explicit: without it cloud-hypervisor auto-detects
        // (deprecated — it warns "specify image type explicitly" every boot).
        .arg(format!("path={},image_type=qcow2", disk_path.display()))
        .arg("--vsock")
        .arg(format!("cid={},socket={}", req.vsock_cid, vsock_socket.display()))
        .arg("--api-socket")
        .arg(format!("path={}", api_socket.display()))
        .arg("--serial")
        .arg("off")
        .arg("--console")
        .arg("off")
        .arg("--firmware")
        .arg(&firmware)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    if let Some(tap) = &tap_name {
        command.arg("--net").arg(format!("tap={tap}"));
    }

    let mut child = match command.spawn() {
        Ok(c) => c,
        Err(e) => {
            if let Some(tap) = &tap_name {
                delete_egress_tap(tap);
            }
            let _ = fs::remove_dir_all(&run_dir);
            return Err(LibvirtError::Operation(format!(
                "failed to spawn cloud-hypervisor: {e}"
            )));
        }
    };
    let pid = match child.id() {
        Some(pid) => pid,
        None => {
            if let Some(tap) = &tap_name {
                delete_egress_tap(tap);
            }
            return Err(LibvirtError::Internal("cloud-hypervisor spawned without a pid".into()));
        }
    };

    // Piped (not null) so a boot failure is diagnosable — but the failure
    // path below only has a couple of read attempts before giving up, and
    // the pipe must be drained continuously for the life of the process
    // regardless (an unread pipe fills its OS buffer and blocks the child's
    // writes, e.g. the "disk image type auto-detection is deprecated"
    // warning Cloud Hypervisor logs even on a successful boot). One task
    // does both: tee each line into `sprite_id`-tagged tracing output (so
    // `journalctl` has it for a post-mortem) and into `last_stderr_line` for
    // the immediate boot-failure error message below.
    let last_stderr_line = std::sync::Arc::new(std::sync::Mutex::new(String::new()));
    if let Some(stderr) = child.stderr.take() {
        let last_stderr_line = last_stderr_line.clone();
        let sprite_id = req.sprite_id.to_string();
        tokio::spawn(async move {
            let mut lines = tokio::io::BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                tracing::warn!("cloud-hypervisor[{sprite_id}]: {line}");
                if let Ok(mut last) = last_stderr_line.lock() {
                    *last = line;
                }
            }
        });
    }

    // Poll for the API socket rather than a fixed sleep — mirrors waiting on
    // `Domain::create_xml` returning in the libvirt backend, which is
    // likewise synchronous-until-booted.
    let deadline = Instant::now() + BOOT_READY_TIMEOUT;
    loop {
        if api_socket.exists() {
            break;
        }
        if let Ok(Some(status)) = child.try_wait() {
            // Give the stderr-draining task a moment to catch the process's
            // final lines before reading `last_stderr_line`.
            tokio::time::sleep(Duration::from_millis(50)).await;
            let last_line = last_stderr_line.lock().map(|l| l.clone()).unwrap_or_default();
            if let Some(tap) = &tap_name {
                delete_egress_tap(tap);
            }
            let _ = fs::remove_dir_all(&run_dir);
            return Err(LibvirtError::Operation(format!(
                "cloud-hypervisor exited before booting (status: {status}): {last_line}"
            )));
        }
        if Instant::now() >= deadline {
            let _ = child.start_kill();
            if let Some(tap) = &tap_name {
                delete_egress_tap(tap);
            }
            let _ = fs::remove_dir_all(&run_dir);
            return Err(LibvirtError::Operation(
                "cloud-hypervisor did not become ready within timeout".into(),
            ));
        }
        tokio::time::sleep(BOOT_READY_POLL_INTERVAL).await;
    }

    // Deliberately drop `child` rather than holding it: tokio's process
    // reaper (its background orphan queue) keeps reaping it even once the
    // `Child` handle is gone, so it never zombies. From here on the daemon
    // controls this sprite's lifetime purely through `pid` + `ch-remote`
    // (see `teardown_sprite_chv`) — mirrors the libvirt backend not holding
    // a `Domain` handle across the sprite's lifetime either.
    drop(child);

    Ok(ChvBootResult {
        disk_path,
        pid,
        api_socket,
        vsock_socket,
        tap_name,
    })
}

/// Tear down one Cloud Hypervisor sprite: ask the VMM to exit via
/// `ch-remote shutdown-vmm` (immediate teardown, no ACPI-graceful guest
/// shutdown attempted — sprites are destroy-only semantics, matching
/// `crate::libvirt::sprite`'s `on_poweroff=destroy` domain XML and
/// `domain::delete_vm_with_options`'s non-graceful `virDomainDestroy`), then
/// fall back to `SIGKILL` if the process is still around shortly after.
/// Treats "already gone" as success throughout, so a reaper retry after a
/// partial failure stays safe.
pub async fn teardown_sprite_chv(
    pid: u32,
    api_socket: &Path,
    disk_path: &Path,
    vsock_socket: &Path,
    tap_name: Option<&str>,
) -> Result<(), String> {
    if let Ok(ch_remote) = find_ch_remote_binary() {
        let _ = TokioCommand::new(ch_remote)
            .arg("--api-socket")
            .arg(api_socket)
            .arg("shutdown-vmm")
            .output()
            .await;
    }

    tokio::time::sleep(SHUTDOWN_GRACE).await;

    // Ignore the result: if `shutdown-vmm` above already worked (or the
    // process crashed on its own), this returns an "already gone" style OS
    // error (ESRCH), which is the outcome we wanted anyway.
    let _ = crate::libvirt::extras::kill_host_process(pid, "KILL");

    if let Some(tap) = tap_name {
        delete_egress_tap(tap);
    }

    let _ = fs::remove_file(disk_path);
    let _ = fs::remove_file(api_socket);
    let _ = fs::remove_file(vsock_socket);
    if let Some(run_dir) = api_socket.parent() {
        let _ = fs::remove_dir_all(run_dir);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn boot_sprite_chv_rejects_bogus_request_without_leaking_run_dir() {
        // Deliberately doesn't assert *which* precondition trips first
        // (missing cloud-hypervisor binary vs. missing golden image): this
        // module's own tests run on hosts that install cloud-hypervisor by
        // default (see install.sh's ensure_cloud_hypervisor), so pinning to
        // `find_cloud_hypervisor_binary()`'s NotFound would be true on a
        // bare dev/CI container but false on a real daemon host — either
        // way, a bogus golden image path must fail, and must not leave the
        // per-sprite run directory behind. That's the invariant this test
        // protects; see the daemon-side manual smoke test in the sprite
        // backend design notes for full boot/teardown coverage against a
        // real /dev/kvm + cloud-hypervisor host.
        let rt = tokio::runtime::Runtime::new().unwrap();
        let sprite_id = "unit-test-does-not-exist";
        let req = ChvBootRequest {
            sprite_id,
            golden_image_path: Path::new("/nonexistent/golden.qcow2"),
            vcpus: 1,
            memory_mb: 512,
            vsock_cid: 3,
            network_egress: false,
        };
        let result = rt.block_on(boot_sprite_chv(&req));
        assert!(result.is_err());
        assert!(!PathBuf::from(SPRITE_RUN_DIR).join(sprite_id).exists());
    }

    /// Full boot -> teardown lifecycle against a *real* `cloud-hypervisor`
    /// install — the one thing the tests above deliberately don't cover
    /// (they only prove the fast-fail-before-any-side-effect path). Skips
    /// cleanly rather than failing when cloud-hypervisor/its firmware isn't
    /// installed (most dev/CI hosts) or `SPRITE_RUN_DIR` isn't writable
    /// (needs root, same as the real daemon) — this is meant to actually run
    /// wherever both are true, e.g. `sudo cargo test` on a deployed host.
    ///
    /// Uses a blank, non-bootable synthetic disk: this only needs to prove
    /// the VMM process starts and its API socket comes up, which doesn't
    /// depend on there being a real guest OS on the disk.
    #[test]
    fn boot_and_teardown_sprite_chv_full_lifecycle_against_real_cloud_hypervisor() {
        if find_cloud_hypervisor_binary().is_err() || find_cloud_hypervisor_firmware().is_err() {
            eprintln!("skipping: cloud-hypervisor or its firmware not installed on this host");
            return;
        }
        if fs::create_dir_all(SPRITE_RUN_DIR).is_err() {
            eprintln!("skipping: cannot write to {SPRITE_RUN_DIR} (needs root, like the real daemon)");
            return;
        }

        let rt = tokio::runtime::Runtime::new().unwrap();
        let sprite_id = format!("integration-test-{}", std::process::id());

        let golden_path = std::env::temp_dir().join(format!("{sprite_id}-golden.qcow2"));
        let out = Command::new("qemu-img")
            .args(["create", "-f", "qcow2", golden_path.to_str().unwrap(), "16M"])
            .output()
            .expect("qemu-img create");
        assert!(
            out.status.success(),
            "qemu-img create failed: {}",
            String::from_utf8_lossy(&out.stderr)
        );

        let boot_result = rt.block_on(boot_sprite_chv(&ChvBootRequest {
            sprite_id: &sprite_id,
            golden_image_path: &golden_path,
            vcpus: 1,
            memory_mb: 128,
            // Not going through the daemon's registry allocator (this is a
            // unit test, not the daemon), so pick something unlikely to
            // collide with a sprite a live daemon on the same host is
            // actually running.
            vsock_cid: 4200 + (std::process::id() % 1000),
            network_egress: false,
        }));

        let _ = fs::remove_file(&golden_path);

        let result = match boot_result {
            Ok(r) => r,
            Err(e) => panic!("boot_sprite_chv failed against a real cloud-hypervisor install: {e}"),
        };
        assert!(result.api_socket.exists());
        assert!(result.disk_path.exists());
        assert!(result.tap_name.is_none());

        rt.block_on(teardown_sprite_chv(
            result.pid,
            &result.api_socket,
            &result.disk_path,
            &result.vsock_socket,
            result.tap_name.as_deref(),
        ))
        .expect("teardown_sprite_chv");

        assert!(!result.disk_path.exists(), "teardown should remove the disk copy");
        assert!(!result.api_socket.exists(), "teardown should remove the api socket");
    }

    /// Same lifecycle as above, but with `network_egress: true` — proves the
    /// TAP actually gets created, attached to `virbr0`, and cleaned up.
    /// Skips (in addition to the base test's own skip conditions) when
    /// `virbr0` doesn't exist, e.g. libvirt's "default" network was never
    /// started on this host.
    #[test]
    fn boot_and_teardown_sprite_chv_with_network_egress() {
        if find_cloud_hypervisor_binary().is_err() || find_cloud_hypervisor_firmware().is_err() {
            eprintln!("skipping: cloud-hypervisor or its firmware not installed on this host");
            return;
        }
        if fs::create_dir_all(SPRITE_RUN_DIR).is_err() {
            eprintln!("skipping: cannot write to {SPRITE_RUN_DIR} (needs root, like the real daemon)");
            return;
        }
        if !Command::new("ip")
            .args(["link", "show", EGRESS_BRIDGE])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            eprintln!("skipping: {EGRESS_BRIDGE} doesn't exist on this host (libvirt \"default\" network not active)");
            return;
        }

        let rt = tokio::runtime::Runtime::new().unwrap();
        let sprite_id = format!("integration-test-egress-{}", std::process::id());

        let golden_path = std::env::temp_dir().join(format!("{sprite_id}-golden.qcow2"));
        let out = Command::new("qemu-img")
            .args(["create", "-f", "qcow2", golden_path.to_str().unwrap(), "16M"])
            .output()
            .expect("qemu-img create");
        assert!(out.status.success(), "qemu-img create failed: {}", String::from_utf8_lossy(&out.stderr));

        let boot_result = rt.block_on(boot_sprite_chv(&ChvBootRequest {
            sprite_id: &sprite_id,
            golden_image_path: &golden_path,
            vcpus: 1,
            memory_mb: 128,
            vsock_cid: 4300 + (std::process::id() % 1000),
            network_egress: true,
        }));

        let _ = fs::remove_file(&golden_path);

        let result = match boot_result {
            Ok(r) => r,
            Err(e) => panic!("boot_sprite_chv with network_egress failed: {e}"),
        };
        let tap = result.tap_name.clone().expect("network_egress requested a TAP");
        assert_eq!(tap, tap_name_for(&sprite_id));

        let tap_exists = Command::new("ip")
            .args(["link", "show", &tap])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        assert!(tap_exists, "TAP {tap} should exist while the sprite is running");

        rt.block_on(teardown_sprite_chv(
            result.pid,
            &result.api_socket,
            &result.disk_path,
            &result.vsock_socket,
            result.tap_name.as_deref(),
        ))
        .expect("teardown_sprite_chv");

        let tap_exists_after = Command::new("ip")
            .args(["link", "show", &tap])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        assert!(!tap_exists_after, "teardown should remove the TAP device");
    }
}
