# Apache Guacamole and libvirt (optional integration)

Virtspawn already ships **in-browser consoles**: noVNC and SPICE over WebSocket proxies, serial PTY, and SSH—see the main README. **Guacamole does not replace libvirt** or virtspawn lifecycle management; it is an optional HTML5 gateway if you want Apache Guacamole’s connection model (e.g. RDP to Windows guests, centralized Docker deployment, PostgreSQL-backed connections, or encrypted JSON auth).

Separation of roles:

| Layer | Responsibility |
|--------|----------------|
| **libvirt / QEMU** | Defines the VM; graphics devices and guest network live in domain XML—source of truth. |
| **Virtspawn** | VM lifecycle, APIs, RBAC, built-in console proxies (alternative to Guacamole for VNC/SPICE). |
| **Guacamole** | Browser HTTPS → `guacd` → **RDP**, **VNC**, or **SSH** to whatever endpoint the guest exposes—not a hypervisor API. |

References: [Apache Guacamole](https://guacamole.apache.org/), [Guacamole Docker install](https://guacamole.apache.org/doc/gug/guacamole-docker.html), [domain XML graphics](https://libvirt.org/formatdomain.html), [`virsh`](https://www.libvirt.org/manpages/virsh.html).

---

## Recommended mental model

- **libvirt manages the VM.**  
- **Guacamole provides browser access** by connecting to the guest’s remote-access endpoint (RDP, VNC, or SSH)—not by driving libvirt as a hypervisor manager.

Architecture:

```text
Browser
  → HTTPS
Guacamole web app
  → guacd
    → RDP / VNC / SSH
      → VM managed by libvirt
```

Official Docker stacks typically run `guacamole/guacamole`, `guacamole/guacd`, and a database for users and connections.

---

## Three practical patterns

1. **Windows guests**: enable **RDP** in the guest; point Guacamole at `guest-ip:3389`. Usually the best UX for desktop Windows.

2. **Linux desktop guests**: use **VNC** from QEMU/libvirt graphics, or SPICE; point Guacamole at the resolved host/port (often after `virsh domdisplay <name>` on the hypervisor).

3. **Headless Linux servers**: use **SSH** through Guacamole instead of a graphical console.

Common dashboard split: **RDP** (Windows), **VNC or SPICE** (Linux GUI), **SSH** (Linux servers).

---

## Making the VM reachable

### Option A: Windows via RDP

Enable Remote Desktop in Windows, ensure networking, connect Guacamole to `vm-ip:3389`. Avoids exposing arbitrary hypervisor VNC ports when you only need desktop access.

### Option B: QEMU/libvirt VNC on the host

Define graphics in domain XML, typically binding listen to loopback on the hypervisor:

```xml
<graphics type='vnc' autoport='yes' listen='127.0.0.1'>
  <listen type='address' address='127.0.0.1'/>
</graphics>
```

Inspect the endpoint with `virsh domdisplay <domain>`. Prefer **localhost or Unix sockets** on the libvirt host and place **Guacamole close to that host** so you do not publish raw VNC to the Internet.

Virtspawn’s own console proxy already assumes a similar security stance (HTTPS to the daemon, proxied graphics).

---

## Minimal Docker Compose (Guacamole upstream style)

Example layout (versions may drift—check current Guacamole docs):

```yaml
version: "3.8"

services:
  guacd:
    image: guacamole/guacd:1.6.0
    container_name: guacd
    restart: unless-stopped

  postgres:
    image: postgres:16
    container_name: guac-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: guacamole_db
      POSTGRES_USER: guacamole_user
      POSTGRES_PASSWORD: strongpassword
    volumes:
      - guac_pgdata:/var/lib/postgresql/data

  guacamole:
    image: guacamole/guacamole:1.6.0
    container_name: guacamole
    restart: unless-stopped
    depends_on:
      - guacd
      - postgres
    environment:
      GUACD_HOSTNAME: guacd
      POSTGRESQL_HOSTNAME: postgres
      POSTGRESQL_DATABASE: guacamole_db
      POSTGRESQL_USER: guacamole_user
      POSTGRESQL_PASSWORD: strongpassword
    ports:
      - "8080:8080"

volumes:
  guac_pgdata:
```

Initialize the DB schema per [PostgreSQL auth](https://guacamole.apache.org/doc/gug/postgresql-auth.html).

---

## Guacamole connections (one row per VM/method)

Guacamole models each session as protocol + parameters (host, port, credentials, etc.). Examples:

**Windows RDP**

```text
Protocol: RDP
Hostname: 192.168.122.50
Port: 3389
Username: Administrator
Password: ********
```

**Linux VNC (through Guacamole to libvirt-exposed VNC)**

```text
Protocol: VNC
Hostname: libvirt-host.example.com
Port: 5903
Password: ********
```

---

## Automating from a libvirt dashboard

A solid approach:

1. Query libvirt for VMs and state.
2. Decide access mode: guest IP + RDP vs graphics vs SSH.
3. Create or update Guacamole connection records—or avoid persisting every console.

**Approaches**

| Approach | When to use |
|----------|-------------|
| Write rows into Guacamole’s PostgreSQL/MySQL | Stable, long-lived connections |
| **HTTP header auth** | Your app already authenticates users |
| **Encrypted JSON auth** | Generate per-user, per-session connection definitions from libvirt metadata without filling the DB—good for dynamic dashboards |

See [HTTP header authentication](https://guacamole.apache.org/doc/gug/header-auth.html) and [Encrypted JSON authentication](https://guacamole.apache.org/doc/gug/json-auth.html).

High-level flow:

```text
User opens VM dashboard
  → backend authenticates
  → backend queries libvirt
  → backend chooses RDP / VNC / SSH
  → backend emits Guacamole connection definition (DB or JSON auth)
  → user lands in browser console
```

---

## Security notes

- Do **not** expose raw VNC ports publicly; bind to `127.0.0.1` or socket on the hypervisor and terminate TLS at Guacamole or virtspawn.
- Prefer **HTTPS only** on the gateway users hit.
- Guacamole supports LDAP, OpenID Connect, and other SSO methods for larger deployments.

---

## Integrated daemon API (recommended)

**virtspawn-daemon** exposes (when enabled):

`GET /api/v1/vms/{name}/guacamole-auth`

- Requires the same session cookie / API auth as other VM endpoints.
- Resolves VNC using the same libvirt path as the built-in console (`vnc::resolve_vnc_tcp`), then builds encrypted JSON per [encrypted JSON authentication](https://guacamole.apache.org/doc/gug/json-auth.html).
- Optionally POSTs to Guacamole `/api/tokens` and returns `token` when `[guacamole] fetch_token = true`.

**`/etc/virtspawn/config.toml`**

```toml
[guacamole]
enabled = true
json_secret_hex = "4c0b569e4c96df157eee1b65dd0e4d41"  # same 32 hex chars as Guacamole JSON_SECRET_KEY
base_url = "http://127.0.0.1:8080/guacamole"
public_vnc_host = "192.168.122.1"   # optional: when VNC listen is loopback, rewrite for guacd
fetch_token = true
json_username = "virtspawn"
```

The VM must be **running** with **VNC** graphics (not SPICE-only). Guacamole/`guacd` must reach `target_host:target_port` from the JSON.

**Example**

```bash
curl -fsS -b session=… "https://localhost:5092/api/v1/vms/myvm/guacamole-auth" | jq
```

## Optional standalone binary: `libvirt-guac-bridge`

The **`guac-bridge/`** crate also builds a small HTTP service for hosts that only need `virsh domdisplay` + JSON auth without the full daemon:

- **`GET /bridge/{vm}`** — uses `virsh domdisplay` (not the libvirt Rust API).
- Env: `GUAC_SECRET_HEX`, `GUAC_BASE_URL`, `PUBLIC_VNC_HOST`, `LISTEN`, `GUAC_FETCH_TOKEN`, `GUAC_JSON_USERNAME`.

```bash
cargo run -p libvirt-guac-bridge --release
curl -s "http://127.0.0.1:3000/bridge/myvm" | jq
```

---

## Relation to virtspawn

- **Guacamole + `guacd`**: deploy next to the hypervisor; virtspawn keeps VM lifecycle and RBAC.
- **Avoid** driving libvirt from Guacamole; session auth stays with virtspawn + optional Guacamole SSO.

---

## Minimal MVP

1. One Windows VM on libvirt with RDP enabled.  
2. Guacamole via Docker + DB init.  
3. One manual RDP connection proving path.  
4. Automate connection creation from your dashboard when ready.
