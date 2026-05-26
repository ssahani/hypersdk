# OIDC, PAM, and local Linux user alignment

Machina distinguishes three strings:

- **Session username** — what the UI and RBAC use (`RequestActor.username`).
- **Effective Linux user** — optional mapping used for sudo-gated host actions and optional `qemu:///session` policy (`RequestActor.effective_linux_user`).
- **Daemon OS identity** — the UNIX user running `machina-daemon`; libvirt connections still use this process identity unless a future run-as-user mechanism exists.

## Defaults (out of the box)

| Auth path | Session username | Effective Linux user |
|-----------|------------------|----------------------|
| **PAM (password)** | The login name you typed | Always `Some(<login name>)` — same string as the session username |
| **OIDC** | From IdP claims: `username_claim` (default `preferred_username`), else `email`, else `sub` | Candidate from `linux_username_claim` (default `preferred_username`), then `username_claim`, then the resolved session username — **kept only if** that string exists on the host (`getent passwd` after username validation) |

Config defaults (`OidcConfig::default()`):

- `username_claim` = `preferred_username`
- `linux_username_claim` = `preferred_username` (same default key; override either when your IdP uses a dedicated Unix login claim)
- `require_local_user_for_session_libvirt` = `false` (set `true` to reject `qemu:///session` VM creation when no mapped local user exists)

There is **no fixed default OIDC “Unix username”** across deployments: it is whatever your IdP puts in those claims. If the candidate does not exist locally, `effective_linux_user` is `None` even though the browser session is valid.

## Policy alignment vs impersonation

Today’s behavior is **policy alignment** plus optional **run-as-user** for allow-listed host commands. See [`oidc-run-as-user.md`](oidc-run-as-user.md).

When `[auth.run_as_user]` is enabled with `sudo`, `polkit`, or `setuid_helper`:

- `POST/DELETE /api/v1/system/os-users` runs `useradd` / `userdel` / `homectl` as `effective_linux_user`
- With `prefer_session_libvirt_on_impersonation` and dual libvirt, VM create defaults to `qemu:///session`

The daemon process still owns the libvirt connection unless you use session URI; libvirt XML is not executed as the mapped user except via that session default.

Status: `GET /api/v1/auth/run-as-user`
