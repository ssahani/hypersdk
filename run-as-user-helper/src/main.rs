//! Install setuid-root: `chown root:root && chmod u+s /usr/local/libexec/machina-run-as-user`
//!
//! Usage: machina-run-as-user <unix-user> <program> [args...]

use std::env;
use std::ffi::CString;
use std::os::unix::process::CommandExt;
use std::path::Path;
use std::process::{self, Command};

const ALLOWED: &[&str] = &[
    "useradd", "userdel", "usermod", "homectl", "chpasswd", "id", "getent",
];

fn main() {
    if let Err(e) = run() {
        eprintln!("machina-run-as-user: {e}");
        process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let args: Vec<String> = env::args().collect();
    if args.len() < 3 {
        return Err("usage: machina-run-as-user <unix-user> <program> [args...]".into());
    }
    let target_user = &args[1];
    let program = &args[2];
    let prog_args: Vec<&str> = args[3..].iter().map(|s| s.as_str()).collect();

    let base = Path::new(program)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(program.as_str());
    if !ALLOWED.contains(&base) {
        return Err(format!("program '{program}' is not allow-listed"));
    }

    let c_user = CString::new(target_user.as_str()).map_err(|e| e.to_string())?;
    let (uid, gid) = unsafe {
        let pwd = libc::getpwnam(c_user.as_ptr());
        if pwd.is_null() {
            return Err(format!("unknown user '{target_user}'"));
        }
        ((*pwd).pw_uid, (*pwd).pw_gid)
    };

    if unsafe { libc::setgid(gid) } != 0 || unsafe { libc::setuid(uid) } != 0 {
        return Err("setuid/setgid failed (helper must be installed setuid root)".into());
    }

    let err = Command::new(program).args(prog_args).exec();
    Err(format!("exec failed: {err}"))
}
