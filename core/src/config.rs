use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct VirtspawnConfig {
    #[serde(default)]
    pub general: GeneralConfig,
    #[serde(default)]
    pub daemon: DaemonConfig,
    #[serde(default)]
    pub libvirt: LibvirtConfig,
    #[serde(default)]
    pub backup: BackupConfig,
    #[serde(default)]
    pub tls: TlsConfig,
    /// PAM service name (file in `/etc/pam.d/`) for web UI and API session login.
    #[serde(default)]
    pub auth: AuthConfig,
    /// Optional Apache Guacamole encrypted JSON auth (`GET .../guacamole-auth` on the daemon).
    #[serde(default)]
    pub guacamole: GuacamoleConfig,
    /// Browser SSH terminal: short-lived sessions, optional host allowlist (`targets`), PTY + system `ssh`.
    #[serde(default)]
    pub ssh_terminal: SshTerminalConfig,
}

/// Apache Guacamole integration: signed/encrypted JSON for `/api/tokens` (see project `docs/guacamole-integration.md`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuacamoleConfig {
    /// When true and `json_secret_hex` is set, `GET /api/v1/vms/{name}/guacamole-auth` returns encrypted `guac_data`.
    #[serde(default)]
    pub enabled: bool,
    /// 32 hex digits (16-byte key); must match Guacamole `JSON_SECRET_KEY`.
    #[serde(default)]
    pub json_secret_hex: String,
    #[serde(default = "default_guacamole_base_url")]
    pub base_url: String,
    /// When libvirt reports VNC on loopback, rewrite hostname for `guacd` (e.g. hypervisor LAN IP).
    #[serde(default)]
    pub public_vnc_host: String,
    /// POST encrypted blob to Guacamole `/api/tokens` and include `token` in the JSON response when successful.
    #[serde(default = "default_true")]
    pub fetch_token: bool,
    /// `username` field inside the cleartext JSON auth document sent to Guacamole.
    #[serde(default = "default_guacamole_json_username")]
    pub json_username: String,
}

fn default_guacamole_base_url() -> String {
    "http://127.0.0.1:8080/guacamole".to_string()
}

fn default_guacamole_json_username() -> String {
    "virtspawn".to_string()
}

impl Default for GuacamoleConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            json_secret_hex: String::new(),
            base_url: default_guacamole_base_url(),
            public_vnc_host: String::new(),
            fetch_token: true,
            json_username: default_guacamole_json_username(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TlsConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub cert_path: String,
    #[serde(default)]
    pub key_path: String,
}

impl Default for TlsConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            cert_path: String::new(),
            key_path: String::new(),
        }
    }
}

/// PAM configuration for `virtspawn-daemon` (web sign-in uses the same password as the selected stack).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    /// PAM service: which `/etc/pam.d/<name>` to use. `sshd` matches “remote” password rules; `login` is
    /// for local TTY and can block `root` or fail without a TTY.
    #[serde(default = "default_pam_service")]
    pub pam_service: String,
}

fn default_pam_service() -> String {
    "sshd".to_string()
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            pam_service: default_pam_service(),
        }
    }
}

/// Named SSH destinations for the browser terminal (`POST /api/v1/terminal/sessions` with `target_id`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshTerminalTarget {
    /// Opaque id (e.g. `lab-db`); never put raw IPs in the WebSocket URL — resolve via session API.
    pub id: String,
    /// Hostname or IP passed to `ssh user@host`.
    pub host: String,
    /// Default SSH login when the client omits `ssh_user` (empty = client must send `ssh_user`).
    #[serde(default)]
    pub ssh_user: String,
}

fn default_ssh_terminal_session_ttl() -> u64 {
    120
}

