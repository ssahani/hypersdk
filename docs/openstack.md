# OpenStack in Machina

Machina manages OpenStack Nova instances and Glance images from the same UI as libvirt VMs—without Horizon. Credentials stay on the daemon host (`clouds.yaml`, config file, or `OS_*`); they are never stored in the browser.

## First-boot checklist

1. Install or finish OpenStack on the host (Packstack, RDO, DevStack, etc.) and confirm Keystone answers on port 5000.
2. Wire Machina to the cloud:
   ```bash
   sudo /usr/local/share/machina/scripts/openstack-wire-cloud.sh /root/keystonerc_admin packstack
   sudo systemctl restart machina-daemon
   ```
3. In the Machina UI: **Settings → OpenStack connection → Test connection** (or `POST /api/v1/openstack/test-connection`).
4. Open **OpenStack → Instances** (nav appears only when `platform-info` reports enabled + configured).
5. Optional: set `[openstack] upload_enabled = true` for **Disk images → Upload to OpenStack** (native Glance upload in machina-daemon).

Smoke on the host:

```bash
source /root/keystonerc_admin && openstack server list
curl -sk https://127.0.0.1:5092/api/v1/openstack/status
```

## HyperSDK / OpenStack CLI compatibility

Machina uses the same Keystone v3 mental model as HyperSDK and `openstack` CLI:

| Machina `[openstack]` | HyperSDK / `OS_*` |
|----------------------|-------------------|
| `auth_url` | `OS_AUTH_URL` |
| `username` | `OS_USERNAME` |
| `password` | `OS_PASSWORD` |
| `project_name` (alias **`tenant`**) | `OS_PROJECT_NAME` / `OS_TENANT_NAME` |
| `domain_name` | `OS_USER_DOMAIN_NAME` |
| `region` | `OS_REGION_NAME` |
| `cloud_name` + `clouds_yaml_path` | `clouds.yaml` cloud entry |
| `default_os_cloud` | default cloud when `cloud_name` is empty |

After Packstack or any OpenStack install, run on the host:

```bash
sudo ./scripts/openstack-wire-cloud.sh /root/keystonerc_admin packstack
```

That writes `/etc/openstack/clouds.yaml`, `/etc/machina/openstackrc`, and updates `[openstack]` in machina config. The daemon loads `EnvironmentFile=-/etc/machina/openstackrc` (see `contrib/machina-daemon.service`).

## Connection

Enable management in `/etc/machina/config.toml` (or `~/.machina/config.toml`):

```toml
[openstack]
enabled = true
cloud_name = "mycloud"
clouds_yaml_path = "~/.config/openstack/clouds.yaml"
connect_timeout_secs = 30

# Or inline Keystone v3 (do not commit passwords):
# auth_url = "https://controller:5000/v3"
# username = "admin"
# password = "secret"
# project_name = "demo"
# domain_name = "Default"

# Or use openrc / OS_* on the daemon host:
# use_env_auth = true
```

**Settings → OpenStack connection** runs `POST /api/v1/openstack/test-connection` to validate auth.

| API | Purpose |
|-----|---------|
| `GET /api/v1/openstack/status` | configured, cloud name, reachable, last error |
| `POST /api/v1/openstack/test-connection` | validate credentials |

## Instance UI

| Nav | Path |
|-----|------|
| OpenStack | `/openstack/instances` — list, search, start/stop/reboot (nav when configured) |
| Instance detail | `/openstack/instances/{id}` — lifecycle, console, FIPs, Cinder attach/detach, resize, security groups, export |
| Create wizard | `/openstack/create` — image, flavor, network, keypair, AZ, security groups (defaults from config) |
| Glance images | `/openstack/images` — linked from Instances header |

Lifecycle APIs:

