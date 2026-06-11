// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use std::process::Command;

use machina_core::libvirt::{
    block_jobs, boot, device_tune, domain, extras, firmware, hostdev_pci, resize,
};
use machina_core::LibvirtError;
use serde_json::Value;
use virt::connect::Connect;

pub fn vm_query(
    conn: &Connect,
    vm_name: &str,
    action: &str,
    payload: &Value,
) -> Result<Value, LibvirtError> {
    match action {
        "block.job" => {
            let disk = payload_str(payload, "disk")?;
            let bandwidth_bytes = payload_bool(payload, "bandwidth_bytes");
            let flags = block_jobs::block_job_info_flags(bandwidth_bytes);
            let job = block_jobs::block_job_info(conn, vm_name, &disk, flags)?;
            Ok(serde_json::to_value(job).unwrap_or(Value::Null))
        }
        "cputune.get" => {
            let info = resize::get_cputune(conn, vm_name)?;
            Ok(serde_json::to_value(info).unwrap_or(Value::Null))
        }
        "memtune.get" => {
            let info = resize::get_memtune(conn, vm_name)?;
            Ok(serde_json::to_value(info).unwrap_or(Value::Null))
        }
        "boot.get" => {
            let info = boot::get_boot_config(conn, vm_name)?;
            Ok(serde_json::to_value(info).unwrap_or(Value::Null))
        }
        "pending.config" => {
            let info = machina_core::libvirt::pending_config::get_pending_config(conn, vm_name)?;
            Ok(serde_json::to_value(info).unwrap_or(Value::Null))
        }
        "parity.summary" => {
            let pending =
                machina_core::libvirt::pending_config::get_pending_config(conn, vm_name)?;
            let d = domain::lookup_domain(conn, vm_name)?;
            let xml = d
                .get_xml_desc(0)
                .map_err(LibvirtError::map_op("Failed to get domain XML"))?;
            let lower = xml.to_ascii_lowercase();
            let spice = lower.contains("type='spice'") || lower.contains("type=\"spice\"");
            Ok(serde_json::json!({
                "needs_shutdown": pending.needs_shutdown,
                "spice": spice,
                "state": pending.state,
            }))
        }
        "cpu.memory.topology" => {
            let info = machina_core::libvirt::cpu_memory::get_cpu_memory_topology(conn, vm_name)?;
            Ok(serde_json::to_value(info).unwrap_or(Value::Null))
        }
        "snapshot.precheck" => {
            let req: machina_core::state::CreateSnapshotRequest =
                serde_json::from_value(payload.clone()).map_err(|e| {
                    LibvirtError::Invalid(format!("snapshot.precheck payload: {e}"))
                })?;
            let pre = machina_core::libvirt::cpu_memory::snapshot_precheck(conn, vm_name, &req)?;
            Ok(serde_json::to_value(pre).unwrap_or(Value::Null))
        }
        "snapshot.action.precheck" => {
            let snap_name = payload_str(payload, "snapshot")?;
            let action = payload_str(payload, "action")?;
            let pre = machina_core::libvirt::snapshot::snapshot_action_precheck(
                conn, vm_name, &snap_name, &action,
            )?;
            Ok(serde_json::to_value(pre).unwrap_or(Value::Null))
        }
        "qemu.logs" => {
            let lines = payload
                .get("lines")
                .and_then(|v| v.as_u64())
                .unwrap_or(500)
                .min(5000) as usize;
            let (log_path, content) = domain::read_qemu_log(vm_name, lines)?;
            Ok(serde_json::json!({
                "vm_name": vm_name,
                "log_path": log_path,
                "content": content,
            }))
        }
        other => Err(LibvirtError::Invalid(format!("unknown vm query action: {other}"))),
    }
}

