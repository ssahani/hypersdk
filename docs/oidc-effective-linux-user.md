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

Today’s behavior is **policy alignment**: routes can require “this OIDC identity maps to a real local account” before allowing certain operations. The daemon does **not** switch its effective UID or spawn libvirt/tooling as that user.

## Future: run-as-user (not implemented)

To actually run libvirt or helpers as the mapped UNIX user would require an explicit design, for example:

- A setuid helper or polkit-backed action runner acceptable to your threat model
- Per-session credential bridging where technically feasible
- Clear audit events tying OIDC subject → chosen local user → executed command

Until then, treat `effective_linux_user` as authorization context, not execution identity.
