//! Execute allow-listed host commands as an OIDC-mapped local user (`sudo -n -u user -- …`).

use std::path::Path;
use std::process::{Command, Output, Stdio};

use crate::config::RunAsUserConfig;
use crate::system_accounts;
use crate::LibvirtError;

/// Basenames permitted when `[auth.run_as_user] mode = "sudo"`.
const ALLOWED_PROGRAMS: &[&str] = &[
    "useradd",
    "userdel",
    "usermod",
    "homectl",
    "chpasswd",
    "id",
    "getent",
];

fn program_allowed(program: &str) -> bool {
    let base = Path::new(program)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(program);
    ALLOWED_PROGRAMS.contains(&base)
}

/// Build `sudo -n -u <unix_user> -- <program> <args…>` when sudo impersonation is configured.
pub fn command_as_user(
    cfg: &RunAsUserConfig,
    unix_user: &str,
    program: &str,
    args: &[&str],
) -> Result<Command, LibvirtError> {
    if !cfg.sudo_impersonation_active() {
        let mut c = Command::new(program);
        c.args(args);
        return Ok(c);
    }
    if !system_accounts::unix_user_exists(unix_user) {
        return Err(LibvirtError::Forbidden(format!(
            "Mapped UNIX user '{unix_user}' does not exist on this host"
        )));
    }
    if !program_allowed(program) {
        return Err(LibvirtError::Forbidden(format!(
            "Program '{program}' is not allowed for run-as-user execution"
        )));
    }
    let mut c = Command::new("sudo");
    c.arg("-n")
        .arg("-u")
        .arg(unix_user)
        .arg("--")
        .arg(program);
    c.args(args);
    Ok(c)
}

pub fn status_as_user(
    cfg: &RunAsUserConfig,
    unix_user: Option<&str>,
    program: &str,
    args: &[&str],
) -> Result<std::process::ExitStatus, LibvirtError> {
    let mut cmd = match unix_user {
        Some(u) => command_as_user(cfg, u, program, args)?,
        None => {
            let mut c = Command::new(program);
            c.args(args);
            c
        }
    };
    cmd.status()
        .map_err(|e| LibvirtError::Operation(format!("{program}: {e}")))
}

pub fn output_as_user(
    cfg: &RunAsUserConfig,
    unix_user: Option<&str>,
    program: &str,
    args: &[&str],
) -> Result<Output, LibvirtError> {
    let mut cmd = match unix_user {
        Some(u) => command_as_user(cfg, u, program, args)?,
        None => {
            let mut c = Command::new(program);
            c.args(args);
            c
        }
    };
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    cmd.output()
        .map_err(|e| LibvirtError::Operation(format!("{program}: {e}")))
}
