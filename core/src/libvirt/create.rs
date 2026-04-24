use std::path::Path;
use std::process::Command;

use virt::connect::Connect;
use virt::domain::Domain;

use crate::config::{LibvirtConfig, VmCreateBackend};
use crate::state::CreateVmRequest;
use crate::LibvirtError;

use super::subprocess::{self, VmCreateLogSink};

/// [`CreateVmRequest::mkosi_workspace`] set means a Bootable=yes style image (EFI/GPT); BIOS would hang at SeaBIOS.
fn ensure_uefi_for_mkosi_workspace(req: &mut CreateVmRequest) {
    if req.mkosi_workspace.trim().is_empty() {
        return;
    }
    let fw = req.firmware.trim();
    if fw.is_empty() || fw.eq_ignore_ascii_case("bios") {
        tracing::info!(
            "mkosi_workspace set: using firmware=uefi (mkosi bootable disks use systemd-boot/EFI, not legacy BIOS)"
        );
        req.firmware = "uefi".into();
    }
}

fn is_fedora_mkosi_path(ws: &str) -> bool {
    let lower = ws.to_ascii_lowercase();
    Path::new(ws)
        .file_name()
        .and_then(|s| s.to_str())
        .map(|b| b.to_ascii_lowercase().starts_with("fedora"))
        .unwrap_or(false)
        || lower.contains("/fedora")
}

fn fedora_os_variant_from_mkosi_path(ws: &str) -> Option<String> {
    let base = Path::new(ws).file_name()?.to_str()?.to_ascii_lowercase();
    if base.starts_with("fedora") {
        return Some(base.chars().take(32).collect());
    }
    let lower = ws.to_ascii_lowercase();
    let i = lower.rfind("fedora")?;
    let tail: String = lower[i..]
        .chars()
        .take_while(|c| c.is_ascii_alphanumeric())
        .collect();
    if tail.len() >= 6 {
        Some(tail)
    } else {
        None
    }
}

/// Fedora Bootable=yes images are happier with 2 vCPU / 2 GiB+; match UI defaults when the request still has serde defaults.
fn apply_fedora_mkosi_resource_defaults(req: &mut CreateVmRequest) {
    let ws = req.mkosi_workspace.trim();
    if ws.is_empty() || !is_fedora_mkosi_path(ws) {
        return;
    }
    if req.vcpus == 1 && req.memory_mb == 1024 {
        tracing::info!(
            "mkosi Fedora workspace: applying 2 vCPUs / 2048 MiB RAM / min 20 GiB disk hint (was API defaults 1/1024/10)"
        );
        req.vcpus = 2;
        req.memory_mb = 2048;
        if req.disk_gb < 20 {
            req.disk_gb = 20;
        }
    }
    let ov = req.os_variant.trim();
    if ov.is_empty() || ov.eq_ignore_ascii_case("generic") {
        if let Some(v) = fedora_os_variant_from_mkosi_path(ws) {
            req.os_variant = v;
        }
    }
}

