# Zeus ConsoleHub architecture

ConsoleHub is the unified VM console product surface inside Zeus OS. It is **not** a separate remote-desktop product: native noVNC/SPICE/serial/SSH remain first-class, and Apache Guacamole is an optional **protocol gateway backend** for RDP, SSH, and VNC fallback.

## Layers

| Layer | Role |
|-------|------|
| **ConsoleHub UI** | Single shell: VM context, protocol tabs, embedded session, AI companion, audit metadata |
| **Native console** | noVNC / SPICE / serial via machina-daemon or controller→agent WebSocket proxies |
| **Guacamole gateway** | RDP, SSH, VNC when embedded via same-origin reverse proxy |
| **Access security** | RBAC, JIT approvals, session audit, optional recording (Phases 2–5) |
| **Marketplace plugins** | Kasm, RustDesk, MeshCentral — optional workloads, not core console |

## Request flow (platform)

```text
Browser → ConsoleHub page
  → GET /api/v1/vms/{id}/consolehub/plan   (controller → agent GetConsoleAccessPlan)
  → POST /api/v1/vms/{id}/consolehub/sessions  (Guacamole sessions only)
  → /consolehub/guacamole/{sessionId}/…    (controller reverse proxy → agent → localhost Guacamole)
  → /ws/v1/platform/vnc/{id}               (native noVNC)
```

## Protocol routing (deterministic)

| Signal | Default |
|--------|---------|
| Linux + VNC graphics | **noVNC** (native) |
| Windows guest / RDP | **Guacamole RDP** (embedded) |
| Headless Linux | **SSH** (native xterm or Guacamole SSH) |
| SPICE | **SPICE native**; **webrtc_spice** tab when available (Phase 3) |
| Serial / recovery | **Serial native** |

Emergency **Open in new tab** is available only when embedded Guacamole fails (clipboard, keyboard capture, browser policy).

## Install

Guacamole stack (optional, per hypervisor):

```bash
sudo bash install.sh --with-guacamole
# or
sudo bash scripts/install-guacamole.sh --install-docker
```

Configure controller env (optional):

```bash
export GUACAMOLE_JSON_SECRET_HEX=<32 hex digits matching host guacamole.env>
export CONSOLEHUB_REQUIRE_APPROVAL=0   # set 1 for JIT approval workflow
export CONSOLEHUB_RECORDING_ENABLED=0
```

Per-host overrides: `hosts.guacamole_base_url`, `hosts.guacamole_json_secret_hex` (migration `043_consolehub.sql`).

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/vms/{id}/consolehub/plan` | ConsoleHubPlan (recommended protocol, native WS path, Guacamole availability) |
| POST | `/api/v1/vms/{id}/consolehub/sessions` | Create short-lived session (native or Guacamole) |
| POST | `/api/v1/consolehub/sessions/{id}/end` | End session + audit |
| POST | `/api/v1/vms/{id}/consolehub/access-requests` | JIT access request (Phase 5) |
| POST | `/api/v1/consolehub/access-requests/{id}/approve` | Approve JIT request (operator+) |
| * | `/consolehub/guacamole/{sessionId}/{*path}` | Same-origin Guacamole reverse proxy |

Legacy `GET /api/v1/vms/{id}/console` remains for compatibility.

## UI routes

| Route | Purpose |
|-------|---------|
| `/platform/vms/:id/consolehub` | Platform ConsoleHub (primary) |
| `/platform/vms/:id/console` | Redirect → consolehub |
| `/vms/:name/consolehub` | Classic single-host ConsoleHub |
| `/vms/:name/console` | Redirect → consolehub |

## Phased roadmap

1. **Phase 1 (shipped):** ConsoleHub shell, noVNC default, embedded Guacamole RDP/SSH/VNC, same-origin proxy
2. **Phase 2:** `console_sessions` audit, RBAC by protocol, recording metadata, approval hooks
3. **Phase 3:** WebRTC/SPICE high-performance tab
4. **Phase 4:** Kasm / RustDesk / MeshCentral as Marketplace plugins
5. **Phase 5:** Zeus Zero Trust Access — JIT requests, break-glass, federation hooks

## Remaining work (post-MVP)

| Item | Status |
|------|--------|
| Classic single-host ConsoleHub shell (daemon-only, no controller) | Partial — `/vms/:name/consolehub` reuses legacy `Console.tsx` |
| Daemon `/consolehub` proxy for non-platform installs | Not started |
| KubeVirt console in ConsoleHub | **Shipped** — serial lens uses KubeVirt subresource WS; display lens uses KubeVirt VNC when `inventory_source=kubevirt` |
| OpenAPI regen for consolehub endpoints | **Shipped** — `node scripts/generate-openapi.mjs` |
| Playwright `@playwright/test` ≥1.61 stable | Pending — suppress DEP0205 via `playwright-node-env.ts` until then |
| Guacamole HTML asset rewrite under proxy | Needs live-stack validation |
| Session history UI (`GET …/consolehub/sessions`) | **Shipped** — Command Center Overview tab |
| OIDC/SAML federation for console auth (Phase 5) | Future |
