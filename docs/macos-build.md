# Building Machina on macOS

`machina-core`, `machina-tui`, and most workspace crates build on macOS. **`machina-daemon` is intended for Linux production hosts** but can be compiled on macOS for API/UI development when PAM is not required.

## Daemon without PAM

The daemon links Linux PAM only on `target_os = "linux"`. On macOS:

- **OIDC / LDAP / API tokens** work for authentication.
- **Password login** (`POST /api/v1/auth/login`) returns `503` with `pam_unavailable` unless LDAP is configured.

Build:

```bash
cargo build -p machina-daemon
```

For full PAM-backed password login and libvirt session integration, build and run on Linux.

## libvirt / virt

Host VM management requires libvirt on Linux. macOS builds are useful for frontend and route development against a remote daemon.