- `GET /api/v1/openstack/instances` — query `search`, `status`
- `GET /api/v1/openstack/instances/{id}`
- `POST .../start`, `.../stop`, `.../reboot` — body `{ "reboot_type": "soft" \| "hard" }`
- `POST .../pause`, `.../unpause`, `.../suspend`, `.../resume`
- `POST .../resize` — body `{ "flavor": "<flavor id or name>" }` (auto-confirms resize)
- `GET .../console-output?lines=100` — serial console log tail
- `GET .../console?type=novnc` — remote console URL (`novnc`, `spice`, `serial`, `rdp`)
- `POST .../snapshot` — body `{ "image_name": "..." }` (Nova createImage → Glance)
- `POST .../export` — body `{ "image_name": "..." }` — snapshot + export steps for libvirt pull
- `DELETE .../instances/{id}`

Volumes & networking:

- `GET /api/v1/openstack/volumes` — Cinder volumes (attach picker)
- `GET .../instances/{id}/volumes` — attachments for one instance
- `POST .../instances/{id}/volumes/attach` — body `{ "volume_id": "..." }`
- `DELETE .../instances/{id}/volumes/{volume_id}`
- `GET /api/v1/openstack/floating-ips` — project floating IPs
- `GET .../instances/{id}/floating-ips`
- `POST .../instances/{id}/floating-ips` — body `{ "floating_network": "..." }` or `{ "floating_ip_id": "..." }`
- `POST /api/v1/openstack/floating-ips/{id}/dissociate`
- `POST .../security-groups` — body `{ "name": "..." }`
- `POST .../security-groups/remove` — body `{ "name": "..." }`

Catalog APIs for the create wizard:

- `GET /api/v1/openstack/flavors`
- `GET /api/v1/openstack/networks`
- `GET /api/v1/openstack/images`
- `POST /api/v1/openstack/images/{id}/pull` — download image file to hypervisor path
- `DELETE /api/v1/openstack/images/{id}` — Glance image delete
- `GET /api/v1/vms/{name}/openstack-push/preview` — libvirt VM push preview
- `POST /api/v1/vms/{name}/openstack-push` — upload VM root disk (native or hyper2kvm)
- `GET /api/v1/openstack/keypairs`
- `POST /api/v1/openstack/instances` — create instance (optional `availability_zone`, `security_groups`, `user_data`)

Audit events: `openstack.instance.*`, `openstack.image.upload`, `openstack.image.delete`.

## Disk migration (libvirt ↔ cloud)

See [openstack-migration.md](openstack-migration.md) for full API tables.

| Direction | API / UI |
|-----------|----------|
| qcow2 → Glance | `POST /api/v1/openstack/images/upload` — **Disk images** modal |
| libvirt VM → Glance (+ optional Nova) | `POST /api/v1/vms/{name}/openstack-push` — **VM detail → Push to OpenStack** |
| Glance → qcow2 on host | `POST /api/v1/openstack/images/{id}/pull` — **Glance images** pull modal |
| qcow2 → libvirt domain | `/import?disk=…` or **Create VM** with existing disk |

Optional `use_hyper2kvm` on VM push delegates to hyper2kvm for guest-fix and deploy parity with hyper2kvm CLI. HyperSDK (`list_provider_vms`, `submit_migration`) remains the path for bulk migrations from hypervisord.

## Packaging

- Rust `openstack` crate (Nova/Glance/Neutron) in `machina-core`; no extra system packages beyond HTTPS.
- Optional: `python3-openstackclient` on the host for debugging; Glance upload uses machina-core when `[openstack] upload_enabled = true`.

## What stays in Horizon / `osc` (not in v1)

- Neutron topology editor, Heat stacks, Octavia load balancers, identity project admin
- Proxying all HyperSDK APIs through machina-daemon (use hypervisord :5080 dashboard instead)

TUI commands (`:` prefix): `openstack` / `os` (status), `openstack list`, `openstack start|stop|delete <id>`.

Neutron topology editing, Heat, Octavia, identity project admin—use Horizon or the OpenStack CLI for those tasks.
