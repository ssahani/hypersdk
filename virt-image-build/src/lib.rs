//! Library API for building VM disk images with `virt-builder` (same behavior as the `virt-image-build` CLI).
//!
//! Root passwords are never passed on argv — only `file:…` from a host path or a temp file from `root_password_inline`
//! (in-memory only for the duration of the build; use sparingly from trusted callers).

use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

/// Build request (JSON-serializable for the machina daemon).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildDiskRequest {
    pub os: String,
    /// Absolute path for the new disk image (must not exist).
    pub output: String,
    #[serde(default = "default_size")]
    pub size: String,
    #[serde(default = "default_format")]
    pub format: String,
    #[serde(default = "default_hostname")]
    pub hostname: String,
    /// Comma-separated package names (each becomes `--install`).
    #[serde(default)]
    pub install: String,
    #[serde(default)]
    pub run_command: Vec<String>,
    #[serde(default)]
    pub copy_in: Vec<String>,
    /// Host path to first-boot script (copied to `/root` in the guest).
    #[serde(default)]
    pub firstboot_script: Option<String>,
    /// Host file: first line is root password for `--root-password file:…`.
    #[serde(default)]
    pub root_password_file: Option<String>,
    /// Single-line root password (written to a private temp file for the build only). Prefer `root_password_file` from clients.
    #[serde(default)]
    pub root_password_inline: Option<String>,
    /// Host file for `--ssh-inject root:file:…`.
    #[serde(default)]
    pub ssh_pubkey_file: Option<String>,
    /// Single-line OpenSSH public key (written to a private temp file for the build only). Prefer `ssh_pubkey_file` from clients.
    #[serde(default)]
    pub ssh_pubkey_inline: Option<String>,
    #[serde(default)]
    pub update: bool,
    #[serde(default)]
    pub selinux_relabel: bool,
    /// Extra argv forwarded to `virt-builder` (advanced).
    #[serde(default)]
    pub extra_virt_builder_args: Vec<String>,
    /// Kill `virt-builder` after this many seconds (`0` = wait until completion).
    #[serde(default)]
    pub timeout_secs: u64,
}

fn default_size() -> String {
    "20G".into()
}
fn default_format() -> String {
    "qcow2".into()
}
fn default_hostname() -> String {
    "virtbuilder-guest.local".into()
}

impl Default for BuildDiskRequest {
    fn default() -> Self {
        Self {
            os: "fedora-39".into(),
            output: String::new(),
            size: default_size(),
            format: default_format(),
            hostname: default_hostname(),
            install: String::new(),
            run_command: Vec::new(),
            copy_in: Vec::new(),
            firstboot_script: None,
            root_password_file: None,
            root_password_inline: None,
            ssh_pubkey_file: None,
            ssh_pubkey_inline: None,
            update: false,
            selinux_relabel: false,
            extra_virt_builder_args: Vec::new(),
            timeout_secs: 0,
        }
    }
}

struct TempPasswordFile {
    path: PathBuf,
}

impl TempPasswordFile {
    fn from_line(contents: &str) -> Result<Self> {
        let path = std::env::temp_dir().join(format!(
            "virt-image-build-pw-{}-{}.tmp",
            std::process::id(),
            random_suffix()
        ));
        fs::write(&path, format!("{}\n", contents.trim_end_matches('\n')))
            .with_context(|| format!("write temp password file {}", path.display()))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&path)?.permissions();
            perms.set_mode(0o600);
            fs::set_permissions(&path, perms)?;
        }
        Ok(Self { path })
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TempPasswordFile {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

fn random_suffix() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0)
}

struct RootPasswordArg {
    file_uri: String,
    _temp: Option<TempPasswordFile>,
}

fn resolve_root_password(req: &BuildDiskRequest) -> Result<Option<RootPasswordArg>> {
    if let Some(ref p) = req.root_password_file {
        let pb = Path::new(p)
            .canonicalize()
            .with_context(|| format!("root_password_file: {p}"))?;
        if !pb.is_file() {
            bail!("root_password_file must be a regular file");
        }
        return Ok(Some(RootPasswordArg {
            file_uri: format!("file:{}", pb.display()),
            _temp: None,
        }));
    }
    if let Some(ref pw) = req.root_password_inline {
        if !pw.is_empty() {
            let t = TempPasswordFile::from_line(pw)?;
            let file_uri = format!("file:{}", t.path().display());
            return Ok(Some(RootPasswordArg {
                file_uri,
                _temp: Some(t),
            }));
        }
    }
    if let Ok(pw) = std::env::var("ROOT_PASSWORD") {
        if !pw.is_empty() {
            let t = TempPasswordFile::from_line(&pw)?;
            let file_uri = format!("file:{}", t.path().display());
            return Ok(Some(RootPasswordArg {
                file_uri,
                _temp: Some(t),
            }));
        }
    }
    Ok(None)
}

