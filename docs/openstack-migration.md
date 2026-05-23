# OpenStack migration (libvirt qcow2 ↔ Glance)

Machina supports **native** Glance upload and download in `machina-daemon` (Rust + Keystone). **hyper2kvm** is optional for libvirt push when you want guest-fix + manifest-style deploy. For Nova day-2 UX, see [openstack.md](openstack.md).

## Push: hypervisor qcow2 → Glance

### Disk file on host

| API | Purpose |
|-----|---------|
| `GET /api/v1/openstack/images/upload/preview?qcow2_path=…` | Size, suggested Glance name, disk format |
| `POST /api/v1/openstack/images/upload` | Upload qcow2; optional boot Nova instance after upload |

Body fields: `qcow2_path` (required), `glance_name`, `visibility`, `boot_instance`, `flavor`, `network`, `key_name`, `instance_name`, `security_groups`, `availability_zone`, `wait_until_active`.

Requires `[openstack] upload_enabled = true` and qcow2 on an allowed disk-images path.

### Running libvirt VM

| API | Purpose |
|-----|---------|
| `GET /api/v1/vms/{name}/openstack-push/preview` | Root disk path, running state, Glance name hint |
| `POST /api/v1/vms/{name}/openstack-push` | Same upload fields as above, plus `stop_vm`, `use_hyper2kvm`, `guest_fix` |

Native push uploads the VM root disk via Glance API. With `use_hyper2kvm: true`, the daemon runs `h2kvmctl` with generated YAML (`deploy_openstack`, optional guest fixes).

## Web UI

- **Disk images** — qcow2 rows: **Upload to OpenStack**
- **VM detail** — **Push to OpenStack** (when upload is enabled)
- **OpenStack → Instances** — snapshot, then pull from Glance images

## Pull: Glance → hypervisor → libvirt

| API | Purpose |
|-----|---------|
| `POST /api/v1/openstack/images/{id}/pull` | Stream `GET images/{id}/file` to `dest_path` (allowed disk-images prefix) |

Body: `dest_path`, optional `wait_for_active`.

**Web:** **OpenStack → Glance images** → download icon → **Import as libvirt VM** links to `/import?disk=…`.

Manual path: snapshot or HyperSDK export → qcow2 on host → **Import VM** or **Create VM** with existing disk.

## Config (`/etc/machina/config.toml`)

| Key | Purpose |
|-----|---------|
| `upload_enabled` | Allow Glance upload and libvirt VM push APIs |
| `upload_timeout_secs` | Large image upload timeout |
| `default_wait_until_active` | Default for upload/pull wait-for-ACTIVE |
| `cloud_name` / `clouds_yaml_path` | Keystone via clouds.yaml |
| `default_flavor`, `default_network`, `default_key_name` | Create wizard defaults |

Wire script: `sudo /usr/local/share/machina/scripts/openstack-wire-cloud.sh /root/keystonerc_admin packstack`

## HyperSDK

Use hypervisord (`https://<host>:5080/web/dashboard/`) for `list_provider_vms`, `submit_migration`, and bulk export from OpenStack **source** VMs. Machina does not proxy those APIs.
