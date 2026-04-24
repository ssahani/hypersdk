//! Optional `virt-install` backend for VM create (hyper2kvm-style), plus `--import` for existing disks.

use std::path::Path;
use std::process::Command;

use crate::state::CreateVmRequest;
use crate::LibvirtError;

use super::subprocess::{self, VmCreateLogSink};

fn validate_virt_install_field(s: &str, label: &str) -> Result<(), LibvirtError> {
    if s.is_empty() {
        return Ok(());
    }
    if !s.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '_' || c == '-') {
        return Err(LibvirtError::Invalid(format!(
            "{label} may only contain letters, digits, dot, underscore, hyphen"
        )));
    }
    Ok(())
}

/// Run `virt-install` to define a new VM (no libvirt XML emit in virtspawn).
pub fn create_vm_virt_install(
    req: &CreateVmRequest,
    libvirt_uri: &str,
    log: Option<&VmCreateLogSink>,
) -> Result<(), LibvirtError> {
    crate::validate::validate_vcpus(req.vcpus)?;
    crate::validate::validate_memory_mb(req.memory_mb)?;
    let net = if req.network.trim().is_empty() {
        "default"
    } else {
        req.network.trim()
    };
    validate_virt_install_field(net, "network")?;
    let osv = if req.os_variant.trim().is_empty() {
        "generic"
    } else {
        req.os_variant.trim()
    };
    validate_virt_install_field(osv, "os_variant")?;

    let firmware = if req.firmware.is_empty() {
        "bios"
    } else {
        req.firmware.trim()
    };
    if firmware != "bios" && firmware != "uefi" {
        return Err(LibvirtError::Invalid(
            "Firmware must be 'bios' or 'uefi'".into(),
        ));
    }

    let gl = req.graphics_listen.trim();
    let gl = if gl.is_empty() { "127.0.0.1" } else { gl };
    crate::validate::validate_graphics_listen(gl)?;

    let gt = req.graphics_type.trim();
    let gt = if gt.is_empty() { "vnc" } else { gt };
    crate::validate::validate_graphics_type(gt)?;

    if !req.iso.is_empty() {
        let p = Path::new(&req.iso);
        if !p.is_absolute() {
            return Err(LibvirtError::Invalid("ISO path must be absolute".into()));
        }
        if !p.is_file() {
            return Err(LibvirtError::Operation(format!(
                "ISO not found: {}",
                req.iso
            )));
        }
    }
    if !req.cloud_init_iso.is_empty() {
        let p = Path::new(&req.cloud_init_iso);
        if !p.is_absolute() || !p.is_file() {
            return Err(LibvirtError::Invalid(
                "cloud_init_iso must be an absolute path to an existing file".into(),
            ));
        }
    }

    let mut args: Vec<String> = vec![
        "--connect".into(),
        libvirt_uri.to_string(),
        "--name".into(),
        req.name.clone(),
        "--vcpus".into(),
        req.vcpus.to_string(),
        "--memory".into(),
        req.memory_mb.to_string(),
        "--os-variant".into(),
        osv.to_string(),
        "--network".into(),
        format!("network={net}"),
        "--noautoconsole".into(),
    ];

    if firmware == "uefi" {
        args.push("--boot".into());
        args.push("uefi".into());
    }

    // Graphics (hyper2kvm leaves defaults; we match dashboard listen/type.)
    if gt.eq_ignore_ascii_case("spice") {
        args.push("--graphics".into());
        args.push(format!("spice,listen={gl}"));
        args.push("--video".into());
        args.push("qxl".into());
    } else {
        args.push("--graphics".into());
        args.push(format!("vnc,listen={gl}"));
    }

    if !req.existing_disk.is_empty() {
        let disk = Path::new(&req.existing_disk);
        if !disk.is_absolute() || !disk.is_file() {
            return Err(LibvirtError::Invalid(
                "existing_disk must be an absolute path to an existing file".into(),
            ));
        }
        args.push("--disk".into());
        args.push(format!("path={},bus=virtio", req.existing_disk));
        if !req.iso.is_empty() {
            args.push("--cdrom".into());
            args.push(req.iso.clone());
        }
        args.push("--import".into());
    } else {
        crate::validate::validate_disk_gb(req.disk_gb)?;
        args.push("--disk".into());
        args.push(format!("size={},format=qcow2", req.disk_gb));
        if !req.iso.is_empty() {
            args.push("--cdrom".into());
            args.push(req.iso.clone());
        } else if firmware == "bios" {
            args.push("--boot".into());
            args.push("hd".into());
            args.push("--import".into());
        } else {
            // UEFI: `--boot uefi` was already added above.
            args.push("--import".into());
        }
    }

    if !req.cloud_init_iso.is_empty() {
        args.push("--disk".into());
        args.push(format!(
            "path={},device=cdrom,bus=sata,readonly=on",
            req.cloud_init_iso
        ));
    }

    tracing::info!("virt-install {}", args.join(" "));

    let summary = format!("$ virt-install {}", args.join(" "));
    let mut cmd = Command::new("virt-install");
    cmd.args(&args);
    let out = subprocess::run_command_streaming(cmd, &summary, "virt-install", log)?;

    if !out.status.success() {
        return Err(LibvirtError::Operation(format!(
            "virt-install failed (exit {}); see streamed log",
            out.status
        )));
    }

    Ok(())
}
