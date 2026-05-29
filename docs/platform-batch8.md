# Platform batch 8 — HA, OIDC, IPMI, webhook retries

## OIDC + JWT login

Configure on **Platform → Settings** or via API:

| Env | Purpose |
|-----|---------|
| `MACHINA_JWT_SECRET` | Sign session JWTs after OIDC login |
| `MACHINA_PUBLIC_URL` | Controller URL for OIDC redirect (default `http://127.0.0.1:5093`) |
| `MACHINA_WEB_URL` | Web UI URL for post-login redirect (default `http://127.0.0.1:5173`) |

**Flow:** User clicks **Login with OIDC** → IdP → `GET /api/v1/auth/oidc/callback` → JWT stored in browser → API calls use `Authorization: Bearer`.

**API:**
- `GET /api/v1/auth/oidc/login` — JSON `{ authorize_url, state }`
- `GET /api/v1/auth/oidc/redirect` — browser redirect to IdP
- `GET /api/v1/auth/oidc/callback?code=&state=` — completes login (HTML → web UI)
- `PATCH /api/v1/auth/oidc` — issuer, client_id, client_secret, redirect_uri, enabled

JWT tokens are also accepted alongside API keys and Basic auth.

## Controller HA (leader election)

PostgreSQL lease in `controller_leadership`. Only the **leader** runs:

- HA recovery scans
- DRS auto-migrate
- Maintenance schedule runner
- Webhook delivery worker

**Health:** `GET /api/v1/health` includes `leader: true/false` and `controller_id`.

| Env | Purpose |
|-----|---------|
| `MACHINA_CONTROLLER_ID` | Unique instance id (default random `ctrl-…`) |
| `NATS_URL` | Optional task fan-out to other controllers |

Run multiple controller processes against the same DB; one becomes leader.

## IPMI / STONITH fencing

Per-host fence config (`PATCH /api/v1/hosts/{id}`):

- `fence_method`: `shell` (default) or `ipmi`
- `ipmi_address`, `ipmi_username`, `ipmi_password`

Agent runs `ipmitool -I lanplus -H … power off` when method is `ipmi`, otherwise `MACHINA_FENCE_COMMAND` shell template.

## Webhook delivery retries

Webhooks are queued in `webhook_deliveries` with exponential backoff (max 5 attempts). A background worker on the leader delivers pending rows and records failures.

HMAC signing (`X-Machina-Signature: sha256=…`) is unchanged.

See [`platform.md`](platform.md) for the full API reference.
