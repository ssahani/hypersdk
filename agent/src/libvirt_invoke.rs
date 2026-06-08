// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

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
        other => Err(LibvirtError::Invalid(format!("unknown vm invoke action: {other}"))),
    }
}

pub fn host_query(
    conn: &Connect,
    action: &str,
    _payload: &Value,
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
        other => Err(LibvirtError::Invalid(format!("unknown host query action: {other}"))),
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
