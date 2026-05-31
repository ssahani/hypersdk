// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { Page } from '@playwright/test'

export const platformInfo = {
  version: '0.1.0-test',
  tls: { enabled: false },
  auth: { pam_service: 'sshd', oidc_enabled: false },
  control_plane: {
    proxy_url: '/api/v1/platform/controller',
    direct_url: 'http://127.0.0.1:5093',
  },
  kubevirt: { exec_enabled: true },
  openstack: {
    enabled: true,
    configured: true,
    cloud_name: 'test',
    upload_enabled: false,
    upload_timeout_secs: 300,
    default_os_cloud: 'test',
    default_boot_instance: false,
  },
  hypersdk: { enabled: true, base_url: 'http://127.0.0.1:8787', insecure_tls: true },
  guestkit: { enabled: true, base_url: 'http://127.0.0.1:8790', insecure_tls: true },
  fleet: { enabled: false, peer_count: 0 },
}

const fleetFinder = {
  summary: '2 VM(s) · 1 running',
  smart_folders: [
    { id: 'all', label: 'All VMs', count: 2, icon: 'all' },
    { id: 'running', label: 'Running', count: 1, icon: 'running' },
  ],
  tags: [],
  projects: [],
}

const fleetDesktop = {
  hosts_online: 1,
  hosts_total: 1,
  active_tasks: 0,
  slo_breach_count: 0,
  slo_count: 1,
  pressure_hosts: 0,
  zeus_status: 'idle',
  unread_notifications: 0,
  linux_summary: 'OK',
}

const sampleHost = {
  id: 'h1',
  hostname: 'host-1',
  address: '127.0.0.1',
  state: 'online',
  maintenance_mode: false,
  vm_count: 2,
}

const sampleVm = {
  id: 'v1',
  name: 'vm-1',
  host_id: 'h1',
  observed_state: 'running',
  desired_state: 'running',
  lifecycle_phase: 'ready',
  managed: true,
  vcpus: 2,
  memory_mib: 2048,
  ha_enabled: false,
  project: null,
  tags: [],
}

