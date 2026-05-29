// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use std::process::Command;

pub fn provision_storage_pool(pool_name: &str, backend: &str, path: &str) -> anyhow::Result<()> {
    std::fs::create_dir_all(path)?;
    let output = match backend {
        "lvm" | "lvm-thin" => Command::new("virsh")
            .args(["pool-define-as", pool_name, "logical", "--target", path])
            .output()?,
        "nfs" => Command::new("virsh")
            .args(["pool-define-as", pool_name, "netfs", "--source-path", path])
            .output()?,
        _ => Command::new("virsh")
            .args(["pool-define-as", pool_name, "dir", "--target", path])
            .output()?,
    };
    if !output.status.success() {
        anyhow::bail!(
            "virsh pool-define-as failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }
    for sub in ["pool-build", "pool-start"] {
        let out = Command::new("virsh").args([sub, pool_name]).output()?;
        if !out.status.success() {
            anyhow::bail!(
                "virsh {sub} failed: {}",
                String::from_utf8_lossy(&out.stderr)
            );
        }
    }
    Ok(())
}

pub fn provision_network(
    network_name: &str,
    _backend: &str,
    vlan_id: i32,
    bridge: &str,
) -> anyhow::Result<()> {
    let bridge_name = if bridge.is_empty() { "virbr0" } else { bridge };
    let xml = if vlan_id > 0 {
        format!(
            "<network><name>{network_name}</name><bridge name='{bridge_name}'/><vlan><tag id='{vlan_id}'/></vlan></network>"
        )
    } else {
        format!(
            "<network><name>{network_name}</name><forward mode='bridge'/><bridge name='{bridge_name}'/></network>"
        )
    };
    let tmp = std::env::temp_dir().join(format!("machina-net-{network_name}.xml"));
    std::fs::write(&tmp, xml)?;
    let define = Command::new("virsh")
        .args(["net-define", tmp.to_string_lossy().as_ref()])
        .output()?;
    let _ = std::fs::remove_file(&tmp);
    if !define.status.success() {
        anyhow::bail!(
            "virsh net-define failed: {}",
            String::from_utf8_lossy(&define.stderr)
        );
    }
    for sub in ["net-start", "net-autostart"] {
        let out = Command::new("virsh").args([sub, network_name]).output()?;
        if !out.status.success() {
            anyhow::bail!(
                "virsh {sub} failed: {}",
                String::from_utf8_lossy(&out.stderr)
            );
        }
    }
    Ok(())
}
