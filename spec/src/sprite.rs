use serde::{Deserialize, Serialize};

use crate::error::SpecError;
use crate::vm::validate_name;

/// Request body for `POST /v1/sprites`. Deliberately **not** a reuse of
/// [`crate::VirtualMachine`]: sprites are throwaway, headless, single-host
/// sandboxes — HA/backup/Atlas-storage/network-attachment/cloud-init fields
/// on `VmSpec` are either meaningless or actively wrong here (e.g. `ha`
/// would insert an `ha_policies` row for a VM that's gone in seconds).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SpriteCreateRequest {
    /// Key into the daemon's golden-image registry (not an arbitrary
    /// filesystem path — see `daemon/src/routes/sprites.rs`).
    pub golden_image: String,
    #[serde(default = "default_vcpus")]
    pub vcpus: u32,
    #[serde(default = "default_memory_mb")]
    pub memory_mb: u64,
    #[serde(default = "default_ttl_seconds")]
    pub ttl_seconds: u64,
}

fn default_vcpus() -> u32 {
    1
}
fn default_memory_mb() -> u64 {
    512
}
fn default_ttl_seconds() -> u64 {
    300
}

/// Upper bounds for sprite sizing — deliberately far below `VirtualMachine`'s
/// (64 sockets/128 cores, 64 TiB memory): a sandbox that needs durable-VM-scale
/// resources isn't a sprite, it's a regular VM and should go through the
/// normal `POST /v1/vms` path instead.
const MAX_SPRITE_VCPUS: u32 = 8;
const MAX_SPRITE_MEMORY_MB: u64 = 8192;
/// 1 hour. Sprites are meant to live seconds-to-minutes; this is a hard
/// ceiling against a caller forgetting to set `ttl_seconds` and effectively
/// creating a durable VM the reconciler will never know exists (see
/// `daemon/src/routes/sprites.rs` reaper).
const MAX_TTL_SECONDS: u64 = 3600;