/// Define a new VM using either native libvirt XML or external `virt-install` (see `[libvirt] create_backend`; default is usually `virt_install`).
pub fn create_vm(
    conn: &Connect,
    req: &CreateVmRequest,
    backend: VmCreateBackend,
    libvirt_uri: &str,
    libvirt_cfg: &LibvirtConfig,
    log: Option<&VmCreateLogSink>,
) -> Result<(), LibvirtError> {
    crate::validate::validate_name(&req.name)?;
    let mut req = req.clone();
    super::template_apply::apply_saved_template(conn, &mut req)?;

    // Auto-detect mkosi workspace when the user provided no boot source at all.
    // This avoids creating a blank disk that can never boot.
    let has_boot_source = !req.existing_disk.trim().is_empty()
        || !req.iso.trim().is_empty()
        || !req.virt_builder_os.trim().is_empty()
        || !req.mkosi_workspace.trim().is_empty()
        || !req.virt_install_location.trim().is_empty()
        || req.virt_install_pxe
        || !req.virt_install_install_os.trim().is_empty()
        || !req.virt_install_disk_backing_store.trim().is_empty();
    if !has_boot_source && libvirt_cfg.mkosi_allowed && !req.virt_install_define_only {
        if let Some(ws) = super::mkosi::auto_detect_workspace(&req.name) {
            tracing::info!(
                "Auto-detected mkosi workspace '{}' for VM '{}'",
                ws,
                req.name
            );
            req.mkosi_workspace = ws;
        }
    }

    // Bootable=yes mkosi recipes ship GPT + systemd-boot; SeaBIOS cannot boot them.
    ensure_uefi_for_mkosi_workspace(&mut req);
    apply_fedora_mkosi_resource_defaults(&mut req);

    subprocess::log_line(
        log,
        "virtspawn",
        "Preparing disk image (mkosi / virt-builder / blank)…",
    );
    super::mkosi::materialize_mkosi_if_requested(conn, &mut req, libvirt_cfg, log)?;
    super::virt_builder::materialize_virt_builder_if_requested(conn, &mut req, libvirt_cfg, log)?;
    let r = match backend {
        VmCreateBackend::VirtInstall => {
            subprocess::log_line(log, "virtspawn", "Defining VM with virt-install…");
            super::virt_install::create_vm_virt_install(conn, &req, libvirt_uri, log)
        }
        VmCreateBackend::LibvirtXml => {
            if super::virt_install::create_request_uses_virt_install_extensions(&req) {
                return Err(LibvirtError::Invalid(
                    "This request uses virt-install-only fields (virt_install_define_only, virt_install_location, virt_install_pxe, root_disk_storage_pool/volume, virt_install_disk_backing_store). Set create_backend to \"virt_install\" or omit it when the server default is virt_install."
                        .into(),
                ));
            }
            subprocess::log_line(log, "virtspawn", "Defining VM with libvirt XML…");
            create_vm_libvirt_xml(conn, &req, log)
        }
    };
    if r.is_ok() {
        if let Ok(missing) = super::domain::missing_file_disk_paths(conn, &req.name) {
            if !missing.is_empty() {
                subprocess::log_line(
                    log,
                    "virtspawn",
                    &format!(
                        "WARNING: VM '{}' is defined but file-backed disk(s) are missing on the host — start will fail until you create them or fix paths in the domain XML: {}",
                        req.name,
                        missing.join(", ")
                    ),
                );
            }
        }
    }
    r
}

