// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! Browser ISO upload: filename validation and target-path resolution.
//!
//! This is the only place in the product that turns client-supplied text into a
//! filesystem write target, so the rules here are deliberately strict: the client
//! names a *file*, never a directory. The destination directory comes from
//! `[libvirt] iso_upload_dir` and is never influenced by the request.

use std::path::{Path, PathBuf};

use crate::LibvirtError;

/// Upper bound on the accepted filename length (ext4/xfs allow 255 bytes).
const MAX_FILENAME_LEN: usize = 255;

/// Reject anything that isn't a plain, self-contained ISO filename.
///
/// Path separators are rejected outright rather than stripped: a caller sending
/// `../../etc/cron.d/x.iso` has made a mistake or is probing, and silently
/// rewriting it to `x.iso` would hide that.
pub fn sanitize_iso_filename(raw: &str) -> Result<String, LibvirtError> {
    let name = raw.trim();
    if name.is_empty() {
        return Err(LibvirtError::Invalid("filename is required".into()));
    }
    if name.len() > MAX_FILENAME_LEN {
        return Err(LibvirtError::Invalid(format!(
            "filename must be at most {MAX_FILENAME_LEN} bytes"
        )));
    }
    if name.contains('/') || name.contains('\\') {
        return Err(LibvirtError::Invalid(
            "filename must not contain a path separator".into(),
        ));
    }
    if name == "." || name == ".." {
        return Err(LibvirtError::Invalid("invalid filename".into()));
    }
    // A leading dot hides the upload; a leading dash makes it argv-ambiguous for
    // any later shell-out (virt-install, qemu-img).
    if name.starts_with('.') || name.starts_with('-') {
        return Err(LibvirtError::Invalid(
            "filename must not start with '.' or '-'".into(),
        ));
    }
    if !name.to_ascii_lowercase().ends_with(".iso") {
        return Err(LibvirtError::Invalid(
            "only .iso uploads are accepted".into(),
        ));
    }
    // ".iso" alone has an empty stem.
    if name.len() == 4 {
        return Err(LibvirtError::Invalid("filename is required".into()));
    }
    let ok = |c: char| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-' | '+' | '(' | ')');
    if let Some(bad) = name.chars().find(|c| !ok(*c)) {
        return Err(LibvirtError::Invalid(format!(
            "filename contains an unsupported character: {bad:?} \
             (use letters, digits, and . _ - + parentheses)"
        )));
    }
    Ok(name.to_string())
}

/// Resolve the absolute write target for `raw_filename` inside `upload_dir`.
///
/// Returns the final path and the `.part` staging path the body streams into;
/// the caller renames staging → final only after the last byte lands, so a
/// half-written ISO is never visible to the browse/create paths.
pub fn resolve_upload_target(
    upload_dir: &str,
    raw_filename: &str,
    overwrite: bool,
) -> Result<(PathBuf, PathBuf), LibvirtError> {
    let name = sanitize_iso_filename(raw_filename)?;
    let dir = Path::new(upload_dir.trim());
    if !dir.is_absolute() {
        return Err(LibvirtError::Internal(format!(
            "iso_upload_dir must be an absolute path (got {})",
            dir.display()
        )));
    }
    let final_path = dir.join(&name);
    // Defence in depth: after joining a validated name the result must still sit
    // directly inside the upload dir. This catches a mis-set config as well.
    if final_path.parent() != Some(dir) {
        return Err(LibvirtError::Invalid("invalid filename".into()));
    }
    if !overwrite && final_path.exists() {
        return Err(LibvirtError::Invalid(format!(
            "{name} already exists — rename it or re-upload with overwrite"
        )));
    }
    let staging = dir.join(format!("{name}.part"));
    Ok((final_path, staging))
}

/// Bytes that must remain free after writing `expected_bytes`, so an upload can't
/// fill the pool filesystem and wedge every running VM.
const UPLOAD_FREE_SPACE_HEADROOM: u64 = 512 * 1024 * 1024;

/// Fail before the first byte when the filesystem clearly cannot hold the upload.
///
/// `expected_bytes` is the client's declared `Content-Length`; it is advisory
/// (the write loop enforces the real cap), so this is a courtesy check that
/// turns a mid-transfer ENOSPC into an immediate, readable error.
pub fn check_free_space(dir: &Path, expected_bytes: u64) -> Result<(), LibvirtError> {
    if expected_bytes == 0 {
        return Ok(());
    }
    let avail = crate::build_precheck::filesystem_avail_bytes(dir)?;
    let needed = expected_bytes.saturating_add(UPLOAD_FREE_SPACE_HEADROOM);
    if avail < needed {
        return Err(LibvirtError::Invalid(format!(
            "not enough free space in {}: need {} MiB (upload + headroom), {} MiB available",
            dir.display(),
            needed / (1024 * 1024),
            avail / (1024 * 1024)
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_typical_windows_iso_names() {
        for name in [
            "Win11_24H2_English_x64.iso",
            "ubuntu-24.04.1-live-server-amd64.iso",
            "virtio-win-0.1.240.iso",
            "Win11_24H2_x64(1).iso",
            "SLE+15.iso",
            "UPPERCASE.ISO",
        ] {
            assert!(sanitize_iso_filename(name).is_ok(), "should accept {name}");
        }
    }

    #[test]
    fn rejects_path_traversal() {
        for name in [
            "../../etc/cron.d/evil.iso",
            "/etc/passwd.iso",
            "..\\windows\\evil.iso",
            "sub/dir.iso",
        ] {
            assert!(sanitize_iso_filename(name).is_err(), "should reject {name}");
        }
    }

    #[test]
    fn rejects_non_iso_and_degenerate_names() {
        for name in ["", "   ", ".", "..", "payload.sh", "x.iso.sh", ".iso"] {
            assert!(sanitize_iso_filename(name).is_err(), "should reject {name}");
        }
    }

    #[test]
    fn rejects_hidden_and_dash_leading_names() {
        assert!(sanitize_iso_filename(".hidden.iso").is_err());
        assert!(sanitize_iso_filename("--checked-in.iso").is_err());
    }

    #[test]
    fn rejects_control_characters_and_nul() {
        assert!(sanitize_iso_filename("bad\0name.iso").is_err());
        assert!(sanitize_iso_filename("bad\nname.iso").is_err());
        assert!(sanitize_iso_filename("with space.iso").is_err());
    }

    #[test]
    fn rejects_overlong_names() {
        let long = format!("{}.iso", "a".repeat(300));
        assert!(sanitize_iso_filename(&long).is_err());
    }

    #[test]
    fn resolve_target_places_file_directly_in_upload_dir() {
        let (final_path, staging) =
            resolve_upload_target("/var/lib/libvirt/images/isos", "win11.iso", false).unwrap();
        assert_eq!(
            final_path,
            PathBuf::from("/var/lib/libvirt/images/isos/win11.iso")
        );
        assert_eq!(
            staging,
            PathBuf::from("/var/lib/libvirt/images/isos/win11.iso.part")
        );
    }

    #[test]
    fn resolve_target_rejects_traversal_and_relative_dir() {
        assert!(resolve_upload_target("/srv/isos", "../escape.iso", false).is_err());
        assert!(resolve_upload_target("relative/isos", "ok.iso", false).is_err());
    }
}
