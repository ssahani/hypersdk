// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! Cloud Hypervisor as an alternate microVM backend for disposable "sprite"
//! sandboxes (see `crate::libvirt::sprite` for the original libvirt/QEMU
//! backend). Cloud Hypervisor VMs are launched as plain child processes
//! supervised directly by `machina-daemon` — there is no libvirtd in this
//! path — and controlled via the `ch-remote` CLI against the VMM's
//! Unix-socket API, mirroring how `libvirt::template_apply` already shells
//! out to `qemu-img` rather than linking a client library.

pub mod sprite;

use std::path::Path;
use std::process::Command;

use crate::LibvirtError;

/// Resolve the `cloud-hypervisor` VMM binary.
pub fn find_cloud_hypervisor_binary() -> Result<String, LibvirtError> {
    find_binary(
        "cloud-hypervisor",
        &["/usr/bin/cloud-hypervisor", "/usr/local/bin/cloud-hypervisor"],
    )
}

/// Resolve the `ch-remote` control CLI (ships alongside `cloud-hypervisor`).
pub fn find_ch_remote_binary() -> Result<String, LibvirtError> {
    find_binary("ch-remote", &["/usr/bin/ch-remote", "/usr/local/bin/ch-remote"])
}

/// Resolve the Cloud Hypervisor firmware image (`CLOUDHV.fd`, from the
/// `cloud-hypervisor/edk2` project). Cloud Hypervisor has no built-in BIOS
/// the way QEMU does — booting a disk image without either `--kernel` or
/// `--firmware` fails immediately (`the following required arguments were
/// not provided: --firmware <firmware>|--kernel <kernel>`), so this is
/// exactly as required as the VMM binary itself for the sprite boot path.
pub fn find_cloud_hypervisor_firmware() -> Result<String, LibvirtError> {
    let candidates = [
        "/usr/share/cloud-hypervisor/CLOUDHV.fd",
        "/usr/local/share/cloud-hypervisor/CLOUDHV.fd",
    ];
    for path in candidates {
        if Path::new(path).is_file() {
            return Ok(path.to_string());
        }
    }
    Err(LibvirtError::NotFound(
        "Cloud Hypervisor firmware (CLOUDHV.fd) not found — install.sh's ensure_cloud_hypervisor \
         fetches it alongside the cloud-hypervisor binary"
            .into(),
    ))
}

/// Unlike `translate::qemu::find_qemu_binary` (which silently falls back to
/// a guessed default path — reasonable for QEMU, which is all but
/// guaranteed present on any libvirt/KVM host), a missing Cloud Hypervisor
/// install is a real "not installed" condition. Failing fast here means the
/// `cloudhypervisor` sprite backend rejects the request at boot time with a
/// clear error, the same posture as an unresolvable golden image.
fn find_binary(name: &str, candidates: &[&str]) -> Result<String, LibvirtError> {
    for path in candidates {
        if Path::new(path).is_file() {
            return Ok((*path).to_string());
        }
    }
    if let Ok(out) = Command::new("which").arg(name).output() {
        if out.status.success() {
            let p = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !p.is_empty() {
                return Ok(p);
            }
        }
    }
    Err(LibvirtError::NotFound(format!(
        "{name} not found on PATH (install cloud-hypervisor to use the cloudhypervisor sprite backend)"
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn find_binary_missing_is_not_found() {
        match find_binary("definitely-not-a-real-binary-xyz", &["/no/such/path"]) {
            Err(LibvirtError::NotFound(_)) => {}
            other => panic!("expected NotFound, got {other:?}"),
        }
    }
}