pub fn vm_invoke(
    conn: &Connect,
    vm_name: &str,
    action: &str,
    payload: &Value,
) -> Result<Value, LibvirtError> {
    match action {
        "block.commit" => {
            let disk = payload_str(payload, "disk")?;
            let base = payload.get("base").and_then(|v| v.as_str());
            let top = payload.get("top").and_then(|v| v.as_str());
            let bandwidth = payload_u64(payload, "bandwidth");
            let flags = block_jobs::block_commit_flags(
                payload_bool(payload, "shallow"),
                payload_bool(payload, "delete"),
                payload_bool(payload, "active"),
                payload_bool(payload, "relative"),
                payload_bool(payload, "bandwidth_bytes"),
            );
            block_jobs::block_commit(conn, vm_name, &disk, base, top, bandwidth, flags)?;
            Ok(serde_json::json!({ "status": "block_commit_started" }))
        }
        "block.pull" => {
            let disk = payload_str(payload, "disk")?;
            let bandwidth = payload_u64(payload, "bandwidth");
            let flags = block_jobs::block_pull_flags(payload_bool(payload, "bandwidth_bytes"));
            block_jobs::block_pull(conn, vm_name, &disk, bandwidth, flags)?;
            Ok(serde_json::json!({ "status": "block_pull_started" }))
        }
        "block.job.abort" => {
            let disk = payload_str(payload, "disk")?;
            let flags = block_jobs::block_job_abort_flags(
                payload_bool(payload, "async"),
                payload_bool(payload, "pivot"),
            );
            block_jobs::block_job_abort(conn, vm_name, &disk, flags)?;
            Ok(serde_json::json!({ "status": "block_job_abort" }))
        }
        "disk.tune" => {
            let tune: device_tune::DiskTuneRequest = serde_json::from_value(payload.clone())
                .map_err(|e| LibvirtError::Invalid(format!("disk.tune payload: {e}")))?;
            device_tune::update_disk_tune(conn, vm_name, &tune)?;
            Ok(serde_json::json!({ "status": "ok" }))
        }
        "nic.tune" => {
            let tune: device_tune::NicTuneRequest = serde_json::from_value(payload.clone())
                .map_err(|e| LibvirtError::Invalid(format!("nic.tune payload: {e}")))?;
            device_tune::update_nic_tune(conn, vm_name, &tune)?;
            Ok(serde_json::json!({ "status": "ok" }))
        }
        "memtune.set" => {
            let tune: resize::MemTuneInfo = serde_json::from_value(payload.clone())
                .map_err(|e| LibvirtError::Invalid(format!("memtune.set payload: {e}")))?;
            resize::set_memtune_kb(conn, vm_name, &tune)?;
            Ok(serde_json::json!({ "status": "memtune_updated" }))
        }
        "scheduler.set" => {
            let cpu_shares = payload.get("cpu_shares").and_then(|v| v.as_u64());
            let vcpu_period = payload.get("vcpu_period").and_then(|v| v.as_u64());
            let vcpu_quota = payload.get("vcpu_quota").and_then(|v| v.as_i64());
            resize::set_cpu_scheduler_partial(conn, vm_name, cpu_shares, vcpu_period, vcpu_quota)?;
            Ok(serde_json::json!({ "status": "scheduler_updated" }))
        }
        "vcpu.pin" => {
            let vcpu = payload_u32(payload, "vcpu")?;
            let cpus: Vec<bool> = payload
                .get("cpus")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .ok_or_else(|| LibvirtError::Invalid("vcpu.pin requires cpus array".into()))?;
            resize::pin_vcpu(conn, vm_name, vcpu, &cpus)?;
            Ok(serde_json::json!({ "status": "vcpu_pinned", "vcpu": vcpu }))
        }
        "live.vcpus" => {
            let count = payload_u32(payload, "count")?;
            extras::live_set_vcpus(conn, vm_name, count)?;
            Ok(serde_json::json!({ "status": "ok", "vcpus": count }))
        }
        "live.memory" => {
            let memory_mb = payload_u64(payload, "memory_mb");
            extras::live_set_memory(conn, vm_name, memory_mb)?;
            Ok(serde_json::json!({ "status": "ok", "memory_mb": memory_mb }))
        }
        "usb.attach" => {
            let vendor_id = payload_str(payload, "vendor_id")?;
            let product_id = payload_str(payload, "product_id")?;
            extras::attach_usb(conn, vm_name, &vendor_id, &product_id)?;
            Ok(serde_json::json!({ "status": "attached" }))
        }
        "usb.detach" => {
            let vendor_id = payload_str(payload, "vendor_id")?;
            let product_id = payload_str(payload, "product_id")?;
            extras::detach_usb(conn, vm_name, &vendor_id, &product_id)?;
            Ok(serde_json::json!({ "status": "detached" }))
        }
        "pci.attach" => {
            let pci = payload_str(payload, "pci")?;
            hostdev_pci::attach_pci_hostdev(conn, vm_name, &pci)?;
            Ok(serde_json::json!({ "status": "attached" }))
        }
        "pci.detach" => {
            let pci = payload_str(payload, "pci")?;
            hostdev_pci::detach_pci_hostdev(conn, vm_name, &pci)?;
            Ok(serde_json::json!({ "status": "detached" }))
        }
        "firmware.set" => {
            let uefi = payload
                .get("uefi")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            firmware::set_guest_firmware(conn, vm_name, uefi)?;
            Ok(serde_json::json!({ "status": "ok", "uefi": uefi }))
        }
        "tpm.attach" => {
            machina_core::libvirt::extra_devices::attach_tpm_emulator(conn, vm_name)?;
            Ok(serde_json::json!({ "status": "ok", "tpm": "attached" }))
        }
        "tpm.detach" => {
            machina_core::libvirt::extra_devices::detach_tpm(conn, vm_name)?;
            Ok(serde_json::json!({ "status": "ok", "tpm": "detached" }))
        }
        "vsock.attach" => {
            let cid = payload.get("cid").and_then(|v| v.as_u64()).map(|n| n as u32);
            machina_core::libvirt::extra_devices::attach_vsock(conn, vm_name, cid)?;
            Ok(serde_json::json!({ "status": "ok", "vsock": "attached" }))
        }
        "vsock.detach" => {
            machina_core::libvirt::extra_devices::detach_vsock(conn, vm_name)?;
            Ok(serde_json::json!({ "status": "ok", "vsock": "detached" }))
        }
        "virtiofs.add" => {
            let source_dir = payload_str(payload, "source_dir")?;
            let mount_tag = payload_str(payload, "mount_tag")?;
            let xattr = payload_bool(payload, "xattr");
            machina_core::libvirt::filesystem::add_virtiofs_share(
                conn, vm_name, &source_dir, &mount_tag, xattr,
            )?;
            Ok(serde_json::json!({ "status": "ok" }))
        }
        "virtiofs.remove" => {
            let mount_tag = payload_str(payload, "mount_tag")?;
            machina_core::libvirt::filesystem::remove_share(conn, vm_name, &mount_tag)?;
            Ok(serde_json::json!({ "status": "ok" }))
        }
        "watchdog.attach" => {
            let model = payload
                .get("model")
                .and_then(|v| v.as_str())
                .unwrap_or("i6300esb");
            let action = payload
                .get("action")
                .and_then(|v| v.as_str())
                .unwrap_or("reset");
            machina_core::libvirt::extra_devices::attach_watchdog(conn, vm_name, model, action)?;
            Ok(serde_json::json!({ "status": "ok" }))
        }
        "cdrom.insert" => {
            let iso_path = payload_str(payload, "iso_path")?;
            let target = payload
                .get("target")
                .and_then(|v| v.as_str())
                .unwrap_or("sda");
            machina_core::libvirt::cdrom::insert_cdrom(conn, vm_name, &iso_path, target)?;
            Ok(serde_json::json!({ "status": "ok" }))
        }
        "cdrom.eject" => {
            let target = payload
                .get("target")
                .and_then(|v| v.as_str())
                .unwrap_or("sda");
            machina_core::libvirt::cdrom::eject_cdrom(conn, vm_name, target)?;
            Ok(serde_json::json!({ "status": "ok" }))
        }
        "boot.set" => {
            let devices: Vec<String> = payload
                .get("devices")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .ok_or_else(|| LibvirtError::Invalid("boot.set requires devices array".into()))?;
            boot::set_boot_order(conn, vm_name, &devices)?;
            Ok(serde_json::json!({ "status": "ok" }))
        }
        "domain.xml.update" => {
            let xml = payload_str(payload, "xml")?;
            domain::replace_domain_xml(conn, vm_name, &xml)?;
            Ok(serde_json::json!({ "status": "ok" }))
        }
        "domain.rename" => {
            let new_name = payload_str(payload, "new_name")?;
            domain::rename_vm(conn, vm_name, &new_name)?;
            Ok(serde_json::json!({ "status": "ok", "new_name": new_name }))
        }
        "domain.nmi" => {
            domain::inject_nmi(conn, vm_name)?;
            Ok(serde_json::json!({ "status": "nmi_injected" }))
        }
        "graphics.spice_to_vnc" => {
            let uri = conn
                .get_uri()
                .map_err(|e| LibvirtError::Operation(format!("libvirt URI: {e}")))?;
            let msg = machina_core::libvirt::graphics_convert::virt_xml_convert_spice_to_vnc(
                &uri, vm_name,
            )?;
            Ok(serde_json::json!({ "status": "ok", "message": msg }))
        }
        "cpu.topology.set" => {
            let sockets = payload_u32(payload, "sockets")?;
            let cores = payload_u32(payload, "cores")?;
            let threads = payload_u32(payload, "threads")?;
            machina_core::libvirt::cpu_memory::set_cpu_topology(conn, vm_name, sockets, cores, threads)?;
            Ok(serde_json::json!({ "status": "ok", "sockets": sockets, "cores": cores, "threads": threads }))
        }
        other => Err(LibvirtError::Invalid(format!("unknown vm invoke action: {other}"))),
    }
}

