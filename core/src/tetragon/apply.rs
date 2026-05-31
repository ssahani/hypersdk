// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::Value;

use super::types::{SecurityBundleApplyResult, SecurityFabricStatus};
use crate::LibvirtError;

fn policy_dir() -> PathBuf {
    std::env::var("MACHINA_TETRAGON_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/var/lib/machina/tetragon"))
}

fn policies_subdir() -> PathBuf {
    policy_dir().join("tracing-policies")
}

fn tetragon_in_path() -> bool {
    Command::new("which")
        .arg("tetragon")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn write_file(path: &Path, contents: &str, dry_run: bool) -> Result<(), LibvirtError> {
    if dry_run {
        return Ok(());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(LibvirtError::map_op("create tetragon dir"))?;
    }
    fs::write(path, contents).map_err(LibvirtError::map_op("write tetragon file"))
}

pub fn apply_security_bundle(bundle_json: &str, dry_run: bool) -> Result<SecurityBundleApplyResult, LibvirtError> {
    let bundle: Value =
        serde_json::from_str(bundle_json).map_err(|e| LibvirtError::Invalid(format!("bundle JSON: {e}")))?;
    let dir = policies_subdir();
    let mut operations = Vec::new();
    let mut policies_written = 0usize;

    let policies = bundle
        .get("tracing_policies")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    if !dry_run {
        let _ = fs::create_dir_all(&dir);
    }

    for (i, pol) in policies.iter().enumerate() {
        let name = pol
            .pointer("/metadata/name")
            .and_then(|v| v.as_str())
            .map(String::from)
            .unwrap_or_else(|| format!("policy-{i}"));
        let path = dir.join(format!("{name}.json"));
        let body = serde_json::to_string_pretty(pol)
            .map_err(|e| LibvirtError::Internal(format!("serialize policy: {e}")))?;
        write_file(&path, &body, dry_run)?;
        operations.push(format!("write {}", path.display()));
        policies_written += 1;
    }

    let mut install_script_written = false;
    if let Some(install) = bundle.get("tetragon_install") {
        if !install.is_null() {
            let export = install
                .get("export_url")
                .and_then(|v| v.as_str())
                .unwrap_or("http://127.0.0.1:9091/api/v1/ingest");
            let script = format!(
                "#!/bin/sh\n# Machina Zeus Tetragon install stub — replace with package/Helm in production\nset -eu\nEXPORT_URL=\"{export}\"\nHOST_ID=\"${{MACHINA_HOST_ID:-unknown}}\"\nif command -v tetragon >/dev/null 2>&1; then\n  echo \"tetragon already installed\"\n  exit 0\nfi\necho \"Install Tetragon and point export to $EXPORT_URL/$HOST_ID\"\n"
            );
            let script_path = policy_dir().join("install-tetragon.sh");
            write_file(&script_path, &script, dry_run)?;
            if !dry_run {
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    if let Ok(meta) = fs::metadata(&script_path) {
                        let mut perms = meta.permissions();
                        perms.set_mode(0o755);
                        let _ = fs::set_permissions(&script_path, perms);
                    }
                }
            }
            operations.push(format!("write {}", script_path.display()));
            install_script_written = true;
        }
    }

    let manifest_path = policy_dir().join("bundle-manifest.json");
    write_file(&manifest_path, bundle_json, dry_run)?;
    operations.push(format!("write {}", manifest_path.display()));

    Ok(SecurityBundleApplyResult {
        ok: true,
        policy_dir: dir.display().to_string(),
        policies_written,
        install_script_written,
        tetragon_binary_found: tetragon_in_path(),
        operations,
        message: if dry_run {
            "Dry run — no files written".into()
        } else {
            format!("Applied {policies_written} TracingPolicy file(s)")
        },
    })
}

pub fn security_fabric_status() -> Result<SecurityFabricStatus, LibvirtError> {
    let dir = policies_subdir();
    let mut policy_files = Vec::new();
    if dir.is_dir() {
        for entry in fs::read_dir(&dir).map_err(LibvirtError::map_op("read tetragon policies"))? {
            let entry = entry.map_err(LibvirtError::map_op("read policy entry"))?;
            if entry.path().extension().and_then(|s| s.to_str()) == Some("json") {
                policy_files.push(entry.file_name().to_string_lossy().into_owned());
            }
        }
    }
    policy_files.sort();
    let install_script = policy_dir().join("install-tetragon.sh");
    let export_url = fs::read_to_string(policy_dir().join("bundle-manifest.json"))
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .and_then(|v| {
            v.pointer("/tetragon_install/export_url")
                .and_then(|u| u.as_str())
                .map(String::from)
        });
    Ok(SecurityFabricStatus {
        policy_dir: dir.display().to_string(),
        policy_files,
        install_script_present: install_script.is_file(),
        tetragon_binary_found: tetragon_in_path(),
        export_url,
    })
}
