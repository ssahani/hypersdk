// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use super::types::{TetragonInstallResult, TetragonInstallSpec};
use crate::LibvirtError;

fn policy_dir() -> PathBuf {
    std::env::var("MACHINA_TETRAGON_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/var/lib/machina/tetragon"))
}

fn tetragon_version() -> String {
    std::env::var("MACHINA_TETRAGON_VERSION").unwrap_or_else(|_| "1.7.0".into())
}

fn is_service_active(unit: &str) -> bool {
    Command::new("systemctl")
        .args(["is-active", "--quiet", unit])
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

pub fn render_install_script(spec: &TetragonInstallSpec) -> String {
    let root_dir = policy_dir();
    let root = root_dir.display().to_string();
    let version = tetragon_version();
    format!(
        r#"#!/bin/sh
# Machina Zeus — production Tetragon install (host sensor + PacketWolf export)
set -eu
INSTALL_ROOT="{root}"
POLICY_DIR="$INSTALL_ROOT/tracing-policies"
BIN="/usr/local/bin/tetragon"
EXPORT_URL="{export_url}"
HOST_ID="{host_id}"
VERSION="{version}"
STATE_DIR="$INSTALL_ROOT/export-state"
EXPORT_FILE="$INSTALL_ROOT/export.jsonl"

mkdir -p "$INSTALL_ROOT/config" "$POLICY_DIR" "$STATE_DIR"

if ! command -v tetragon >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq && apt-get install -y -qq tetragon 2>/dev/null || true
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y tetragon 2>/dev/null || true
  fi
fi

if ! command -v tetragon >/dev/null 2>&1; then
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64|amd64) TG_ARCH=amd64 ;;
    aarch64|arm64) TG_ARCH=arm64 ;;
    *) echo "unsupported architecture: $ARCH" >&2; exit 1 ;;
  esac
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  URL="https://github.com/cilium/tetragon/releases/download/v${{VERSION}}/tetra-linux-${{TG_ARCH}}.tar.gz"
  curl -fsSL -o "$TMP/tetra.tar.gz" "$URL"
  tar -xzf "$TMP/tetra.tar.gz" -C "$TMP"
  TG_BIN="$(find "$TMP" -type f \( -name tetragon -o -name tetra \) 2>/dev/null | head -1)"
  if [ -z "$TG_BIN" ]; then
    echo "tetragon binary not found in release tarball" >&2
    exit 1
  fi
  install -m 755 "$TG_BIN" "$BIN"
fi

cat > "$INSTALL_ROOT/config/tetragon.config.yaml" <<EOF
export-filename: "$EXPORT_FILE"
export-compact-encoding: false
enable-process-cred: true
enable-process-ns: true
EOF

cat > /etc/systemd/system/tetragon.service <<EOF
[Unit]
Description=Cilium Tetragon eBPF sensor (Machina Zeus)
Documentation=https://github.com/cilium/tetragon
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=$BIN --config-dir $INSTALL_ROOT/config --tracing-policy-dir $POLICY_DIR
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=tetragon

[Install]
WantedBy=multi-user.target
EOF

cat > "$INSTALL_ROOT/export-to-packetwolf.sh" <<'EXPORTEOF'
#!/bin/sh
set -eu
INSTALL_ROOT="{root}"
EXPORT_URL="{export_url}"
HOST_ID="{host_id}"
EXPORT_FILE="$INSTALL_ROOT/export.jsonl"
OFFSET_FILE="$INSTALL_ROOT/export-state/offset"
BATCH_SIZE="${{MACHINA_TETRAGON_EXPORT_BATCH:-25}}"

[ -f "$EXPORT_FILE" ] || exit 0
OFFSET=0
[ -f "$OFFSET_FILE" ] && OFFSET="$(cat "$OFFSET_FILE" 2>/dev/null || echo 0)"

TMP="$(mktemp)"
tail -n +$((OFFSET + 1)) "$EXPORT_FILE" 2>/dev/null | head -n "$BATCH_SIZE" > "$TMP" || true
LINES="$(wc -l < "$TMP" | tr -d ' ')"
[ "$LINES" -gt 0 ] || exit 0

python3 - "$TMP" "$EXPORT_URL" "$HOST_ID" <<'PY'
import json, sys, urllib.request
path, url, host_id = sys.argv[1:4]
events = []
for line in open(path, encoding="utf-8", errors="replace"):
    line = line.strip()
    if not line:
        continue
    try:
        events.append(json.loads(line))
    except json.JSONDecodeError:
        continue
if not events:
    sys.exit(0)
