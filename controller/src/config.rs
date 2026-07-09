// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct ControllerConfig {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub nats_url: Option<String>,
    pub default_agent_addr: String,
    pub default_libvirt_uri: String,
    pub disk_image_dir: PathBuf,
    pub backup_dir: PathBuf,
    pub admin_user: String,
    pub admin_password: String,
    pub jwt_secret: String,
    pub controller_id: String,
    pub public_base_url: String,
    pub web_base_url: String,
    pub guestkit_enabled: bool,
    pub guestkit_worker_url: String,
    pub guestkit_insecure_tls: bool,
    pub packetwolf_enabled: bool,
    pub packetwolf_base_url: String,
    pub packetwolf_api_key: Option<String>,
    pub packetwolf_insecure_tls: bool,
    /// Atlas — Zyvor storage control plane (Ceph/NFS/ZFS) used to provision
    /// VM disks as backend volumes and route snapshot/backup/restore.
    pub atlas_enabled: bool,
    pub atlas_base_url: String,
    /// Service-account JWT minted by Atlas (`POST /auth/tokens`); sent as a
    /// bearer token when Atlas runs with `ATLAS_AUTH_REQUIRED=1`.
    pub atlas_token: Option<String>,
    pub atlas_insecure_tls: bool,
    /// Default tenant recorded on Atlas volumes created for machina VMs.
    pub atlas_tenant_id: String,
    /// Default intent → placement policy for VM root disks (e.g. `database`,
    /// `general`); resolved to a StorageClass by atlas-policy.
    pub atlas_default_policy: String,
    /// Bound Atlas RGW bucket id used as the default target for VM backups.
    pub atlas_backup_bucket_id: Option<String>,
    /// Cluster-wide Ceph connection params used to attach Atlas RBD volumes as
    /// libvirt network disks. Atlas supplies the per-volume pool/image; these
    /// supply the monitor hosts and cephx credentials (a libvirt `ceph` secret).
    /// Comma-separated `host:port` list; empty = rely on the host's ceph.conf.
    pub atlas_rbd_mon_hosts: String,
    pub atlas_rbd_auth_user: Option<String>,
    pub atlas_rbd_secret_uuid: Option<String>,
    /// Co-located machina-daemon base URL for KubeVirt inventory sync.
    pub daemon_base_url: String,
    /// ConsoleHub / Guacamole (optional protocol gateway on hypervisors).
    pub guacamole_enabled: bool,
    pub guacamole_json_secret_hex: String,
    pub guacamole_base_url: String,
    pub guacamole_fetch_token: bool,
    pub consolehub_session_ttl_secs: u64,
    pub consolehub_proxy_prefix: String,
    /// Require approval workflow for production VM console (Phase 2/5).
    pub consolehub_require_approval: bool,
    /// Enable session recording metadata (Phase 2).
    pub consolehub_recording_enabled: bool,
    /// Directory for ConsoleHub session replay files (`.webm` per session id).
    pub consolehub_recording_dir: PathBuf,
    /// Require OIDC/SAML federation before opening production consoles (Phase 5).
    pub consolehub_require_oidc: bool,
    /// Hermes Launchpad API (Kubernetes app catalog + gateway).
    pub hermes_api_base: String,
    pub hermes_public_base: String,
    pub hermes_path_prefix: String,
}