struct TempPubkeyFile {
    path: PathBuf,
}

impl TempPubkeyFile {
    fn from_line(contents: &str) -> Result<Self> {
        let path = std::env::temp_dir().join(format!(
            "virt-image-build-pk-{}-{}.tmp",
            std::process::id(),
            random_suffix()
        ));
        fs::write(&path, format!("{}\n", contents.trim_end_matches('\n')))
            .with_context(|| format!("write temp pubkey file {}", path.display()))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&path)?.permissions();
            perms.set_mode(0o600);
            fs::set_permissions(&path, perms)?;
        }
        Ok(Self { path })
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TempPubkeyFile {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

struct SshInjectArg {
    file_uri: String,
    _temp: Option<TempPubkeyFile>,
}

fn resolve_ssh_inject(req: &BuildDiskRequest) -> Result<Option<SshInjectArg>> {
    if let Some(ref p) = req.ssh_pubkey_file {
        if !p.trim().is_empty() {
            let pb = Path::new(p.trim())
                .canonicalize()
                .with_context(|| format!("ssh_pubkey_file: {p}"))?;
            if !pb.is_file() {
                bail!("ssh_pubkey_file must be a regular file");
            }
            return Ok(Some(SshInjectArg {
                file_uri: format!("file:{}", pb.display()),
                _temp: None,
            }));
        }
    }
    if let Some(ref line) = req.ssh_pubkey_inline {
        if !line.trim().is_empty() {
            let t = TempPubkeyFile::from_line(line)?;
            let file_uri = format!("file:{}", t.path().display());
            return Ok(Some(SshInjectArg {
                file_uri,
                _temp: Some(t),
            }));
        }
    }
    Ok(None)
}

/// Run `virt-builder --version`.
pub fn check_virt_builder() -> Result<()> {
    let st = Command::new("virt-builder")
        .arg("--version")
        .status()
        .context("virt-builder not found; install libguestfs-tools (dnf/apt)")?;
    if !st.success() {
        bail!("virt-builder --version failed: {st:?}");
    }
    Ok(())
}

/// Plain-text template list (stdout of `virt-builder --list`).
pub fn list_templates_text() -> Result<String> {
    let out = Command::new("virt-builder")
        .arg("--list")
        .output()
        .context("virt-builder --list")?;
    if !out.status.success() {
        bail!(
            "virt-builder --list failed: {}",
            String::from_utf8_lossy(&out.stderr)
        );
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Validate output path: absolute, no `..`, parent exists, file must not exist.
pub fn validate_output_path(output: &str) -> Result<PathBuf> {
    let p = Path::new(output);
    if !p.is_absolute() {
        bail!("output must be an absolute path");
    }
    let s = p.to_string_lossy();
    if s.contains("/../") || s.ends_with("/..") || s.starts_with("../") {
        bail!("output path must not contain '..' components");
    }
    let parent = p
        .parent()
        .filter(|x| !x.as_os_str().is_empty())
        .context("output has no parent directory")?;
    if !parent.is_dir() {
        bail!(
            "output parent directory does not exist: {}",
            parent.display()
        );
    }
    if p.exists() {
        bail!("refusing to overwrite existing file: {}", p.display());
    }
    Ok(p.to_path_buf())
}

fn pump_virt_builder_stream<R: Read + Send + 'static>(
    r: R,
    prefix: &'static str,
    tx: mpsc::Sender<String>,
) {
    let br = BufReader::new(r);
    for line in br.lines().map_while(Result::ok) {
        let msg = if prefix.is_empty() {
            line
        } else {
            format!("{prefix}{line}")
        };
        if tx.send(msg).is_err() {
            break;
        }
    }
}

fn wait_child_interrupt_streams(
    mut child: Child,
    out_path: &Path,
    timeout: Option<Duration>,
) -> Result<()> {
    let limit = timeout.filter(|d| !d.is_zero());
    let deadline = limit.map(|d| Instant::now() + d);
    loop {
        if let Some(status) = child.try_wait().context("virt-builder try_wait")? {
            if !status.success() {
                let _ = fs::remove_file(out_path);
                bail!("virt-builder failed: {status:?}");
            }
            return Ok(());
        }
        if let (Some(end), Some(lim)) = (deadline, limit) {
            if Instant::now() >= end {
                let _ = child.kill();
                let _ = child.wait();
                let _ = fs::remove_file(out_path);
                bail!("virt-builder exceeded time limit of {:?}", lim);
            }
        }
        thread::sleep(Duration::from_millis(200));
    }
}

fn run_virt_builder_child(
    mut cmd: Command,
    out_path: &Path,
    timeout: Option<Duration>,
    log: &mut dyn FnMut(&str),
) -> Result<()> {
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    log("[virt-image-build] starting virt-builder (streaming stdout/stderr)");
    if let Some(t) = timeout.filter(|d| !d.is_zero()) {
        log(&format!(
            "[virt-image-build] wall-clock limit: {}s",
            t.as_secs()
        ));
    }
    let mut child = cmd.spawn().context("failed to spawn virt-builder")?;
    let stdout = child.stdout.take().context("virt-builder stdout")?;
    let stderr = child.stderr.take().context("virt-builder stderr")?;

    let (tx, rx) = mpsc::channel::<String>();
    let tx_o = tx.clone();
    let h_out = thread::spawn(move || pump_virt_builder_stream(stdout, "", tx_o));
    let tx_e = tx.clone();
    let h_err = thread::spawn(move || pump_virt_builder_stream(stderr, "[stderr] ", tx_e));
    drop(tx);

    for line in rx {
        log(&line);
    }
    let _ = h_out.join();
    let _ = h_err.join();

    wait_child_interrupt_streams(child, out_path, timeout)?;
    log("[virt-image-build] virt-builder finished successfully");
    Ok(())
}

/// Run `virt-builder` with the given request (blocking). Each stdout/stderr line is passed to `log`.
pub fn build_disk_image_with_logs(req: &BuildDiskRequest, mut log: impl FnMut(&str)) -> Result<()> {
    check_virt_builder()?;

    let out_path = validate_output_path(&req.output)?;
    let os = req.os.trim();
    if os.is_empty() {
        bail!("os must be non-empty");
    }

    let root_pw = resolve_root_password(req)?;
    let ssh_inject = resolve_ssh_inject(req)?;

    if root_pw.is_none() && ssh_inject.is_none() {
        bail!("provide root_password_file, root_password_inline, ROOT_PASSWORD env, and/or ssh_pubkey_file / ssh_pubkey_inline");
    }

    let mut cmd = Command::new("virt-builder");
    cmd.arg(os)
        .arg("--format")
        .arg(req.format.trim())
        .arg("--output")
        .arg(&req.output)
        .arg("--size")
        .arg(req.size.trim())
        .arg("--hostname")
        .arg(req.hostname.trim());

    if req.update {
        cmd.arg("--update");
    }
    if req.selinux_relabel {
        cmd.arg("--selinux-relabel");
    }

    for pkg in req
        .install
        .split(',')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
    {
        cmd.arg("--install").arg(pkg);
    }

    for c in &req.run_command {
        let c = c.trim();
        if !c.is_empty() {
            cmd.arg("--run-command").arg(c);
        }
    }

    for spec in &req.copy_in {
        let spec = spec.trim();
        if !spec.is_empty() {
            cmd.arg("--copy-in").arg(spec);
        }
    }

    if let Some(ref inj) = ssh_inject {
        cmd.arg("--ssh-inject")
            .arg(format!("root:{}", inj.file_uri));
    }

    if let Some(ref pw) = root_pw {
        cmd.arg("--root-password").arg(&pw.file_uri);
    }

    if let Some(ref script) = req.firstboot_script {
        if script.trim().is_empty() {
            // skip
        } else {
            let script = Path::new(script.trim())
                .canonicalize()
                .with_context(|| format!("firstboot_script: {script}"))?;
            if !script.is_file() {
                bail!("firstboot_script must be a regular file");
            }
            let name = script
                .file_name()
                .and_then(|n| n.to_str())
                .context("firstboot script file name")?;
            let guest_path = format!("/root/{name}");
            cmd.arg("--copy-in")
                .arg(format!("{}:/root/", script.display()));
            cmd.arg("--run-command")
                .arg(format!("chmod +x {guest_path}"));
            cmd.arg("--firstboot").arg(&guest_path);
        }
    }

    cmd.args(&req.extra_virt_builder_args);

    let timeout = if req.timeout_secs > 0 {
        Some(Duration::from_secs(req.timeout_secs))
    } else {
        None
    };
    run_virt_builder_child(cmd, &out_path, timeout, &mut log)
}

/// Run `virt-builder` with the given request (blocking).
pub fn build_disk_image(req: &BuildDiskRequest) -> Result<()> {
    build_disk_image_with_logs(req, |_| {})
}
