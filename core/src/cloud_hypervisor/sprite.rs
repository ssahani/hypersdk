// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! Boot/tear down a disposable "sprite" microVM on Cloud Hypervisor.
//!
//! Structurally mirrors `crate::libvirt::sprite`: same golden-image overlay
//! primitive (`libvirt::template_apply::materialize_from_base`), same
//! "throwaway, headless, destroy-only" semantics. The difference is process
//! ownership — libvirt sprites are supervised by libvirtd, so
//! `core::libvirt::sprite::boot_sprite` only has to issue one
//! `Domain::create_xml` call and hand back a handle; here `machina-daemon`
//! itself is the direct parent of the `cloud-hypervisor` process and owns
//! its whole lifecycle (boot-readiness, and later teardown).

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use tokio::process::Command as TokioCommand;
use tokio::time::Instant;

use crate::LibvirtError;

use super::{find_ch_remote_binary, find_cloud_hypervisor_binary};

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
}

pub struct ChvBootResult {
    /// Overlay qcow2 path — same teardown ownership rule as the libvirt
    /// backend: only ever delete this, never `golden_image_path`.
    pub disk_path: PathBuf,
    pub pid: u32,
    pub api_socket: PathBuf,
    pub vsock_socket: PathBuf,
}

/// Clone `req.golden_image_path` via a qcow2 backing-file overlay, then
/// spawn `cloud-hypervisor` directly as a child of the daemon process.
pub async fn boot_sprite_chv(req: &ChvBootRequest<'_>) -> Result<ChvBootResult, LibvirtError> {
    let chv_binary = find_cloud_hypervisor_binary()?;

    let run_dir = PathBuf::from(SPRITE_RUN_DIR).join(req.sprite_id);
    fs::create_dir_all(&run_dir)
        .map_err(|e| LibvirtError::Operation(format!("failed to create sprite run dir: {e}")))?;
    let disk_path = run_dir.join("overlay.qcow2");
    let api_socket = run_dir.join("api.sock");
    let vsock_socket = run_dir.join("vsock.sock");

    crate::libvirt::template_apply::materialize_from_base(req.golden_image_path, &disk_path, "backing")?;

    let mut child = match TokioCommand::new(chv_binary)
        .arg("--cpus")
        .arg(format!("boot={}", req.vcpus))
        .arg("--memory")
        .arg(format!("size={}M", req.memory_mb))
        .arg("--disk")
        .arg(format!("path={}", disk_path.display()))
        .arg("--vsock")
        .arg(format!("cid={},socket={}", req.vsock_cid, vsock_socket.display()))
        .arg("--api-socket")
        .arg(format!("path={}", api_socket.display()))
        .arg("--serial")
        .arg("off")
        .arg("--console")
        .arg("off")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            let _ = fs::remove_dir_all(&run_dir);
            return Err(LibvirtError::Operation(format!(
                "failed to spawn cloud-hypervisor: {e}"
            )));
        }
    };
    let pid = child
        .id()
        .ok_or_else(|| LibvirtError::Internal("cloud-hypervisor spawned without a pid".into()))?;

    // Poll for the API socket rather than a fixed sleep — mirrors waiting on
    // `Domain::create_xml` returning in the libvirt backend, which is
    // likewise synchronous-until-booted.
    let deadline = Instant::now() + BOOT_READY_TIMEOUT;
    loop {
        if api_socket.exists() {
            break;
        }
        if let Ok(Some(status)) = child.try_wait() {
            let _ = fs::remove_dir_all(&run_dir);
            return Err(LibvirtError::Operation(format!(
                "cloud-hypervisor exited before booting (status: {status})"
            )));
        }
        if Instant::now() >= deadline {
            let _ = child.start_kill();
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
    fn boot_sprite_chv_rejects_missing_binary_without_touching_run_dir() {
        // find_cloud_hypervisor_binary() fails on any host without
        // cloud-hypervisor installed (true for this workspace's own CI/dev
        // containers) — asserting the error type doubles as coverage that
        // the fast-fail-before-any-filesystem-mutation path is taken. Full
        // boot/teardown behavior is exercised by the daemon-side manual
        // smoke test described in the sprite backend design notes; it needs
        // a real /dev/kvm + cloud-hypervisor host, not a unit test.
        let rt = tokio::runtime::Runtime::new().unwrap();
        let req = ChvBootRequest {
            sprite_id: "unit-test-does-not-exist",
            golden_image_path: Path::new("/nonexistent/golden.qcow2"),
            vcpus: 1,
            memory_mb: 512,
            vsock_cid: 3,
        };
        let result = rt.block_on(boot_sprite_chv(&req));
        assert!(matches!(result, Err(LibvirtError::NotFound(_))));
    }
}