pub fn host_query(
    conn: &Connect,
    action: &str,
    payload: &Value,
) -> Result<Value, LibvirtError> {
    match action {
        "browse.isos" => {
            let res = extras::list_iso_files(conn)?;
            Ok(serde_json::to_value(res).unwrap_or(Value::Null))
        }
        "host.usb" => {
            let devices = extras::list_usb_devices()?;
            Ok(serde_json::json!(devices))
        }
        "host.pci" => {
            let devices = extras::list_pci_devices()?;
            Ok(serde_json::json!(devices))
        }
        "osinfo.list" => {
            let join = Command::new("osinfo-query")
                .args(["os", "-f", "short-id,name,version"])
                .output()
                .map_err(|e| LibvirtError::Operation(format!("osinfo-query: {e}")))?;
            if !join.status.success() {
                return Ok(serde_json::json!({
                    "oses": [],
                    "hint": "Install libosinfo (osinfo-db) for a full OS list."
                }));
            }
            let text = String::from_utf8_lossy(&join.stdout);
            let mut rows = Vec::new();
            for line in text.lines().skip(1) {
                let cols: Vec<&str> = line.split('|').map(|c| c.trim()).collect();
                if cols.len() >= 3 {
                    rows.push(serde_json::json!({
                        "short_id": cols[0],
                        "name": cols[1],
                        "version": cols[2],
                    }));
                }
            }
            Ok(serde_json::json!({ "oses": rows }))
        }
        "osinfo.detect" => {
            let url = payload_str(payload, "url")?;
            let out = Command::new("osinfo-detect")
                .args(["--type=tree", &url])
                .output()
                .map_err(|e| LibvirtError::Operation(format!("osinfo-detect: {e}")))?;
            Ok(serde_json::json!({
                "exit_code": out.status.code(),
                "stdout": String::from_utf8_lossy(&out.stdout).trim(),
                "stderr": String::from_utf8_lossy(&out.stderr).trim(),
            }))
        }
        "storage.pools.list" => {
            let pools = machina_core::libvirt::storage::list_pools(conn)?;
            Ok(serde_json::to_value(pools).unwrap_or(Value::Null))
        }
        "storage.volumes.list" => {
            let pool = payload_str(payload, "pool")?;
            let vols = machina_core::libvirt::storage::list_volumes(conn, &pool)?;
            Ok(serde_json::to_value(vols).unwrap_or(Value::Null))
        }
        "networks.list" => {
            let nets = machina_core::libvirt::network::list_networks(conn)?;
            Ok(serde_json::to_value(nets).unwrap_or(Value::Null))
        }
        other => Err(LibvirtError::Invalid(format!("unknown host query action: {other}"))),
    }
}

