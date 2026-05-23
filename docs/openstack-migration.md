# OpenStack migration (libvirt qcow2 ↔ Glance)

machina supports **native** qcow2 → Glance upload from the daemon (Rust + Keystone session), plus day-2 Nova UX. For instance list/create/snapshot, see [openstack.md](openstack.md).

## Push: hypervisor qcow2 → Glance

| API | Purpose |
|-----|---------|
| `GET /api/v1/openstack/images/upload/preview?qcow2_path=…` | Size, suggested Glance name, disk format |
| `POST /api/v1/openstack/images/upload` | Upload qcow2; optional boot Nova instance after upload |

Body fields: `qcow2_path` (required), `glance_name`, `visibility`, `boot_instance`, `flavor`, `network`, `key_name`, `instance_name`.

Requires `[openstack] upload_enabled = true` and qcow2 on an allowed disk-images path.

## Web UI

On **Disk images**, qcow2 rows include **Upload to OpenStack**. From an instance detail page, **Push qcow2 to Glance** opens the modal with the instance name prefilled.

## Pull: OpenStack → libvirt

1. Snapshot the instance (Nova → Glance) from instance detail, or export with **HyperSDK** / hyper2kvm for a full qcow2.
2. Place the qcow2 on an allowed disk-images path.
3. Use **Import VM** or **Create VM** with an existing disk.

## Config (`/etc/machina/config.toml`)

| Key | Purpose |
|-----|---------|
| `upload_enabled` | Allow `POST /api/v1/openstack/images/upload` |
| `upload_timeout_secs` | Large image upload timeout |
| `cloud_name` / `clouds_yaml_path` | Keystone via clouds.yaml |
| `default_flavor`, `default_network`, `default_key_name` | Create wizard defaults |

Wire script: `sudo /usr/local/share/machina/scripts/openstack-wire-cloud.sh /root/keystonerc_admin packstack`

## HyperSDK

Use hypervisord (`https://<host>:5080/web/dashboard/`) for `list_provider_vms`, `submit_migration`, and bulk export from OpenStack **source** VMs. Machina does not proxy those APIs.
