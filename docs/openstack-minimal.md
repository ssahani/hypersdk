# Minimal OpenStack for Machina (Keystone-only POC)

For UI and wiring tests you only need **Keystone** answering on port **5000**. Full Packstack (Nova, Neutron, Horizon, Swift, …) is not required to validate Machina’s OpenStack integration phases.

## What Machina checks

| Check | Needs |
|-------|--------|
| `platform-info` → OpenStack configured | `[openstack] enabled`, `clouds.yaml` or inline auth in `config.toml` |
| `GET /openstack/status` → `reachable: true` | Keystone identity auth works |
| `compute_reachable` / `glance_reachable` | Nova `list_servers` / Glance `list_images` succeed |
| Instances / create / Glance upload | Nova, Neutron, Glance (full cloud) |

A **Keystone-only** host shows **live** in the UI (Hero, Dashboard) with Nova/Glance marked off in the status bar. Instance and Glance upload flows require `compute_reachable` / `glance_reachable`.

## Minimal install (CentOS Stream 9 + Caracal)

On the hypervisor (as root):

```bash
dnf config-manager --set-enabled crb
dnf install -y centos-release-openstack-caracal
dnf install -y mariadb-server httpd openstack-keystone python3-openstackclient

systemctl enable --now mariadb
mysql -e "CREATE DATABASE keystone;"
mysql -e "GRANT ALL ON keystone.* TO 'keystone'@'localhost' IDENTIFIED BY 'KEYSTONE_DB_PW';"
mysql -e "GRANT ALL ON keystone.* TO 'keystone'@'%' IDENTIFIED BY 'KEYSTONE_DB_PW';"

# Configure keystone (see RDO install guide for full keystone.conf), then:
keystone-manage db_sync
keystone-manage bootstrap \
  --bootstrap-password ADMIN_PW \
  --username admin \
  --email admin@localhost

# httpd WSGI on 5000 (Packstack leaves /etc/httpd/conf.d/10-keystone_wsgi.conf)
systemctl enable --now httpd
```

Or stop a full Packstack run once **Keystone listens on 5000** and wire Machina (see below).

## Wire Machina

```bash
sudo ./scripts/openstack-wire-cloud.sh /root/keystonerc_admin packstack
sudo systemctl restart machina-daemon
```

Verify Keystone:

```bash
source /root/keystonerc_admin
openstack token issue
curl -s http://127.0.0.1:5000/v3/ | head
```

Verify Machina (after UI login):

```bash
curl -sk -b /tmp/machina-cookies.txt -c /tmp/machina-cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"username":"root","password":"..."}' \
  https://127.0.0.1:5092/api/v1/auth/login

curl -sk -b /tmp/machina-cookies.txt https://127.0.0.1:5092/api/v1/openstack/status
```

Expect `reachable: false` until Nova/Glance are installed; `connected` may still be true if Keystone auth works but compute/image lists fail.

## Avoid port 80 conflicts

HyperSDK / hyper2kvm often uses **80/443**. Packstack Horizon also wants 80. For minimal tests:

- Set `CONFIG_HORIZON_INSTALL=n` in Packstack answers, **or**
- Stop `h2kweb` only for the Packstack run, then restart it after httpd is configured to share ports.

Keystone itself uses **httpd on 5000** only.

## Minimal Nova + Glance bootstrap

When Packstack stopped after Keystone but left `httpd` WSGI configs:

```bash
sudo ./scripts/openstack-minimal-services.sh /root/keystonerc_admin 212.8.252.194
sudo ./scripts/openstack-wire-cloud.sh /root/keystonerc_admin packstack
sudo systemctl restart machina-daemon
```

The script:

- Creates `nova` and `glance` users in the `services` project (passwords from existing configs)
- Registers compute endpoints on `http://HOST:8774/v2.1` if missing
- Masks `openstack-nova-api.service` (conflicts with httpd on port 8774)
- Restarts `httpd`, `openstack-glance-api`, and optionally conductor/scheduler

## Remote host `212.8.252.194` (May 2026)

- Packstack was **stopped** after Keystone came up on `:5000`.
- `openstack token issue` works with `/root/keystonerc_admin`.
- Nova API was **not** finished → Machina stays in **unreachable** until you add compute or run a smaller Nova+Glance packstack pass.
