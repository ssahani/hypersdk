# OIDC run-as-user

Machina maps OIDC identities to an **effective Linux user** for authorization and, when enabled, runs allow-listed host commands as that user.

## Config

```toml
[auth.run_as_user]
enabled = false
mode = "disabled"   # disabled | sudo | polkit | setuid_helper
setuid_helper_path = "/usr/local/libexec/machina-run-as-user"
prefer_session_libvirt_on_impersonation = false
```

| Field | Meaning |
|-------|---------|
| `enabled` | Turn on impersonation for supported routes |
| `mode` | `sudo`, `polkit`, or `setuid_helper` |
| `setuid_helper_path` | Setuid helper binary (see `contrib/run-as-user/README.md`) |
| `prefer_session_libvirt_on_impersonation` | When `[libvirt] dual_connection = true`, default VM create to `qemu:///session` for mapped OIDC users |

Status: `GET /api/v1/auth/run-as-user`

### `sudo` mode

`sudo -n -u <effective_linux_user> -- <allow-listed program>`

Host requirements: passwordless sudo for allow-listed programs (`useradd`, `userdel`, `usermod`, `homectl`, `chpasswd`, `id`, `getent`).

### `polkit` mode

`pkexec --user <effective_linux_user> -- <allow-listed program>`

```bash
sudo cp contrib/polkit/machina-run-as-user.rules /etc/polkit-1/rules.d/50-machina-run-as-user.rules
```

### `setuid_helper` mode

`<setuid_helper_path> <effective_linux_user> <program> [args…]`

Install: `contrib/run-as-user/README.md`

## Supported routes today

- `POST/DELETE /api/v1/system/os-users` — OS account lifecycle as the mapped user
- `POST /api/v1/vms` (and `/vms/stream`) — optional session libvirt default when `prefer_session_libvirt_on_impersonation` is set

## Related docs

- [`oidc-effective-linux-user.md`](oidc-effective-linux-user.md) — mapping claims to local users
- [`macos-build.md`](macos-build.md) — building the daemon without Linux PAM

## Out of scope

- Arbitrary libvirt XML execution as the mapped user without session URI policy
- Credential caching across unrelated OIDC sessions
- Multi-tenant isolation beyond single-host RBAC