fn create_vm_libvirt_xml(
    conn: &Connect,
    req: &CreateVmRequest,
    log: Option<&VmCreateLogSink>,
) -> Result<(), LibvirtError> {
    crate::validate::validate_vcpus(req.vcpus)?;
    crate::validate::validate_memory_mb(req.memory_mb)?;

    let firmware = if req.firmware.is_empty() { "bios" } else { &req.firmware };
    if firmware != "bios" && firmware != "uefi" {
        return Err(LibvirtError::Invalid("Firmware must be 'bios' or 'uefi'".to_string()));
    }

    let gl = req.graphics_listen.trim();
    let gl = if gl.is_empty() { "127.0.0.1" } else { gl };
    crate::validate::validate_graphics_listen(gl)?;

    let gt = req.graphics_type.trim();
    let gt = if gt.is_empty() { "vnc" } else { gt };
    crate::validate::validate_graphics_type(gt)?;

    if firmware == "uefi" {
        if find_ovmf_code().is_none() {
            return Err(LibvirtError::Operation(
                "UEFI firmware (OVMF) not found. Install edk2-ovmf (Fedora/RHEL) or ovmf (Debian/Ubuntu).".to_string()
            ));
        }
    }

    let resolved_iso: Option<std::path::PathBuf> = if !req.iso.is_empty() {
        let iso_path = std::path::Path::new(&req.iso);
        if !iso_path.is_absolute() {
            return Err(LibvirtError::Invalid("ISO path must be absolute".to_string()));
        }
        let iso_path = iso_path.canonicalize()
            .map_err(|e| LibvirtError::Invalid(format!("Cannot resolve ISO path: {e}")))?;
        if !iso_path.is_file() {
            return Err(LibvirtError::Operation(format!("ISO file not found or is not a file: {}", iso_path.display())));
        }
        Some(iso_path)
    } else {
        None
    };

    let resolved_cloud_init: Option<std::path::PathBuf> = if !req.cloud_init_iso.is_empty() {
        let p = std::path::Path::new(&req.cloud_init_iso);
        if !p.is_absolute() {
            return Err(LibvirtError::Invalid(
                "cloud_init_iso path must be absolute".to_string(),
            ));
        }
        let p = p
            .canonicalize()
            .map_err(|e| LibvirtError::Invalid(format!("Cannot resolve cloud_init_iso path: {e}")))?;
        if !p.is_file() {
            return Err(LibvirtError::Operation(format!(
                "cloud_init_iso not found or not a file: {}",
                p.display()
            )));
        }
        Some(p)
    } else {
        None
    };

    let disk_path = if !req.existing_disk.is_empty() {
        let disk = std::path::Path::new(&req.existing_disk);
        if !disk.is_absolute() {
            return Err(LibvirtError::Invalid("Existing disk path must be absolute".to_string()));
        }
        if !disk.is_file() {
            return Err(LibvirtError::Operation(format!("Disk image not found: {}", req.existing_disk)));
        }
        req.existing_disk.clone()
    } else {
        crate::validate::validate_disk_gb(req.disk_gb)?;
        let path = find_disk_path(conn, &req.name)?;
        create_qcow2_disk(&path, req.disk_gb, log)?;
        path
    };

    let disk_driver = if disk_path.ends_with(".raw") || disk_path.ends_with(".img") {
        "raw"
    } else {
        "qcow2"
    };

    let iso_str = resolved_iso.as_ref().map(|p| p.display().to_string()).unwrap_or_default();
    let cloud_str = resolved_cloud_init
        .as_ref()
        .map(|p| p.display().to_string())
        .unwrap_or_default();
    let xml = generate_domain_xml(req, &disk_path, disk_driver, firmware, &iso_str, &cloud_str, gl, gt);

    Domain::define_xml(conn, &xml)
        .map_err(|e| LibvirtError::Operation(format!("Failed to define VM '{}': {e}", req.name)))?;

    Ok(())
}

pub(crate) fn find_disk_path(conn: &Connect, vm_name: &str) -> Result<String, LibvirtError> {
    if let Some(base) = super::storage::primary_vm_disk_base_dir(conn) {
        return Ok(format!("{}/{}.qcow2", base.trim_end_matches('/'), vm_name));
    }
    Ok(format!("/var/lib/libvirt/images/{}.qcow2", vm_name))
}

fn create_qcow2_disk(
    path: &str,
    size_gb: u64,
    log: Option<&VmCreateLogSink>,
) -> Result<(), LibvirtError> {
    if Path::new(path).exists() {
        return Err(LibvirtError::Operation(format!(
            "Disk image already exists: {path}"
        )));
    }

    let summary = format!("$ qemu-img create -f qcow2 {path} {size_gb}G");
    let mut cmd = Command::new("qemu-img");
    cmd.args(["create", "-f", "qcow2", path, &format!("{size_gb}G")]);
    let output = subprocess::run_command_streaming(cmd, &summary, "qemu-img", log)?;

    if !output.status.success() {
        return Err(LibvirtError::Operation(format!(
            "qemu-img failed (exit {}); see streamed log",
            output.status
        )));
    }

    Ok(())
}

fn find_qemu_binary() -> String {
    let candidates = [
        "/usr/bin/qemu-system-x86_64",
        "/usr/libexec/qemu-kvm",
        "/usr/bin/qemu-kvm",
    ];
    for path in &candidates {
        if Path::new(path).is_file() {
            return path.to_string();
        }
    }
    // PATH fallback — mirrors hyper2kvm's shutil.which behaviour
    for name in &["qemu-system-x86_64", "qemu-kvm"] {
        if let Ok(out) = Command::new("which").arg(name).output() {
            if out.status.success() {
                let p = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !p.is_empty() {
                    return p;
                }
            }
        }
    }
    "/usr/bin/qemu-system-x86_64".to_string()
}

