//! Optional `virt-install` backend for VM create (hyper2kvm-style), plus Cockpit-machines-style flags.

use std::path::Path;
use std::process::Command;

use virt::connect::Connect;
use virt::domain::Domain;

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

/// True when the JSON body uses fields only implemented by the `virt-install` create path.
pub fn create_request_uses_virt_install_extensions(req: &CreateVmRequest) -> bool {
    req.virt_install_define_only
        || !req.virt_install_location.trim().is_empty()
        || req.virt_install_pxe
        || !req.virt_install_install_os.trim().is_empty()
        || (!req.root_disk_storage_pool.trim().is_empty()
            && !req.root_disk_storage_volume.trim().is_empty())
        || !req.virt_install_disk_backing_store.trim().is_empty()
}

fn extract_domain_xml_from_print_xml(stdout: &[u8]) -> Result<String, LibvirtError> {
    let s = String::from_utf8_lossy(stdout);
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return Err(LibvirtError::Operation(
            "virt-install --print-xml produced no output".into(),
        ));
    }
    let last = trimmed
        .split("\n\n")
        .filter(|p| !p.trim().is_empty())
        .last()
        .unwrap_or(trimmed)
        .trim();
    if !last.contains("<domain") {
        return Err(LibvirtError::Operation(
            "virt-install --print-xml output did not contain a <domain> document".into(),
        ));
    }
    Ok(last.to_string())
}

