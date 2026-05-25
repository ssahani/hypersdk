# OIDC run-as-user (design + config scaffold)

Machina today maps OIDC identities to an **effective Linux user** for **authorization** (sudo-gated host actions, optional `qemu:///session` policy). The daemon still runs libvirt and helpers as its own OS user.

This document describes the planned **execution** model and the config scaffold added in `[auth.run_as_user]`.

## Config (scaffold)

```toml
[auth.run_as_user]
enabled = false
mode = "disabled"   # disabled | sudo | polkit | setuid_helper
```

### `sudo` mode (implemented)

When `enabled = true` and `mode = "sudo"`, OS user create/delete (`POST/DELETE /api/v1/system/os-users`) runs as:

`sudo -n -u <effective_linux_user> -- <useradd|userdel|homectl|…>`

Requirements on the host:

- Passwordless sudo for the mapped user for allow-listed programs (`useradd`, `userdel`, `usermod`, `homectl`, `chpasswd`, `id`, `getent`)
- Caller session must map to a local user in `wheel`/`sudo`/`admin` (existing policy)

| Field | Meaning |
|-------|---------|
| `enabled` | Operator intent to use impersonation when implemented |
| `mode` | Intended backend (`polkit` or `setuid_helper`) |

When `enabled = true` and `mode` is not `disabled`, the daemon logs a **startup warning** and continues in policy-only mode until a runner exists.

## Requirements for a real implementation

1. **Threat model** — document who may impersonate whom; audit every `OIDC sub → local user → command`.
2. **Runner** — one of:
   - **polkit** — `org.machina.run-as-user` action reviewed by distribution policy;
   - **setuid helper** — minimal C/Rust binary that drops privileges and execs allow-listed commands.
3. **Scope** — start with host actions (systemd, file browse), not arbitrary libvirt XML from the browser.
4. **Session bridge** — map `RequestActor.effective_linux_user` to the runner; never trust client-supplied usernames.
5. **Failure modes** — clear errors when mapping is missing, polkit denies, or helper is absent.

## Related docs

- [`oidc-effective-linux-user.md`](oidc-effective-linux-user.md) — current policy alignment vs impersonation
- [`ux.md`](ux.md) — web error and banner patterns

## Out of scope (initial delivery)

- Automatic libvirt URI switch to `qemu:///session` under impersonation
- Credential caching across unrelated OIDC sessions
- Multi-tenant isolation beyond single-host RBAC