payload = json.dumps({{"events": events}}).encode()
req = urllib.request.Request(
    f"{{url.rstrip('/')}}/{{host_id}}",
    data=payload,
    headers={{"Content-Type": "application/json"}},
    method="POST",
)
with urllib.request.urlopen(req, timeout=15) as resp:
    resp.read()
PY

echo $((OFFSET + LINES)) > "$OFFSET_FILE"
EXPORTEOF
chmod 755 "$INSTALL_ROOT/export-to-packetwolf.sh"

cat > /etc/systemd/system/tetragon-export.service <<EOF
[Unit]
Description=PacketWolf export forwarder for Tetragon
After=tetragon.service network-online.target
Requires=tetragon.service

[Service]
Type=oneshot
Environment=MACHINA_HOST_ID=$HOST_ID
ExecStart=$INSTALL_ROOT/export-to-packetwolf.sh
EOF

cat > /etc/systemd/system/tetragon-export.timer <<EOF
[Unit]
Description=Forward Tetragon events to PacketWolf

[Timer]
OnBootSec=30
OnUnitActiveSec=10
AccuracySec=1s

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now tetragon.service
systemctl enable --now tetragon-export.timer
echo "Tetragon installed; export to $EXPORT_URL/$HOST_ID"
"#,
        root = root,
        export_url = spec.export_url,
        host_id = spec.host_id,
        version = version,
    )
}

fn write_executable(path: &Path, contents: &str, dry_run: bool) -> Result<(), LibvirtError> {
    if dry_run {
        return Ok(());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(LibvirtError::map_op("create tetragon dir"))?;
    }
    fs::write(path, contents).map_err(LibvirtError::map_op("write tetragon install script"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(path)
            .map_err(LibvirtError::map_op("chmod install script"))?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(path, perms).map_err(LibvirtError::map_op("chmod install script"))?;
    }
    Ok(())
}

pub fn run_tetragon_install(spec: &TetragonInstallSpec, dry_run: bool) -> Result<TetragonInstallResult, LibvirtError> {
    let script_path = policy_dir().join("install-tetragon.sh");
    let script = render_install_script(spec);
    write_executable(&script_path, &script, dry_run)?;

    #[cfg(not(target_os = "linux"))]
    {
        let _ = dry_run;
        return Ok(TetragonInstallResult {
            ok: false,
            binary_installed: false,
            service_active: false,
            export_timer_active: false,
            operations: vec![format!("write {}", script_path.display())],
            message: "Tetragon install requires Linux".into(),
        });
    }

    #[cfg(target_os = "linux")]
    {
        let mut operations = vec![format!("write {}", script_path.display())];
        if dry_run {
            return Ok(TetragonInstallResult {
                ok: true,
                binary_installed: Command::new("which")
                    .arg("tetragon")
                    .output()
                    .map(|o| o.status.success())
                    .unwrap_or(false),
                service_active: is_service_active("tetragon.service"),
                export_timer_active: is_service_active("tetragon-export.timer"),
                operations,
                message: "Dry run — install script rendered only".into(),
            });
        }

        let output = Command::new("/bin/sh")
            .arg(&script_path)
            .output()
            .map_err(LibvirtError::map_op("run tetragon install"))?;
        operations.push(format!("exec {}", script_path.display()));
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let binary_installed = Command::new("which")
            .arg("tetragon")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        let service_active = is_service_active("tetragon.service");
        let export_timer_active = is_service_active("tetragon-export.timer");
        let ok = output.status.success() && binary_installed;
        let message = if ok {
            if stdout.is_empty() {
                "Tetragon installed and services enabled".into()
            } else {
                stdout
            }
        } else {
            format!(
                "{}{}",
                stderr,
                if stderr.is_empty() { stdout } else { String::new() }
            )
            .trim()
            .to_string()
        };
        Ok(TetragonInstallResult {
            ok,
            binary_installed,
            service_active,
            export_timer_active,
            operations,
            message,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn install_script_contains_export_and_host() {
        let script = render_install_script(&TetragonInstallSpec {
            export_url: "http://127.0.0.1:9091/api/v1/ingest".into(),
            host_id: "host-abc".into(),
        });
        assert!(script.contains("http://127.0.0.1:9091/api/v1/ingest"));
        assert!(script.contains("host-abc"));
        assert!(script.contains("tetragon.service"));
        assert!(script.contains("tetragon-export.timer"));
        assert!(script.contains("tetra-linux-${TG_ARCH}.tar.gz"));
        assert!(script.contains("VERSION=\"1.7.0\""));
    }
}
