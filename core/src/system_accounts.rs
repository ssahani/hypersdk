//! Create local UNIX accounts (useradd / chpasswd). Intended for daemons running as root;
//! callers must enforce policy (e.g. only session users in wheel/sudo).

use std::io::Write;
use std::process::{Command, Stdio};

use crate::LibvirtError;

/// Supplementary groups that conventionally grant sudo on common distros.
const PRIVILEGED_SUPP_GROUPS: &[&str] = &["wheel", "sudo", "admin"];

/// Same character rules as web login (`daemon/src/auth.rs` login_handler).
fn validate_login_username(name: &str) -> Result<(), LibvirtError> {
    if name.is_empty() {
        return Err(LibvirtError::Invalid("Username cannot be empty".into()));
    }
    if name.len() > 32 {
        return Err(LibvirtError::Invalid(
            "Username too long for UNIX account (max 32)".into(),
        ));
    }
    if !name
        .chars()
        .all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.')
    {
        return Err(LibvirtError::Invalid(
            "Invalid username characters (allowed: letters, digits, _, -, .)".into(),
        ));
    }
    Ok(())
}

/// Return supplementary group names for `username` via `id -Gn` (empty on failure).
pub fn unix_supplementary_group_names(username: &str) -> Result<Vec<String>, LibvirtError> {
    validate_login_username(username)?;
    let out = Command::new("id")
        .args(["-Gn", username])
        .output()
        .map_err(|e| LibvirtError::Operation(format!("id: {e}")))?;
    if !out.status.success() {
        return Err(LibvirtError::Operation(format!(
            "Cannot resolve groups for user '{}'",
            username
        )));
    }
    let s = String::from_utf8_lossy(&out.stdout);
    Ok(s.split_whitespace().map(|g| g.to_string()).collect())
}

/// True if `username` may administer host accounts: root, or member of wheel / sudo / admin.
pub fn unix_user_may_use_sudo(username: &str) -> bool {
    if username == "root" {
        return true;
    }
    match unix_supplementary_group_names(username) {
        Ok(groups) => groups
            .iter()
            .any(|g| PRIVILEGED_SUPP_GROUPS.contains(&g.as_str())),
        Err(_) => false,
    }
}

/// Create a new local user with home directory and `/bin/bash`, then set password via `chpasswd`.
/// `actor` is only used for logging at the call site; this function does not check policy.
pub fn create_local_user(new_username: &str, password: &str) -> Result<(), LibvirtError> {
    validate_login_username(new_username)?;
    if new_username.eq_ignore_ascii_case("root") {
        return Err(LibvirtError::Invalid("Cannot create root".into()));
    }
    if password.is_empty() {
        return Err(LibvirtError::Invalid("Password is required".into()));
    }
    if password.len() > 4096 {
        return Err(LibvirtError::Invalid("Password too long".into()));
    }
    if password.contains(':') || password.contains('\n') || password.contains('\0') {
        return Err(LibvirtError::Invalid(
            "Password cannot contain ':', newline, or NUL".into(),
        ));
    }

    let exists = Command::new("id")
        .arg(new_username)
        .status()
        .map_err(|e| LibvirtError::Operation(format!("id: {e}")))?;
    if exists.success() {
        return Err(LibvirtError::Invalid(format!(
            "User '{}' already exists",
            new_username
        )));
    }

    let st = Command::new("useradd")
        .args(["-m", "-s", "/bin/bash", "--", new_username])
        .status()
        .map_err(|e| LibvirtError::Operation(format!("useradd: {e}")))?;
    if !st.success() {
        return Err(LibvirtError::Operation(
            "useradd failed (see journal for details)".into(),
        ));
    }

    let mut child = Command::new("chpasswd")
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| LibvirtError::Operation(format!("chpasswd: {e}")))?;
    let line = format!("{new_username}:{password}\n");
    {
        let stdin = child.stdin.as_mut().ok_or_else(|| {
            LibvirtError::Operation("chpasswd: no stdin".into())
        })?;
        stdin
            .write_all(line.as_bytes())
            .map_err(|e| LibvirtError::Operation(format!("chpasswd write: {e}")))?;
    }
    let out = child
        .wait_with_output()
        .map_err(|e| LibvirtError::Operation(format!("chpasswd: {e}")))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(LibvirtError::Operation(format!(
            "chpasswd failed: {}",
            err.trim()
        )));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_login_username_rejects_empty() {
        assert!(validate_login_username("").is_err());
    }

    #[test]
    fn validate_login_username_accepts_alma() {
        assert!(validate_login_username("alma-user_1").is_ok());
    }
}