impl SpriteCreateRequest {
    pub fn validate(&self) -> Result<(), SpecError> {
        // `golden_image` ends up as a filename component
        // (`core::libvirt::sprite::resolve_golden_image` joins it under a
        // fixed directory) — `validate_golden_image_key` enforces the same
        // alphanumeric/-/_/ charset as a VM name, which structurally rules
        // out '/' or '..' path-traversal segments. `core` independently
        // re-validates with its own `validate::validate_name` before
        // touching the filesystem (see `resolve_golden_image`); this earlier
        // check exists so a malformed key is rejected as a 400 at the API
        // boundary instead of surfacing as an opaque 500/404 further down.
        validate_golden_image_key(&self.golden_image)?;
        if self.vcpus == 0 {
            return Err(SpecError::Validation("vcpus must be >= 1".into()));
        }
        if self.vcpus > MAX_SPRITE_VCPUS {
            return Err(SpecError::Validation(format!(
                "vcpus must be <= {MAX_SPRITE_VCPUS} for a sprite (use a regular VM for larger workloads)"
            )));
        }
        if self.memory_mb == 0 {
            return Err(SpecError::Validation("memory_mb must be >= 1".into()));
        }
        if self.memory_mb > MAX_SPRITE_MEMORY_MB {
            return Err(SpecError::Validation(format!(
                "memory_mb must be <= {MAX_SPRITE_MEMORY_MB} for a sprite (use a regular VM for larger workloads)"
            )));
        }
        if self.ttl_seconds == 0 {
            return Err(SpecError::Validation("ttl_seconds must be >= 1".into()));
        }
        if self.ttl_seconds > MAX_TTL_SECONDS {
            return Err(SpecError::Validation(format!(
                "ttl_seconds must be <= {MAX_TTL_SECONDS} (1 hour) for a sprite"
            )));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SpriteState {
    Booting,
    Running,
    Reaping,
    Gone,
}

/// Returned by `POST /v1/sprites` and `GET /v1/sprites/{id}`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SpriteHandle {
    pub sprite_id: String,
    pub state: SpriteState,
    /// RFC3339.
    pub created_at: String,
    /// RFC3339. `daemon`'s reaper tears the sprite down once this passes.
    pub expires_at: String,
    /// `None` until the domain is defined and a CID has been assigned.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vsock_cid: Option<u32>,
}

/// Domain name a sprite's libvirt domain is created/looked-up under.
/// Centralized here (rather than inlined at each call site in
/// `daemon/src/routes/sprites.rs`) so the `"sprite-"` prefix — which the
/// reaper and any future admin tooling can use to recognize/filter sprite
/// domains apart from regular VMs in `virsh list` — stays a single source of
/// truth.
pub fn sprite_domain_name(sprite_id: &str) -> String {
    format!("sprite-{sprite_id}")
}

/// Validate a `golden_image` registry key using the same name rules as a VM
/// name (`crate::vm::validate_name`) — it's used as a lookup key and (in the
/// domain-name prefix style above) may end up embedded in filesystem paths,
/// so the same alphanumeric/`-`/`_` restriction applies.
pub fn validate_golden_image_key(key: &str) -> Result<(), SpecError> {
    validate_name(key)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_request() -> SpriteCreateRequest {
        SpriteCreateRequest {
            golden_image: "python-minimal".into(),
            vcpus: default_vcpus(),
            memory_mb: default_memory_mb(),
            ttl_seconds: default_ttl_seconds(),
        }
    }

    #[test]
    fn validate_golden_path() {
        assert!(base_request().validate().is_ok());
    }

    #[test]
    fn validate_rejects_empty_golden_image() {
        let mut req = base_request();
        req.golden_image = "".into();
        assert!(req.validate().is_err());
    }

    #[test]
    fn validate_rejects_path_traversal_in_golden_image() {
        // golden_image becomes a filename component in
        // core::libvirt::sprite::resolve_golden_image — a key containing '/'
        // or '..' must never reach the filesystem.
        let mut req = base_request();
        req.golden_image = "../../etc/passwd".into();
        assert!(req.validate().is_err());
        req.golden_image = "images/python-minimal".into();
        assert!(req.validate().is_err());
    }

    #[test]
    fn validate_rejects_zero_vcpus() {
        let mut req = base_request();
        req.vcpus = 0;
        assert!(req.validate().is_err());
    }

    #[test]
    fn validate_rejects_oversized_vcpus() {
        let mut req = base_request();
        req.vcpus = MAX_SPRITE_VCPUS + 1;
        assert!(req.validate().is_err());
    }

    #[test]
    fn validate_rejects_zero_memory() {
        let mut req = base_request();
        req.memory_mb = 0;
        assert!(req.validate().is_err());
    }

    #[test]
    fn validate_rejects_oversized_memory() {
        let mut req = base_request();
        req.memory_mb = MAX_SPRITE_MEMORY_MB + 1;
        assert!(req.validate().is_err());
    }

    #[test]
    fn validate_rejects_zero_ttl() {
        let mut req = base_request();
        req.ttl_seconds = 0;
        assert!(req.validate().is_err());
    }

    #[test]
    fn validate_rejects_oversized_ttl() {
        let mut req = base_request();
        req.ttl_seconds = MAX_TTL_SECONDS + 1;
        assert!(req.validate().is_err());
    }

    #[test]
    fn sprite_domain_name_has_prefix() {
        assert_eq!(sprite_domain_name("abc123"), "sprite-abc123");
    }

    #[test]
    fn handle_round_trips_without_vsock_cid() {
        let handle = SpriteHandle {
            sprite_id: "abc123".into(),
            state: SpriteState::Booting,
            created_at: "2026-01-01T00:00:00Z".into(),
            expires_at: "2026-01-01T00:05:00Z".into(),
            vsock_cid: None,
        };
        let json = serde_json::to_string(&handle).unwrap();
        assert!(!json.contains("vsock_cid"));
        let round_tripped: SpriteHandle = serde_json::from_str(&json).unwrap();
        assert_eq!(round_tripped, handle);
    }
}
