use serde::Deserialize;
use std::path::Path;

#[derive(Debug, Deserialize)]
pub struct Config {
    #[serde(default = "default_host")]
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default = "default_libvirt_uri")]
    pub libvirt_uri: String,
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

impl Default for Config {
    fn default() -> Self {
        Self {
            host: default_host(),
            port: default_port(),
            libvirt_uri: default_libvirt_uri(),
        }
    }
}

impl Config {
    pub fn load() -> anyhow::Result<Self> {
        let paths = [
            "virtspawn.yaml",
            "/etc/virtspawn/virtspawn.yaml",
        ];

        for path in &paths {
            let p = Path::new(path);
            if p.exists() {
                let contents = std::fs::read_to_string(p)?;
                let config: Config = serde_yaml::from_str(&contents)?;
                tracing::info!("Loaded config from {path}");
                return Ok(config);
            }
        }

        tracing::info!("No config file found, using defaults");
        Ok(Config::default())
    }

    pub fn bind_addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}