impl Default for ControllerConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".into(),
            port: 5093,
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "sqlite:///var/lib/machina/controller.db".into()),
            nats_url: std::env::var("NATS_URL").ok(),
            default_agent_addr: std::env::var("MACHINA_AGENT_ADDR")
                .unwrap_or_else(|_| "http://127.0.0.1:50051".into()),
            default_libvirt_uri: std::env::var("MACHINA_LIBVIRT_URI")
                .unwrap_or_else(|_| "qemu:///system".into()),
            disk_image_dir: PathBuf::from("/var/lib/libvirt/images"),
            backup_dir: PathBuf::from("/var/lib/machina/backups"),
            // Bootstrap admin credentials — overridable so a deploy isn't stuck with
            // admin/admin. Only used to seed the first user when the table is empty.
            admin_user: std::env::var("MACHINA_ADMIN_USER").unwrap_or_else(|_| "admin".into()),
            admin_password: std::env::var("MACHINA_ADMIN_PASSWORD")
                .unwrap_or_else(|_| "admin".into()),
            jwt_secret: std::env::var("MACHINA_JWT_SECRET")
                .unwrap_or_else(|_| "machina-dev-jwt-secret-change-me".into()),
            controller_id: std::env::var("MACHINA_CONTROLLER_ID")
                .unwrap_or_else(|_| format!("ctrl-{}", &uuid::Uuid::new_v4().to_string()[..8])),
            public_base_url: std::env::var("MACHINA_PUBLIC_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:5093".into()),
            web_base_url: std::env::var("MACHINA_WEB_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:5173".into()),
            guestkit_enabled: std::env::var("GUESTKIT_ENABLED")
                .map(|v| matches!(v.to_lowercase().as_str(), "1" | "true" | "yes"))
                .unwrap_or(true),
            guestkit_worker_url: std::env::var("GUESTKIT_WORKER_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:8080".into()),
            guestkit_insecure_tls: std::env::var("GUESTKIT_INSECURE_TLS")
                .map(|v| matches!(v.to_lowercase().as_str(), "1" | "true" | "yes"))
                // Secure by default — set GUESTKIT_INSECURE_TLS=1 for a self-signed
                // HTTPS worker. Default worker URL is HTTP, where TLS doesn't apply.
                .unwrap_or(false),
            packetwolf_enabled: std::env::var("PACKETWOLF_ENABLED")
                .map(|v| matches!(v.to_lowercase().as_str(), "1" | "true" | "yes"))
                .unwrap_or(false),
            packetwolf_base_url: std::env::var("PACKETWOLF_BASE_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:9091".into()),
            packetwolf_api_key: std::env::var("PACKETWOLF_API_KEY").ok(),
            packetwolf_insecure_tls: std::env::var("PACKETWOLF_INSECURE_TLS")
                .map(|v| matches!(v.to_lowercase().as_str(), "1" | "true" | "yes"))
                // Secure by default — set PACKETWOLF_INSECURE_TLS=1 for a self-signed fabric.
                .unwrap_or(false),
            atlas_enabled: std::env::var("ATLAS_ENABLED")
                .map(|v| matches!(v.to_lowercase().as_str(), "1" | "true" | "yes"))
                .unwrap_or(false),
            atlas_base_url: std::env::var("ATLAS_BASE_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:5110".into()),
            atlas_token: std::env::var("ATLAS_TOKEN").ok().filter(|s| !s.is_empty()),
            atlas_insecure_tls: std::env::var("ATLAS_INSECURE_TLS")
                .map(|v| matches!(v.to_lowercase().as_str(), "1" | "true" | "yes"))
                // Secure by default — set ATLAS_INSECURE_TLS=1 for a self-signed gateway.
                .unwrap_or(false),
            atlas_tenant_id: std::env::var("ATLAS_TENANT_ID")
                .unwrap_or_else(|_| "machina".into()),
            atlas_default_policy: std::env::var("ATLAS_DEFAULT_POLICY")
                .unwrap_or_else(|_| "general".into()),
            atlas_backup_bucket_id: std::env::var("ATLAS_BACKUP_BUCKET_ID")
                .ok()
                .filter(|s| !s.is_empty()),
            atlas_rbd_mon_hosts: std::env::var("ATLAS_RBD_MON_HOSTS").unwrap_or_default(),
            atlas_rbd_auth_user: std::env::var("ATLAS_RBD_AUTH_USER")
                .ok()
                .filter(|s| !s.is_empty()),
            atlas_rbd_secret_uuid: std::env::var("ATLAS_RBD_SECRET_UUID")
                .ok()
                .filter(|s| !s.is_empty()),
            daemon_base_url: std::env::var("MACHINA_DAEMON_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:5092".into()),
            guacamole_enabled: std::env::var("GUACAMOLE_ENABLED")
                .map(|v| matches!(v.to_lowercase().as_str(), "1" | "true" | "yes"))
                .unwrap_or_else(|_| {
                    // Match the agent's gate (guacamole_proxy: len >= 32) — a
                    // shorter/empty secret would make the controller advertise
                    // console sessions the agent then refuses as unconfigured.
                    std::env::var("GUACAMOLE_JSON_SECRET_HEX")
                        .map(|s| s.trim().len() >= 32)
                        .unwrap_or(false)
                }),
            guacamole_json_secret_hex: std::env::var("GUACAMOLE_JSON_SECRET_HEX")
                .unwrap_or_default(),
            guacamole_base_url: std::env::var("GUACAMOLE_BASE_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:8081/guacamole".into()),
            guacamole_fetch_token: std::env::var("GUACAMOLE_FETCH_TOKEN")
                .map(|v| !matches!(v.to_lowercase().as_str(), "0" | "false" | "no"))
                .unwrap_or(true),
            consolehub_session_ttl_secs: std::env::var("CONSOLEHUB_SESSION_TTL_SECS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(600),
            consolehub_proxy_prefix: std::env::var("CONSOLEHUB_PROXY_PREFIX")
                .unwrap_or_else(|_| "/consolehub/guacamole".into()),
            consolehub_require_approval: std::env::var("CONSOLEHUB_REQUIRE_APPROVAL")
                .map(|v| matches!(v.to_lowercase().as_str(), "1" | "true" | "yes"))
                .unwrap_or(false),
            consolehub_recording_enabled: std::env::var("CONSOLEHUB_RECORDING_ENABLED")
                .map(|v| matches!(v.to_lowercase().as_str(), "1" | "true" | "yes"))
                .unwrap_or(false),
            consolehub_recording_dir: std::env::var("CONSOLEHUB_RECORDING_DIR")
                .map(PathBuf::from)
                .unwrap_or_else(|_| PathBuf::from("/var/lib/machina/console-recordings")),
            consolehub_require_oidc: std::env::var("CONSOLEHUB_REQUIRE_OIDC")
                .map(|v| matches!(v.to_lowercase().as_str(), "1" | "true" | "yes"))
                .unwrap_or(false),
            // Launchpad/Hermes is opt-in: empty by default so `enabled` (config.rs
            // launchpad handler) is false unless an operator explicitly points at a
            // Hermes deployment. A non-empty localhost default made the UI render the
            // Launchpad and then 502 on every call when Hermes wasn't installed.
            hermes_api_base: std::env::var("HERMES_API_BASE").unwrap_or_default(),
            hermes_public_base: std::env::var("HERMES_PUBLIC_BASE").unwrap_or_default(),
            hermes_path_prefix: std::env::var("HERMES_PATH_PREFIX")
                .unwrap_or_else(|_| "/launchpad".into()),
        }
    }
}