pub fn host_invoke(
    conn: &Connect,
    action: &str,
    payload: &Value,
) -> Result<Value, LibvirtError> {
    use machina_core::libvirt::{network, storage};
    match action {
        "storage.pool.start" => {
            let name = payload_str(payload, "name")?;
            storage::start_pool(conn, &name)?;
            Ok(serde_json::json!({ "status": "started", "name": name }))
        }
        "storage.pool.stop" => {
            let name = payload_str(payload, "name")?;
            storage::stop_pool(conn, &name)?;
            Ok(serde_json::json!({ "status": "stopped", "name": name }))
        }
        "storage.pool.refresh" => {
            let name = payload_str(payload, "name")?;
            storage::refresh_pool(conn, &name)?;
            Ok(serde_json::json!({ "status": "refreshed", "name": name }))
        }
        "storage.pool.autostart" => {
            let name = payload_str(payload, "name")?;
            let enabled = payload_bool(payload, "enabled");
            storage::set_pool_autostart(conn, &name, enabled)?;
            Ok(serde_json::json!({
                "status": if enabled { "enabled" } else { "disabled" },
                "name": name,
            }))
        }
        "storage.pool.delete" => {
            let name = payload_str(payload, "name")?;
            storage::delete_pool(conn, &name)?;
            Ok(serde_json::json!({ "status": "deleted", "name": name }))
        }
        "storage.volume.create" => {
            let pool = payload_str(payload, "pool")?;
            let vol_name = payload_str(payload, "name")?;
            let capacity_gb = payload_u64(payload, "capacity_gb");
            let format = payload
                .get("format")
                .and_then(|v| v.as_str())
                .unwrap_or("qcow2");
            storage::create_volume(conn, &pool, &vol_name, capacity_gb.max(1), format)?;
            Ok(serde_json::json!({ "status": "created", "pool": pool, "name": vol_name }))
        }
        "storage.volume.delete" => {
            let pool = payload_str(payload, "pool")?;
            let vol_name = payload_str(payload, "name")?;
            storage::delete_volume(conn, &pool, &vol_name)?;
            Ok(serde_json::json!({ "status": "deleted", "pool": pool, "name": vol_name }))
        }
        "network.start" => {
            let name = payload_str(payload, "name")?;
            network::start_network(conn, &name)?;
            Ok(serde_json::json!({ "status": "started", "name": name }))
        }
        "network.stop" => {
            let name = payload_str(payload, "name")?;
            network::stop_network(conn, &name)?;
            Ok(serde_json::json!({ "status": "stopped", "name": name }))
        }
        "network.autostart" => {
            let name = payload_str(payload, "name")?;
            let enabled = payload_bool(payload, "enabled");
            network::set_network_autostart(conn, &name, enabled)?;
            Ok(serde_json::json!({
                "status": if enabled { "enabled" } else { "disabled" },
                "name": name,
            }))
        }
        "network.delete" => {
            let name = payload_str(payload, "name")?;
            network::delete_network(conn, &name)?;
            Ok(serde_json::json!({ "status": "deleted", "name": name }))
        }
        other => Err(LibvirtError::Invalid(format!("unknown host invoke action: {other}"))),
    }
}

fn payload_str(payload: &Value, key: &str) -> Result<String, LibvirtError> {
    payload
        .get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| LibvirtError::Invalid(format!("missing string field '{key}'")))
}

fn payload_u32(payload: &Value, key: &str) -> Result<u32, LibvirtError> {
    payload
        .get(key)
        .and_then(|v| v.as_u64())
        .and_then(|n| u32::try_from(n).ok())
        .ok_or_else(|| LibvirtError::Invalid(format!("missing u32 field '{key}'")))
}

fn payload_u64(payload: &Value, key: &str) -> u64 {
    payload.get(key).and_then(|v| v.as_u64()).unwrap_or(0)
}

fn payload_bool(payload: &Value, key: &str) -> bool {
    payload.get(key).and_then(|v| v.as_bool()).unwrap_or(false)
}