pub(crate) fn find_ovmf_code() -> Option<String> {
    let candidates = [
        "/usr/share/edk2/ovmf/OVMF_CODE.fd",
        "/usr/share/edk2/ovmf/x64/OVMF_CODE.fd",
        "/usr/share/OVMF/OVMF_CODE.fd",
        "/usr/share/edk2/x64/OVMF_CODE.fd",
        "/usr/share/qemu/OVMF_CODE.fd",
        "/usr/share/edk2/ovmf/OVMF_CODE.secboot.fd",
        "/usr/share/edk2/ovmf/x64/OVMF_CODE.secboot.fd",
        "/usr/share/OVMF/OVMF_CODE_4M.fd",
    ];
    for path in &candidates {
        if Path::new(path).is_file() {
            return Some(path.to_string());
        }
    }
    None
}

pub(crate) fn find_ovmf_vars_template() -> Option<String> {
    let candidates = [
        "/usr/share/edk2/ovmf/OVMF_VARS.fd",
        "/usr/share/OVMF/OVMF_VARS.fd",
        "/usr/share/edk2/ovmf/x64/OVMF_VARS.fd",
        "/usr/share/qemu/OVMF_VARS.fd",
        "/usr/share/edk2/ovmf/OVMF_VARS.secboot.fd",
        "/usr/share/edk2/ovmf/x64/OVMF_VARS.secboot.fd",
        "/usr/share/OVMF/OVMF_VARS_4M.fd",
    ];
    for path in &candidates {
        if Path::new(path).is_file() {
            return Some(path.to_string());
        }
    }
    None
}

/// Detect SPICE availability by probing for libspice-server.so in common lib dirs.
pub(crate) fn has_spice() -> bool {
    let lib_dirs = ["/usr/lib64", "/usr/lib/x86_64-linux-gnu", "/usr/lib"];
    for dir in &lib_dirs {
        let dir_path = Path::new(dir);
        if dir_path.is_dir() {
            if let Ok(entries) = std::fs::read_dir(dir_path) {
                for entry in entries.flatten() {
                    let name = entry.file_name();
                    if name.to_string_lossy().starts_with("libspice-server.so") {
                        return true;
                    }
                }
            }
        }
    }
    false
}