/// Controls `POST /api/v1/terminal/sessions` and `/ws/v1/terminal/{session_id}` (PTY + OpenSSH client).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshTerminalConfig {
    /// How long a created session id remains valid (seconds). Clamped to 30–3600 when used.
    #[serde(default = "default_ssh_terminal_session_ttl")]
    pub session_ttl_secs: u64,
    /// When no `target_id` is sent, allow `host` in the JSON body (still validated; browser never passes host in the WS path).
    #[serde(default = "default_true")]
    pub allow_adhoc_hosts: bool,
    /// Legacy `/ws/v1/ssh/{host}` WebSocket (raw keystrokes, no session). Prefer session flow; keep off in production.
    #[serde(default)]
    pub legacy_plain_host_websocket: bool,
    #[serde(default)]
    pub targets: Vec<SshTerminalTarget>,
}

impl Default for SshTerminalConfig {
    fn default() -> Self {
        Self {
            session_ttl_secs: default_ssh_terminal_session_ttl(),
            allow_adhoc_hosts: true,
            legacy_plain_host_websocket: false,
            targets: Vec::new(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeneralConfig {
    #[serde(default = "default_refresh_interval")]
    pub refresh_interval_secs: u64,
}

/// HTTP listen port when `[daemon]` has no `port = …` (matches install template & CLI overrides).
pub const DEFAULT_DAEMON_PORT: u16 = 5092;

#[derive(Debug, Serialize, Deserialize)]
pub struct DaemonConfig {
    #[serde(default = "default_host")]
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
}

/// How new VMs are created when the API client does not override `create_backend` on the request.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VmCreateBackend {
    /// Native virtspawn domain XML + `qemu-img` (default).
    #[default]
    LibvirtXml,
    /// Shell out to `virt-install` (hyper2kvm-style).
    VirtInstall,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibvirtConfig {
    #[serde(default = "default_libvirt_uri")]
    pub uri: String,
    /// Default VM create engine; clients may send `create_backend` per request.
    #[serde(default)]
    pub create_backend: VmCreateBackend,
    /// Legacy libguestfs `virt-builder` integration (optional API fields). **Default: disabled** — prefer [`mkosi_allowed`](Self::mkosi_allowed) / `mkosi_workspace`. Set `virt_builder_allowed = true` only if you need virt-builder.
    #[serde(default = "default_false")]
    pub virt_builder_allowed: bool,
    /// If set and the client does not send `virt_builder_ssh_pubkey`, used for `--ssh-inject root:file:…`.
    #[serde(default)]
    pub virt_builder_default_ssh_pubkey_path: String,
    /// Pass `--update` to `virt-builder` (package updates inside the template).
    #[serde(default = "default_true")]
    pub virt_builder_update: bool,
    /// Packages always installed via `virt-builder --install` for every virt-builder VM (e.g. `["qemu-guest-agent"]`).
    #[serde(default)]
    pub virt_builder_default_packages: Vec<String>,
    /// Allow `CreateVmRequest.mkosi_workspace` → `mkosi build` (recommended disk images; requires mkosi on host; see install.sh).
    #[serde(default = "default_true")]
    pub mkosi_allowed: bool,
}

fn default_false() -> bool {
    false
}

fn default_true() -> bool {
    true
}

fn default_refresh_interval() -> u64 {
    5
}

fn default_host() -> String {
    "0.0.0.0".to_string()
}

fn default_port() -> u16 {
    DEFAULT_DAEMON_PORT
}

fn default_libvirt_uri() -> String {
    "qemu:///system".to_string()
}

fn default_backup_dir() -> String {
    "/var/lib/virtspawn/backups".to_string()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupConfig {
    #[serde(default = "default_backup_dir")]
    pub backup_dir: String,
    #[serde(default)]
    pub nfs_target: String,
    #[serde(default)]
    pub with_disks: bool,
    #[serde(default = "default_retain")]
    pub retain: u32,
}

fn default_retain() -> u32 {
    7
}

impl Default for BackupConfig {
    fn default() -> Self {
        Self {
            backup_dir: default_backup_dir(),
            nfs_target: String::new(),
            with_disks: false,
            retain: default_retain(),
        }
    }
}

impl Default for GeneralConfig {
    fn default() -> Self {
        Self {
            refresh_interval_secs: default_refresh_interval(),
        }
    }
}

impl Default for DaemonConfig {
    fn default() -> Self {
        Self {
            host: default_host(),
            port: default_port(),
        }
    }
}

impl Default for LibvirtConfig {
    fn default() -> Self {
        Self {
            uri: default_libvirt_uri(),
            create_backend: VmCreateBackend::default(),
            virt_builder_allowed: false,
            virt_builder_default_ssh_pubkey_path: String::new(),
            virt_builder_update: true,
            virt_builder_default_packages: Vec::new(),
            mkosi_allowed: true,
        }
    }
}

impl VirtspawnConfig {
    /// Installed daemon config (`install.sh`, systemd unit).
    pub fn system_config_path() -> PathBuf {
        PathBuf::from("/etc/virtspawn/config.toml")
    }

    /// Optional per-user overrides (development / non-root).
    pub fn user_config_dir() -> PathBuf {
        dirs_or_home().join(".virtspawn")
    }

    pub fn user_config_path() -> PathBuf {
        Self::user_config_dir().join("config.toml")
    }

    /// Legacy alias for [`Self::user_config_dir`].
    pub fn config_dir() -> PathBuf {
        Self::user_config_dir()
    }

    /// Prefer [`Self::system_config_path`] as the canonical location.
    pub fn config_path() -> PathBuf {
        Self::system_config_path()
    }

    pub fn load() -> Self {
        let paths = [Self::system_config_path(), Self::user_config_path()];

        for config_path in &paths {
            if config_path.exists() {
                match fs::read_to_string(config_path) {
                    Ok(content) => match toml::from_str(&content) {
                        Ok(config) => {
                            tracing::info!("Loaded config from {}", config_path.display());
                            return config;
                        }
                        Err(e) => {
                            tracing::warn!(
                                "Failed to parse {}: {e}",
                                config_path.display()
                            );
                        }
                    },
                    Err(e) => {
                        tracing::warn!("Failed to read {}: {e}", config_path.display());
                    }
                }
            }
        }

        tracing::info!("No config file found, using defaults");
        Self::default()
    }

    pub fn save(&self) -> anyhow::Result<()> {
        let content = toml::to_string_pretty(self)?;
        let sys = Self::system_config_path();
        if let Some(parent) = sys.parent() {
            let _ = fs::create_dir_all(parent);
            if fs::write(&sys, &content).is_ok() {
                return Ok(());
            }
        }
        let user = Self::user_config_path();
        if let Some(parent) = user.parent() {
            fs::create_dir_all(parent)?;
            fs::write(user, content)?;
            return Ok(());
        }
        anyhow::bail!("cannot save config (try sudo for /etc/virtspawn)")
    }

    pub fn bind_addr(&self) -> String {
        format!("{}:{}", self.daemon.host, self.daemon.port)
    }

    /// Base URL for API clients (TUI, scripts). Uses `https` when TLS certs are configured.
    pub fn daemon_url(&self) -> String {
        let scheme = if self.tls.enabled
            && !self.tls.cert_path.is_empty()
            && !self.tls.key_path.is_empty()
        {
            "https"
        } else {
            "http"
        };
        format!("{}://{}:{}", scheme, self.daemon.host, self.daemon.port)
    }
}

fn dirs_or_home() -> PathBuf {
    std::env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            // Fallback: use /var/lib/virtspawn instead of world-writable /tmp
            PathBuf::from("/var/lib/virtspawn")
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn daemon_url_uses_http_without_tls() {
        let c = VirtspawnConfig::default();
        assert!(
            c.daemon_url().starts_with("http://"),
            "{}",
            c.daemon_url()
        );
    }

    #[test]
    fn daemon_url_uses_https_when_tls_configured() {
        let mut c = VirtspawnConfig::default();
        c.tls.enabled = true;
        c.tls.cert_path = "/etc/virtspawn/ssl/cert.pem".into();
        c.tls.key_path = "/etc/virtspawn/ssl/key.pem".into();
        assert!(c.daemon_url().starts_with("https://"));
    }
}
