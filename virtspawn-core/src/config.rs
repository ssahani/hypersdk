use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct VirtspawnConfig {
    #[serde(default)]
    pub general: GeneralConfig,
    #[serde(default)]
    pub daemon: DaemonConfig,
    #[serde(default)]
    pub libvirt: LibvirtConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeneralConfig {
    #[serde(default = "default_refresh_interval")]
    pub refresh_interval_secs: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DaemonConfig {
    #[serde(default = "default_host")]
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LibvirtConfig {
    #[serde(default = "default_libvirt_uri")]
    pub uri: String,
}

fn default_refresh_interval() -> u64 {
    5
}

fn default_host() -> String {
    "127.0.0.1".to_string()
}

fn default_port() -> u16 {
    8081
}

fn default_libvirt_uri() -> String {
    "qemu:///system".to_string()
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
        }
    }
}

impl Default for VirtspawnConfig {
    fn default() -> Self {
        Self {
            general: GeneralConfig::default(),
            daemon: DaemonConfig::default(),
            libvirt: LibvirtConfig::default(),
        }
    }
}

impl VirtspawnConfig {
    pub fn config_dir() -> PathBuf {
        dirs_or_home().join(".virtspawn")
    }

    pub fn config_path() -> PathBuf {
        Self::config_dir().join("config.toml")
    }

    pub fn load() -> Self {
        // Check paths in order: user config, then system config
        let paths = [
            Self::config_path(),
            PathBuf::from("/etc/virtspawn/config.toml"),
        ];

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
        let config_dir = Self::config_dir();
        fs::create_dir_all(&config_dir)?;
        let content = toml::to_string_pretty(self)?;
        fs::write(Self::config_path(), content)?;
        Ok(())
    }

    pub fn bind_addr(&self) -> String {
        format!("{}:{}", self.daemon.host, self.daemon.port)
    }

    pub fn daemon_url(&self) -> String {
        format!("http://{}:{}", self.daemon.host, self.daemon.port)
    }
}

fn dirs_or_home() -> PathBuf {
    std::env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/tmp"))
}