fn generate_domain_xml(
    req: &CreateVmRequest,
    disk_path: &str,
    disk_driver: &str,
    firmware: &str,
    iso_path: &str,
    cloud_init_iso_path: &str,
    graphics_listen: &str,
    graphics_type: &str,
) -> String {
    let memory_kib = req.memory_mb * 1024;
    let name = crate::xml::escape(&req.name);
    let network = crate::xml::escape(&req.network);
    let disk_path_esc = crate::xml::escape(disk_path);
    let disk_driver_esc = crate::xml::escape(disk_driver);
    let graphics_listen_esc = crate::xml::escape(graphics_listen);

    // Resolve graphics type: if caller said "spice" but SPICE is unavailable, fall back to VNC.
    let gtype = if graphics_type.eq_ignore_ascii_case("spice") && has_spice() {
        "spice"
    } else if graphics_type.eq_ignore_ascii_case("spice") {
        "vnc"
    } else {
        "vnc"
    };
    let video_model = if gtype == "spice" { "qxl" } else { "virtio" };

    // BIOS: boot device in OS block.  UEFI: boot order on devices instead.
    let is_uefi = firmware == "uefi";
    let bios_boot_dev = if !iso_path.is_empty() { "cdrom" } else { "hd" };

    let os_xml = if is_uefi {
        let ovmf_code = find_ovmf_code()
            .unwrap_or_else(|| "/usr/share/edk2/ovmf/OVMF_CODE.fd".to_string());
        let vars_template = find_ovmf_vars_template();
        let nvram_template_attr = match &vars_template {
            Some(t) => format!(" template='{}'", crate::xml::escape(t)),
            None => String::new(),
        };
        format!(
            r#"<os>
    <type arch='x86_64' machine='q35'>hvm</type>
    <loader readonly='yes' type='pflash'>{ovmf_code}</loader>
    <nvram{nvram_template_attr}>/var/lib/libvirt/qemu/nvram/{name}_VARS.fd</nvram>
  </os>"#,
            ovmf_code = crate::xml::escape(&ovmf_code),
            nvram_template_attr = nvram_template_attr,
            name = name,
        )
    } else {
        format!(
            r#"<os>
    <type arch='x86_64' machine='q35'>hvm</type>
    <boot dev='{bios_boot_dev}'/>
  </os>"#,
            bios_boot_dev = bios_boot_dev,
        )
    };

    // For UEFI: use per-device boot order so firmware can find the disk/cdrom.
    let disk_boot_order = if is_uefi { "\n      <boot order='1'/>" } else { "" };

    let cdrom_xml = if !iso_path.is_empty() {
        let cdrom_boot = if is_uefi { "\n      <boot order='2'/>" } else { "" };
        format!(
            r#"
    <disk type='file' device='cdrom'>
      <driver name='qemu' type='raw'/>
      <source file='{}'/>
      <target dev='sda' bus='sata'/>{cdrom_boot}
      <readonly/>
    </disk>"#,
            crate::xml::escape(iso_path),
            cdrom_boot = cdrom_boot,
        )
    } else {
        String::new()
    };

    let cloud_init_cdrom_xml = if !cloud_init_iso_path.is_empty() {
        format!(
            r#"
    <disk type='file' device='cdrom'>
      <driver name='qemu' type='raw' cache='none'/>
      <source file='{}'/>
      <target dev='sdc' bus='sata'/>
      <readonly/>
    </disk>"#,
            crate::xml::escape(cloud_init_iso_path)
        )
    } else {
        String::new()
    };

    let emulator = find_qemu_binary();
    format!(
        r#"<domain type='kvm'>
  <name>{name}</name>
  <memory unit='KiB'>{memory_kib}</memory>
  <currentMemory unit='KiB'>{memory_kib}</currentMemory>
  <vcpu placement='static'>{vcpus}</vcpu>
  {os_xml}
  <features>
    <acpi/>
    <apic/>
    <vmport state='off'/>
  </features>
  <cpu mode='host-passthrough' check='none'/>
  <clock offset='utc'>
    <timer name='rtc' tickpolicy='catchup'/>
    <timer name='pit' tickpolicy='delay'/>
    <timer name='hpet' present='no'/>
  </clock>
  <on_poweroff>destroy</on_poweroff>
  <on_reboot>restart</on_reboot>
  <on_crash>restart</on_crash>
  <devices>
    <emulator>{emulator}</emulator>
    <disk type='file' device='disk'>
      <driver name='qemu' type='{disk_driver}'/>
      <source file='{disk_path}'/>
      <target dev='vda' bus='virtio'/>{disk_boot_order}
    </disk>{cdrom_xml}{cloud_init_cdrom_xml}
    <interface type='network'>
      <source network='{network}'/>
      <model type='virtio'/>
    </interface>
    <serial type='pty'>
      <target port='0'/>
    </serial>
    <console type='pty'>
      <target type='serial' port='0'/>
    </console>
    <channel type='unix'>
      <target type='virtio' name='org.qemu.guest_agent.0'/>
    </channel>
    <!-- VNC: noVNC + /ws/v1/vnc/{{name}}. SPICE: spice-html5 + /ws/v1/spice/{{name}}. -->
    <graphics type='{gtype}' port='-1' autoport='yes' listen='{graphics_listen}'/>
    <video>
      <model type='{video_model}' heads='1'/>
    </video>
    <controller type='usb' index='0' model='qemu-xhci'/>
    <input type='tablet' bus='usb'/>
    <memballoon model='virtio'/>
    <rng model='virtio'>
      <backend model='random'>/dev/urandom</backend>
    </rng>
  </devices>
</domain>"#,
        name = name,
        memory_kib = memory_kib,
        vcpus = req.vcpus,
        os_xml = os_xml,
        disk_driver = disk_driver_esc,
        disk_path = disk_path_esc,
        disk_boot_order = disk_boot_order,
        cdrom_xml = cdrom_xml,
        cloud_init_cdrom_xml = cloud_init_cdrom_xml,
        network = network,
        graphics_listen = graphics_listen_esc,
        gtype = gtype,
        video_model = video_model,
    )
}