export async function mockPlatformApi(page: Page, opts?: { tier?: 'normal' | 'power' | 'advanced' }) {
  const tier = opts?.tier ?? 'normal'
  await page.addInitScript((t) => {
    localStorage.setItem('zyvor-platform-welcome-done', '1')
    localStorage.setItem('machina-platform-desktop-tier', t)
  }, tier)

  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/auth/session')) {
      return route.fulfill({
        json: { authenticated: true, username: 'admin', role: 'admin', auth_source: 'pam' },
      })
    }
    if (url.includes('/auth/providers')) {
      return route.fulfill({
        json: { pam: { enabled: true }, ldap: { enabled: false }, oidc: { enabled: false } },
      })
    }
    if (url.includes('/system/platform-info')) {
      return route.fulfill({ json: platformInfo })
    }
    if (url.includes('/events/stream') || url.includes('/ws/')) {
      return route.abort()
    }
    if (url.includes('/fleet/finder')) {
      return route.fulfill({ json: fleetFinder })
    }
    if (url.includes('/fleet/desktop')) {
      return route.fulfill({ json: fleetDesktop })
    }
    if (url.includes('/policy/rules')) {
      return route.fulfill({ json: [{ id: '1', name: 'default', enabled: true, rule_json: {} }] })
    }
    if (url.includes('/policy/quotas')) {
      return route.fulfill({
        json: [{ project: 'default', max_vms: 50, max_vcpu: 200, max_memory_mib: 409600, max_storage_gib: 5000 }],
      })
    }
    if (url.includes('/audit')) {
      return route.fulfill({ json: [{ id: 'a1', actor: 'admin', action: 'login', created_at: new Date().toISOString() }] })
    }
    if (url.includes('/observability/overview')) {
      return route.fulfill({
        json: {
          summary: 'SLOs OK',
          slos: [{
            name: 'API latency',
            target: 'p99 < 500ms',
            objective_pct: 99,
            current_pct: 99.2,
            burn_rate: 0.01,
            status: 'ok',
            description: 'Within SLO',
          }],
          trace_count_1h: 12,
          p95_latency_ms: 45,
        },
      })
    }
    if (url.includes('/observability/traces')) {
      return route.fulfill({ json: [] })
    }
    if (url.includes('/storage/pools') && !url.includes('/discover')) {
      return route.fulfill({ json: [] })
    }
    if (url.includes('/storage/tiers')) {
      return route.fulfill({ json: { tiers: [], pools: [] } })
    }
    if (url.includes('/storage/backup-sla')) {
      return route.fulfill({ json: { policies: [], summary: 'No SLA configured' } })
    }
    if (url.includes('/storage/pools/discover')) {
      return route.fulfill({ json: { imported: 0, pools: [] } })
    }
    if (url.includes('/fleet/storage')) {
      return route.fulfill({
        json: {
          summary: 'OK',
          pool_count: 0,
          tier_count: 0,
          total_capacity_gib: 0,
          total_used_gib: 0,
          pools_over_85_pct: 0,
          smart_failure_count: 0,
          smart_hosts_affected: 0,
          pools: [],
          smart_disks: [],
        },
      })
    }
    if (url.includes('/zeus-security/')) {
      if (url.includes('/status')) {
        return route.fulfill({
          json: {
            fabric_reachable: true,
            packetwolf: { enabled: true, reachable: true, summary: 'PacketWolf connected', base_url: 'http://127.0.0.1:9091' },
            zeus_firewall: { ready: true },
          },
        })
      }
      if (url.includes('/fleet/threat')) {
        return route.fulfill({
          json: {
            fleet_threat_score: 78,
            firewall_targets: 1,
            critical_events: [{ summary: 'Possible reverse shell on port 4444', host_id: 'h1', severity: 'critical' }],
            packetwolf: { fleet_threat_score: 78 },
            security_graph_summary: '4 nodes · 3 edges in infrastructure security graph',
          },
        })
      }
      if (url.includes('/fleet/timeline')) {
        return route.fulfill({
          json: {
            events: [
              { summary: 'curl started', host_id: 'h1', severity: 'info', timestamp: new Date().toISOString() },
              { summary: 'Privilege escalation chain', host_id: 'h1', severity: 'high', kind: 'correlation' },
            ],
          },
        })
      }
      if (url.includes('/correlations')) {
        return route.fulfill({
          json: { correlations: [{ severity: 'high', summary: 'Suspicious DNS cluster', host_id: 'h2' }] },
        })
      }
      if (url.includes('/alerts/sync')) {
        return route.fulfill({ json: { inserted: 1, summary: 'Synced 1 security alert(s) to notification outbox' } })
      }
      if (url.includes('/graph')) {
        return route.fulfill({
          json: {
            nodes: [
              { id: 'user-1', kind: 'user', label: 'admin', risk: 'high' },
              { id: 'host-h1', kind: 'host', label: 'host-1', risk: 'medium' },
            ],
            edges: [{ from: 'user-1', to: 'host-h1', label: 'admin access' }],
          },
        })
      }
      if (url.includes('/sensors')) {
        return route.fulfill({ json: { sensors: [{ host_id: 'h1', status: 'healthy', tetragon_version: '1.0.0' }] } })
      }
      if (url.includes('/process-graph')) {
        return route.fulfill({
          json: {
            nodes: [{ pid: 1000, binary: '/usr/sbin/sshd' }, { pid: 1234, binary: '/bin/bash' }],
            edges: [{ from: 1000, to: 1234, binary: '/bin/bash' }],
          },
        })
      }
      if (url.includes('/timeline') || url.includes('/processes')) {
        return route.fulfill({
          json: {
            events: [{ summary: 'curl started', kind: 'process_exec', severity: 'info', timestamp: new Date().toISOString() }],
            processes: [{ summary: 'kubectl started', kind: 'process_exec', process: { binary: '/usr/bin/kubectl', pid: 1235 } }],
          },
        })
      }
      if (url.includes('/summary')) {
        return route.fulfill({ json: { host_id: 'h1', threat_score: 75, sensor: { status: 'healthy' } } })
      }
      if (url.includes('/containers')) {
        return route.fulfill({
          json: {
            host_id: 'h1',
            summary: '2 namespace(s) with pod/container metadata from Tetragon',
            namespaces: [
              {
                namespace: 'zeus',
                event_count: 4,
                pods: [
                  {
                    pod: 'api-server-7f8c9',
                    deployment: 'api-server',
                    containers: [{ container: 'api', event_count: 3, max_severity: 'info', processes: ['/app/server'] }],
                  },
                ],
              },
            ],
          },
        })
      }
      if (url.includes('/asset-inventory')) {
        return route.fulfill({
          json: { hosts: [{ host_id: 'h1', processes: ['nginx', 'postgres'], connections: [{ from: 'nginx', to: 'redis:6379' }] }] },
        })
      }
      return route.fulfill({ json: { ports: [], connections: [], dns: [], files: [] } })
    }
    if (url.includes('/fleet/')) {
      return route.fulfill({ json: { summary: 'Fleet aggregate OK', hosts: [], entries: [] } })
    }
    if (url.includes('/cluster')) {
      return route.fulfill({ json: { name: 'e2e-cluster', hosts: 1, vms: 2, offline_hosts: 0 } })
    }
    if (url.includes('/hosts')) {
      return route.fulfill({ json: [sampleHost] })
    }
    if (url.match(/\/vms\/[^/]+\/topology/)) {
      return route.fulfill({
        json: {
          nodes: [{ id: 'n1', name: 'vm-1', kind: 'vm' }, { id: 'n2', name: 'host-1', kind: 'host' }],
          edges: [{ from: 'n1', to: 'n2', label: 'runs_on' }],
        },
      })
    }
    if (url.match(/\/vms\/[^/]+(\?|$)/) || url.match(/\/vms\/[^/]+$/)) {
      return route.fulfill({ json: sampleVm })
    }
    if (url.includes('/vms')) {
      return route.fulfill({ json: [sampleVm] })
    }
    if (url.includes('/zeus-firewall/multisite/dr-templates')) {
      return route.fulfill({
        json: {
          summary: '2 DR profile pairs',
          profiles: [{ primary_profile: 'ProductionServer', dr_profile: 'DRServer' }],
        },
      })
    }
    if (url.includes('/zeus-firewall/policies')) {
      return route.fulfill({ json: [{ id: 'p1', name: 'production-default', profile: 'ProductionServer', enabled: true }] })
    }
    if (url.includes('/tasks')) {
      return route.fulfill({ json: [] })
    }
    if (url.includes('/notifications')) {
      return route.fulfill({ json: [] })
    }
    if (url.includes('/backup-targets')) {
      return route.fulfill({ json: [{ id: 't1', name: 'nfs-primary', kind: 'nfs', config_json: {} }] })
    }
    if (url.includes('/developer/overview')) {
      return route.fulfill({
        json: {
          summary: 'Developer SDK',
          openapi_url: '/api/v1/openapi.json',
          sdk_typescript: { version: '1.0', path: 'sdk/typescript', install: 'npm install @zyvor/machina-sdk', resources: ['hosts', 'vms'] },
          terraform: { provider_source: 'registry', examples_path: 'examples', resources: [{ name: 'machina_vm' }] },
        },
      })
    }
    if (url.includes('/openapi.json')) {
      const paths: Record<string, Record<string, { summary: string; tags?: string[] }>> = {}
      for (let i = 0; i < 60; i += 1) {
        paths[`/api/v1/hosts/h${i}`] = { get: { summary: `Get host ${i}`, tags: ['hosts'] } }
      }
      paths['/api/v1/hosts'] = { get: { summary: 'List hosts', tags: ['hosts'] } }
      paths['/api/v1/vms'] = { get: { summary: 'List VMs', tags: ['vms'] } }
      paths['/api/v1/health'] = { get: { summary: 'Health check', tags: ['health'] } }
      return route.fulfill({ json: { openapi: '3.0.3', paths } })
    }
    if (url.includes('/users/me')) {
      return route.fulfill({ json: { id: 'u1', username: 'admin', role: 'admin' } })
    }
    if (url.includes('/backups/timeline')) {
      return route.fulfill({ json: [] })
    }
    if (url.includes('/openstack/status')) {
      return route.fulfill({
        json: {
          reachable: true,
          keystone_reachable: true,
          compute_reachable: true,
          glance_reachable: true,
          cloud_name: 'test',
        },
      })
    }
    if (url.includes('/openstack/instances')) {
      return route.fulfill({
        json: {
          total: 2,
          instances: [
            { id: 'os-1', name: 'web-01', status: 'ACTIVE' },
            { id: 'os-2', name: 'db-01', status: 'SHUTOFF' },
          ],
        },
      })
    }
    if (url.includes('/openstack/networks')) {
      return route.fulfill({ json: { networks: [{ id: 'n1', name: 'private' }] } })
    }
    if (url.includes('/openstack/images')) {
      return route.fulfill({ json: { images: [{ id: 'i1', name: 'ubuntu-22.04' }] } })
    }
    if (url.includes('/k8s/overview')) {
      return route.fulfill({
        json: {
          version: 'v1.29.0',
          nodes: 3,
          ready_nodes: 3,
          namespaces: 8,
          pods: 42,
          deployments: 12,
          services: 18,
          distribution: 'k3s',
        },
      })
    }
    if (url.includes('/ai/security/explain-event')) {
      return route.fulfill({ json: { explanation: 'Routine administrative activity.', risk: 'Low', recommendation: 'Monitor timeline.' } })
    }
    if (url.includes('/ai/security/attack-reconstruct')) {
      return route.fulfill({ json: { attack_chain: ['1. curl downloaded file', '2. payload executed'], summary: '2 steps' } })
    }
    if (url.includes('/ai/security/nl-search')) {
      return route.fulfill({ json: { original_query: 'curl', search_query: 'curl', results: { results: [] } } })
    }
    if (url.includes('/ai/')) {
      return route.fulfill({
        json: { summary: 'OK', remediations: [], forecasts: [], highlights: [], status: 'idle', tagline: 'OK' },
      })
    }
    return route.fulfill({ json: [] })
  })
}