/// Run `virt-install` to define a new VM (no libvirt XML emit in virtspawn).
pub fn create_vm_virt_install(
    conn: &Connect,
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

    let define_only = req.virt_install_define_only;
    let pxe = req.virt_install_pxe;
    let location = req.virt_install_location.trim();
    let install_os = req.virt_install_install_os.trim();
    let extra = req.virt_install_extra_args.trim();
    let pool = req.root_disk_storage_pool.trim();
    let vol = req.root_disk_storage_volume.trim();
    let backing = req.virt_install_disk_backing_store.trim();
    let pxe_net = if req.virt_install_pxe_network.trim().is_empty() {
        net
    } else {
        req.virt_install_pxe_network.trim()
    };
    if !req.virt_install_pxe_network.trim().is_empty() {
        validate_virt_install_field(pxe_net, "virt_install_pxe_network")?;
    }

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
    if !req.existing_disk.is_empty() {
        let disk = Path::new(&req.existing_disk);
        if !disk.is_absolute() || !disk.is_file() {
            return Err(LibvirtError::Invalid(
                "existing_disk must be an absolute path to an existing file".into(),
            ));
        }
    }

    let mut args: Vec<String> = vec![
        "--connect".into(),
        libvirt_uri.to_string(),
        "--quiet".into(),
        "--os-variant".into(),
        osv.to_string(),
        "--memory".into(),
        req.memory_mb.to_string(),
        "--name".into(),
        req.name.clone(),
        "--vcpus".into(),
        req.vcpus.to_string(),
    ];

    if req.virt_install_path_in_use_check_off
        || !pool.is_empty()
        || !req.existing_disk.is_empty()
        || !backing.is_empty()
    {
        args.push("--check".into());
        args.push("path_in_use=off".into());
    }

    if !define_only {
        args.push("--wait".into());
        args.push("-1".into());
        args.push("--noautoconsole".into());
    }

    if firmware == "uefi" {
        args.push("--boot".into());
        args.push("uefi".into());
    }

    // NIC (always one libvirt network; PXE adds a second `--network` below.)
    args.push("--network".into());
    args.push(format!("network={net}"));

    // Graphics
    if gt.eq_ignore_ascii_case("spice") {
        args.push("--graphics".into());
        args.push(format!("spice,listen={gl}"));
        args.push("--video".into());
        args.push("qxl".into());
    } else {
        args.push("--graphics".into());
        args.push(format!("vnc,listen={gl}"));
    }

    // Root disk
    if define_only {
        if !pool.is_empty() {
            args.push("--disk".into());
            args.push(format!("vol={pool}/{vol},bus=virtio"));
        } else if !req.existing_disk.is_empty() {
            args.push("--disk".into());
            args.push(format!("path={},bus=virtio", req.existing_disk));
        } else {
            crate::validate::validate_disk_gb(req.disk_gb)?;
            args.push("--disk".into());
            args.push(format!("size={},format=qcow2", req.disk_gb));
        }
    } else if !pool.is_empty() {
        args.push("--disk".into());
        args.push(format!("vol={pool}/{vol},bus=virtio"));
        if !req.iso.is_empty() {
            args.push("--cdrom".into());
            args.push(req.iso.clone());
        }
        if !define_only
            && req.iso.is_empty()
            && !pxe
            && location.is_empty()
            && install_os.is_empty()
            && backing.is_empty()
        {
            // Preallocated volume that already contains a guest disk image.
            args.push("--import".into());
        }
    } else if !req.existing_disk.is_empty() {
        args.push("--disk".into());
        args.push(format!("path={},bus=virtio", req.existing_disk));
        if !req.iso.is_empty() {
            args.push("--cdrom".into());
            args.push(req.iso.clone());
        }
        args.push("--import".into());
    } else if !backing.is_empty() {
        crate::validate::validate_disk_gb(req.disk_gb)?;
        args.push("--disk".into());
        args.push(format!(
            "size={},format=qcow2,backing_store={}",
            req.disk_gb, backing
        ));
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
        } else if !pxe && location.is_empty() && install_os.is_empty() {
            // Blank qcow2: only use --import when no network/PXE/OS media will drive the installer.
            if firmware == "bios" {
                args.push("--boot".into());
                args.push("hd".into());
                args.push("--import".into());
            } else {
                args.push("--import".into());
            }
        }
    }

    if !req.cloud_init_iso.is_empty() {
        args.push("--disk".into());
        args.push(format!(
            "path={},device=cdrom,bus=sata,readonly=on",
            req.cloud_init_iso
        ));
    }

    // Install / boot source (define_only skips — matches cockpit-machines install_machine.py)
    if define_only {
        args.push("--print-xml".into());
        args.push("1".into());
    } else if pxe {
        args.push("--pxe".into());
        args.push("--network".into());
        args.push(format!("network={pxe_net}"));
    } else if !install_os.is_empty() {
        args.push("--install".into());
        args.push(format!("os={install_os}"));
        if !extra.is_empty() {
            args.push("--extra-args".into());
            args.push(extra.to_string());
        }
    } else if !location.is_empty() {
        args.push("--location".into());
        args.push(location.to_string());
        if !extra.is_empty() {
            args.push("--extra-args".into());
            args.push(extra.to_string());
        }
    } else if !req.existing_disk.is_empty() || !backing.is_empty() {
        // import + optional cdrom already applied
    } else if !req.iso.is_empty() && !extra.is_empty() {
        args.push("--extra-args".into());
        args.push(extra.to_string());
    }

    tracing::info!("virt-install {}", args.join(" "));

    if define_only {
        subprocess::log_line(
            log,
            "virtspawn",
            "virt-install --print-xml=1 (define only, no installer)…",
        );
        let summary = format!("$ virt-install {}", args.join(" "));
        let mut cmd = Command::new("virt-install");
        cmd.args(&args);
        let out = subprocess::run_command_streaming(cmd, &summary, "virt-install", None)?;
        if !out.status.success() {
            return Err(LibvirtError::Operation(format!(
                "virt-install --print-xml failed (exit {})",
                out.status
            )));
        }
        let xml = extract_domain_xml_from_print_xml(&out.stdout)?;
        Domain::define_xml(conn, &xml).map_err(|e| {
            LibvirtError::Operation(format!("Failed to define VM '{}' from virt-install XML: {e}", req.name))
        })?;
        subprocess::log_line(log, "virtspawn", "Domain defined from virt-install XML.");
        return Ok(());
    }

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
