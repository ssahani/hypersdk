// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

//! Domain graphics via `virt-xml` (Cockpit Machines parity).

use std::process::Command;

use crate::LibvirtError;

/// Emit one or two `<graphics/>` elements for domain XML templates.
pub fn graphics_elements_xml(listen: &str, graphics_type: &str) -> String {
    let listen_esc = crate::xml::escape(listen);
    let gt = graphics_type.trim().to_ascii_lowercase();
    let want_vnc = gt == "vnc" || gt == "both";
    let want_spice = gt == "spice" || gt == "both";
    let mut out = Vec::new();
    if want_vnc {
        out.push(format!(
            "<graphics type='vnc' port='-1' autoport='yes' listen='{listen_esc}'/>"
        ));
    }
    if want_spice {
        if super::create::has_spice() {
            out.push(format!(
                "<graphics type='spice' port='-1' autoport='yes' listen='{listen_esc}'/>"
            ));
        } else if !want_vnc {
            out.push(format!(
                "<graphics type='vnc' port='-1' autoport='yes' listen='{listen_esc}'/>"
            ));
        }
    }
    if out.is_empty() {
        out.push(format!(
            "<graphics type='vnc' port='-1' autoport='yes' listen='{listen_esc}'/>"
        ));
    }
    out.join("\n    ")
}

fn run_virt_xml(uri: &str, vm_name: &str, args: &[&str]) -> Result<String, LibvirtError> {
    let mut cmd = Command::new("virt-xml");
    cmd.arg("-c").arg(uri).arg(vm_name);
    // `--add-device` / `--remove-device` are separate virt-xml modes (not combinable with --edit).
    let device_op = args
        .iter()
        .any(|a| *a == "--add-device" || *a == "--remove-device");
    if !device_op {
        cmd.arg("--edit");
    }
    for a in args {
        cmd.arg(a);
    }
    let out = cmd
        .output()
        .map_err(|e| LibvirtError::Operation(format!("virt-xml spawn failed: {e}")))?;
    if out.status.success() {
        return Ok(String::from_utf8_lossy(&out.stdout).trim().to_string());
    }
    let stderr = String::from_utf8_lossy(&out.stderr);
    Err(LibvirtError::Operation(format!(
        "virt-xml failed: {stderr}"
    )))
}

pub fn virt_xml_convert_spice_to_vnc(
    libvirt_uri: &str,
    vm_name: &str,
) -> Result<String, LibvirtError> {
    run_virt_xml(libvirt_uri, vm_name, &["--convert-to-vnc"])
}

pub fn virt_xml_add_graphics(
    libvirt_uri: &str,
    vm_name: &str,
    graphics_type: &str,
    listen: &str,
) -> Result<String, LibvirtError> {
    let graphics_type = graphics_type.trim().to_ascii_lowercase();
    crate::validate::validate_graphics_kind(&graphics_type)?;
    crate::validate::validate_graphics_listen(listen)?;
    let spec = format!("type={graphics_type},listen={listen},autoport=yes,port=-1");
    run_virt_xml(
        libvirt_uri,
        vm_name,
        &["--add-device", "--graphics", &spec],
    )
}

pub fn virt_xml_remove_graphics(
    libvirt_uri: &str,
    vm_name: &str,
    graphics_type: &str,
) -> Result<String, LibvirtError> {
    let graphics_type = graphics_type.trim().to_ascii_lowercase();
    crate::validate::validate_graphics_kind(&graphics_type)?;
    let spec = format!("type={graphics_type}");
    run_virt_xml(
        libvirt_uri,
        vm_name,
        &["--remove-device", "--graphics", &spec],
    )
}
