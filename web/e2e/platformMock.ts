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

const fleetMission = {
  sites: [
    {
      name: 'DC-1',
      racks: [
        {
          name: 'Rack A',
          hosts: [
            {
              id: 'h1',
              hostname: 'host-1',
              address: '127.0.0.1',
              state: 'online',
              maintenance_mode: false,
              vm_count: 1,
              cpu_percent: 35,
              memory_used_mib: 4096,
              memory_total_mib: 16384,
              site: 'DC-1',
              rack: 'Rack A',
              rack_u: 10,
            },
          ],
        },
      ],
    },
  ],
  unassigned_hosts: [],
  summary: { hosts: 1, vms: 1, hosts_online: 1, health_pct: 100 },
}

const fleetMaintenanceMission = {
  summary: '1 host(s) with updates · 0 in maintenance · 0 pending schedule(s)',
  hosts_with_updates: 1,
  hosts_in_maintenance: 0,
  pending_schedules: 0,
  hosts: [
    {
      host_id: 'h1',
      hostname: 'host-1',
      state: 'online',
      maintenance_mode: false,
      validation_status: 'ok',
      pending_packages: 3,
      reboot_required: false,
      agent_drift: false,
      update_summary: '3 packages would be upgraded',
      recommended_step: 'schedule',
      steps: [
        { id: 'scan', label: 'Scan fleet', status: 'done', detail: null },
        { id: 'assess', label: 'Assess risk', status: 'done', detail: '3 packages would be upgraded' },
        { id: 'schedule', label: 'Schedule window', status: 'ready', detail: null },
        { id: 'enter_maintenance', label: 'Enter maintenance', status: 'blocked', detail: null },
        { id: 'evacuate', label: 'Evacuate VMs', status: 'skipped', detail: null },
        { id: 'apply_preview', label: 'Apply preview', status: 'blocked', detail: 'Preview on host' },
        { id: 'verify_exit', label: 'Verify & exit', status: 'pending', detail: null },
      ],
      blockers: ['Schedule a maintenance window before entering maintenance.'],
    },
  ],
}

const fleetDna = {
  score: 88,
  grade: 'B',
  summary: 'Infrastructure DNA 88/100 (grade B)',
  pillars: [
    { id: 'availability', label: 'Availability', score: 100, detail: '100% fleet health · 1 hosts online' },
    { id: 'patch_hygiene', label: 'Patch hygiene', score: 0, detail: '1 of 1 hosts need OS updates' },
    { id: 'linux_health', label: 'Linux health', score: 100, detail: 'Linux health OK' },
    { id: 'backup_posture', label: 'Storage posture', score: 95, detail: 'Storage OK' },
    { id: 'compliance', label: 'Compliance', score: 82, detail: 'Fleet ops grade B+' },
  ],
}

const jarvisLanding = {
  intents: [
    { id: 'jarvis-mission-control', label: 'Mission Control', review: 'Infrastructure Earth globe', action: 'navigate', navigate: '/platform?mission=1' },
    { id: 'jarvis-maintenance-mission', label: 'Maintenance Mission', review: 'Patch timeline', action: 'navigate', navigate: '/platform/maintenance?tab=mission' },
    { id: 'jarvis-machine-finder', label: 'Machine Finder', review: 'Geography', action: 'navigate', navigate: '/platform/hosts/finder' },
    { id: 'jarvis-enterprise', label: 'Enterprise Keychain', review: 'Vault and MFA inventory', action: 'navigate', navigate: '/platform/enterprise?tab=keychain' },
  ],
  search_hits: [],
}

const enterpriseSecurity = {
  vault_providers: 1,
  vault_connected: 1,
  mfa_policies: 1,
  mfa_required_roles: 1,
  air_gap_bundles: 0,
  mfa_enrolled_users: 2,
  tenant_policies: 1,
  fips_profiles: 2,
  summary: '1 vault · 2 MFA enrolled · 1 tenant policy',
}

const enterpriseVaults = [
  { id: 'vault-1', name: 'corp-vault', provider_type: 'hashicorp', address: 'https://vault.local', namespace: 'machina', status: 'connected', last_sync_at: null },
]

const enterpriseMfa = {
  summary: '1 role requires MFA',
  users: [{ username: 'admin', role: 'admin', required_method: 'totp', compliant: true }],
}

const enterpriseFips = {
  summary: 'OpenSSL profiles',
  openssl_version: '3.0',
  profiles: [{ id: 'default', name: 'Default', tls_min_version: '1.2', fips_mode: 'off', cipher_suites: 'TLS_AES_256', notes: 'Lab profile' }],
}

const enterpriseTenants = {
  summary: '1 workspace',
  projects: [{ project_name: 'default', vm_count: 2, max_vms: 50, network_isolation: 'shared', enforce_quotas: true, quota_status: 'ok' }],
}

const fleetKeychain = {
  summary: '2 credential entries',
  vault_providers: 1,
  vault_connected: 1,
  disconnected_vaults: 0,
  mfa_policies: 1,
  mfa_enrolled_users: 2,
  api_keys: 1,
  air_gap_bundles: 0,
  entries: [
    { kind: 'vault', id: 'v1', name: 'corp-vault', summary: 'HashiCorp · connected', status: 'active' },
    { kind: 'api_key', id: 'k1', name: 'automation', summary: 'Platform API key', status: 'active' },
  ],
}

const fleetUpdates = {
  summary: '1 host with pending updates',
  recommended_agent: '0.1.0-test',
  hosts_scanned: 1,
  hosts_with_updates: 1,
  hosts_reboot_required: 0,
  agent_drift_count: 0,
  total_pending_packages: 3,
  hosts: [
    {
      host_id: 'h1',
      hostname: 'host-1',
      agent_version: '0.1.0-test',
      agent_update_available: false,
      backend: 'apt',
      pending_count: 3,
      summary: '3 packages would be upgraded',
      reboot_required: false,
      status: 'updates',
    },
  ],
}

const fleetGpu = {
  summary: '1 GPU host(s) · 1 GPU VM(s) · 1 CUDA-ready',
  gpu_host_count: 1,
  gpu_vm_count: 1,
  cuda_ready_hosts: 1,
  mig_hosts: 0,
  vgpu_hosts: 0,
  hosts: [
    {
      host_id: 'h1',
      hostname: 'host-1',
      site: 'DC-1',
      rack: 'Rack A',
      state: 'online',
      gpu_capable: true,
      profile: 'cuda',
      model_hint: 'NVIDIA L40',
      vm_count: 1,
      gpu_vm_count: 1,
      vgpu_slices: 0,
      cuda_ready: true,
    },
  ],
  vms: [
    {
      vm_id: 'v1',
      vm_name: 'vm-1',
      host_id: 'h1',
      hostname: 'host-1',
      observed_state: 'running',
      profile: 'cuda',
      tags: ['gpu', 'inference'],
    },
  ],
  profiles: [{ kind: 'cuda', label: 'CUDA ready', host_count: 1, vm_count: 1 }],
}

const opsRunbooks = [
  {
    id: 'rb-1',
    incident: 'host-offline',
    title: 'Host offline recovery',
    category: 'infra',
    severity: 'high',
    auto_trigger: 'host.offline',
  },
]

const opsShowback = {
  summary: 'Project showback rollup',
  total_cost_usd: 850,
  fleet_grade: 'B+',
  lines: [{ project_name: 'default', cost_usd: 850, compliance_grade: 'B+', vm_count: 1 }],
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
  last_heartbeat_at: new Date().toISOString(),
}

const staleHost = {
  id: 'h-stale',
  hostname: 'stale-host',
  address: '127.0.0.2',
  state: 'offline',
  maintenance_mode: false,
  vm_count: 0,
  last_heartbeat_at: new Date(Date.now() - 5 * 60_000).toISOString(),
}

const sampleTemplate = {
  id: 'tpl-1',
  name: 'ubuntu-24.04',
  version: '1',
  source_disk: '/var/lib/libvirt/images/ubuntu.qcow2',
  cloud_init: true,
  os_family: 'linux',
  category: 'Ubuntu',
  description: 'Ubuntu 24.04 LTS golden image',
  featured: true,
  marketplace: true,
  icon: 'ubuntu',
  auto_fetch: true,
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
  inventory_source: 'libvirt',
  guest_ip: '192.168.122.50',
  guest_tools_status: 'healthy',
}

export async function mockPlatformApi(page: Page, opts?: {
  tier?: 'normal' | 'power' | 'advanced'
  staleHost?: boolean
  emptyStorage?: boolean
  templateNotReady?: boolean
  templateAutoFetch?: boolean
  emptyNetworks?: boolean
  stoppedVm?: boolean
}) {
  const tier = opts?.tier ?? 'normal'
  const vmFixture = opts?.stoppedVm
    ? { ...sampleVm, observed_state: 'stopped', desired_state: 'stopped', lifecycle_phase: 'idle' }
    : sampleVm
  let promptTitle = 'RCA template'
  let storagePools: Array<{ id: string; name: string; path: string; capacity_gib: number; used_gib: number }> =
    opts?.emptyStorage ? [] : [{ id: 'p1', name: 'default', path: '/var/lib/libvirt/images', capacity_gib: 500, used_gib: 12 }]
  await page.addInitScript((t) => {
    localStorage.setItem('zyvor-platform-welcome-done', '1')
    localStorage.setItem('machina-platform-desktop-tier', t)
    localStorage.removeItem('machina_platform_controller')
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
    if (url.includes('/openstack/status')) {
      return route.fulfill({
        json: {
          enabled: true,
          configured: true,
          connected: true,
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
    if (url.includes('/fleet/console')) {
      return route.fulfill({
        json: {
          summary: '2 events in last 24h',
          total_24h: 2,
          audit_24h: 1,
          events_24h: 1,
          task_failures_24h: 0,
          entries: [
            {
              id: 'e1',
              created_at: new Date().toISOString(),
              severity: 'info',
              source: 'audit',
              action: 'login',
              message: 'user login',
              actor: 'admin',
            },
          ],
        },
      })
    }
    if (url.includes('/events/stream') || url.includes('/ws/')) {
      return route.abort()
    }
    if (url.includes('/fleet/finder')) {
      return route.fulfill({ json: fleetFinder })
    }
    if (url.includes('/fleet/maintenance-mission')) {
      return route.fulfill({ json: fleetMaintenanceMission })
    }
    if (url.match(/\/fleet\/mission(\?|$|\/)/)) {
      return route.fulfill({ json: fleetMission })
    }
    if (url.match(/\/fleet\/gpu(\?|$|\/)/)) {
      return route.fulfill({ json: fleetGpu })
    }
    if (url.match(/\/fleet\/dna(\?|$|\/)/)) {
      return route.fulfill({ json: fleetDna })
    }
    if (url.includes('/ai/settings')) {
      return route.fulfill({
        json: {
          enabled: true,
          mode: 'advisor',
          provider: 'local',
          model: 'default',
          api_key_configured: false,
          autopilot_interval_secs: 3600,
        },
      })
    }
    if (url.includes('/ai/jarvis/landing')) {
      return route.fulfill({ json: jarvisLanding })
    }
    if (url.includes('/ai/incidents/analyze')) {
      return route.fulfill({
        json: {
          window_hours: 4,
          root_cause: 'Network configuration change likely caused connectivity loss.',
          confidence: 0.76,
          contributing_factors: ['Firewall rule update'],
          suggested_actions: ['Review recent network policy', 'Run graph path analysis'],
          evidence: ['audit: firewall.update'],
          timeline: [
            { at: new Date().toISOString(), source: 'audit', kind: 'firewall', message: 'Rule updated', severity: 'high' },
          ],
        },
      })
    }
    if (url.includes('/ai/timeline/replay')) {
      return route.fulfill({
        json: {
          entries: [{ at: new Date().toISOString(), source: 'audit', kind: 'vm', message: 'VM created', severity: 'info' }],
          graph_changes: ['+1 vm ubuntu-desktop'],
        },
      })
    }
    if (url.match(/\/ai\/graph(\?|$)/) && route.request().method() === 'GET') {
      return route.fulfill({
        json: {
          nodes: [
            { kind: 'host', id: 'h1', name: 'host-1', state: 'online', health_score: 88 },
            { kind: 'vm', id: 'v1', name: 'ubuntu-desktop', state: 'running', health_score: 90 },
            { kind: 'vm', id: 'v2', name: 'db-01', state: 'running', health_score: 85 },
          ],
          edges: [
            { from: 'h1', to: 'v1', label: 'runs' },
            { from: 'v1', to: 'network-br-default', label: 'connected_to' },
          ],
          node_count: 3,
          edge_count: 2,
        },
      })
    }
    if (url.match(/\/ai\/graph\/at\//) && route.request().method() === 'GET') {
      return route.fulfill({
        json: {
          timestamp: new Date().toISOString(),
          nodes: [
            { kind: 'host', id: 'h1', name: 'host-1', state: 'online', health_score: 88 },
            { kind: 'vm', id: 'v1', name: 'ubuntu-desktop', state: 'running', health_score: 90 },
          ],
          edges: [{ from: 'h1', to: 'v1', label: 'runs' }],
          diff_summary: '-1 vm db-01 vs now',
          current_node_count: 3,
          node_delta: -1,
          added_nodes: [],
          removed_nodes: ['vm:db-01'],
        },
      })
    }
    if (url.match(/\/ai\/graph\/object\//) && route.request().method() === 'GET') {
      return route.fulfill({
        json: {
          kind: 'vm',
          id: 'v1',
          name: 'ubuntu-desktop',
          purpose: 'Primary desktop VM on default bridge.',
          risks: ['No recent backup snapshot'],
          health_score: 90,
        },
      })
    }
    if (url.includes('/ai/graph/path') && route.request().method() === 'POST') {
      return route.fulfill({
        json: {
          can_reach: false,
          explanation: 'VMs on different segments — verify firewall for port 5432.',
          hops: ['ubuntu-desktop', 'host h1', 'cluster network', 'db-01'],
          blockers: [{ kind: 'segment_mismatch', message: 'Different bridges', remediation: 'Check VLAN routing' }],
          confidence: 0.88,
          evidence: [{ source: 'graph', detail: 'No shared bridge' }],
        },
      })
    }
    if (url.includes('/ai/predictions')) {
      return route.fulfill({
        json: {
          summary: '1 prediction',
          predictions: [{ resource: 'storage', resource_kind: 'storage', kind: 'exhaustion', severity: 'high', message: 'Pool 87% full', hours_until_critical: 72, confidence: 0.72, evidence: 'capacity' }],
        },
      })
    }
    if (url.includes('/ai/troubleshoot')) {
      return route.fulfill({
        json: {
          vm_id: 'v1', vm_name: 'ubuntu-desktop', symptom: 'slow', severity: 'medium',
          checks: [
            { domain: 'cpu', status: 'ok', detail: 'CPU 45%' },
            { domain: 'memory', status: 'warn', detail: '78% used' },
            { domain: 'disk', status: 'ok', detail: '1 disk' },
            { domain: 'host_pressure', status: 'ok', detail: 'Host OK' },
            { domain: 'network', status: 'ok', detail: 'No symptom' },
          ],
          findings: [{ severity: 'medium', message: 'Memory pressure', domain: 'memory' }],
          recommended_actions: ['Increase RAM'],
        },
      })
    }
    if (url.includes('/ai/rightsizing/report')) {
      return route.fulfill({
        json: {
          recommendations: [{ vm_id: 'v1', vm_name: 'idle-vm', action: 'power_off', detail: 'Stopped 30d', savings_usd: 15, risk: 'medium', current_memory_mib: 0, suggested_memory_mib: 0 }],
          idle_vm_count: 1, oversized_vm_count: 2, estimated_monthly_savings_usd: 45,
        },
      })
    }
    if (url.includes('/ai/memory/incidents')) {
      return route.fulfill({
        json: {
          incidents: [{ at: new Date().toISOString(), kind: 'rca', summary: 'Network change', actor: 'admin', lesson: 'Review firewall rules' }],
          runbook_hints: ['Check bridge state after NIC events'],
        },
      })
    }
    if (url.includes('/ai/memory/changes-before')) {
      return route.fulfill({
        json: {
          summary: '1 change in the 4h before incident.',
          changes: [{ at: new Date().toISOString(), kind: 'firewall.update', summary: 'Rule updated', actor: 'admin' }],
        },
      })
    }
    if (url.includes('/ai/incidents/active')) {
      return route.fulfill({ json: [] })
    }
    if (url.includes('/ai/actions/hub')) {
      return route.fulfill({
        json: {
          zeus_actions: [
            {
              id: 'act-1',
              source: 'nl_ops',
              action_type: 'vm.restart',
              label: 'Restart idle-vm',
              review: 'VM stopped 30 days — safe restart candidate',
              risk: 'low',
              status: 'pending',
            },
          ],
          total_pending: 1,
          firewall_pending: 0,
        },
      })
    }
    if (url.includes('/ai/agents')) {
      return route.fulfill({
        json: [{ id: 'fleet', name: 'Fleet Agent', description: 'Autonomous fleet ops', task_class: 'fleet' }],
      })
    }
    if (url.includes('/ai/zeus/plan') && route.request().method() === 'POST') {
      return route.fulfill({
        json: {
          goal: 'Rebalance idle VMs and clear failed tasks',
          agent_id: 'fleet',
          steps: [
            { title: 'Identify idle VMs', detail: 'Scan fleet for stopped guests' },
            { title: 'Queue rebalance moves', detail: 'Relieve cold hosts' },
          ],
        },
      })
    }
    if (url.includes('/ai/zeus/execute') && route.request().method() === 'POST') {
      return route.fulfill({ json: { message: 'Queued 2 steps for approval' } })
    }
    if (url.includes('/ai/policy/export')) {
      return route.fulfill({ json: { yaml: 'rules:\n- name: default', rule_count: 1, quota_count: 1 } })
    }
    if (url.includes('/ai/terminal/suggest') && route.request().method() === 'POST') {
      return route.fulfill({
        json: {
          vm_name: vmFixture.name,
          observed_state: vmFixture.observed_state,
          suggestions: [
            { label: 'Check disk', command: 'df -h', description: 'Disk usage on guest', scope: 'guest' },
          ],
          notes: 'Mock terminal suggestions',
        },
      })
    }
    if (url.includes('/ai/routing/rules') && route.request().method() === 'PATCH') {
      return route.fulfill({
        json: { task_class: 'infrastructure', provider_id: 'prov-1', model_id: 'mod-1', enabled: true },
      })
    }
    if (url.includes('/ai/routing/rules')) {
      return route.fulfill({
        json: [
          { task_class: 'infrastructure', provider_id: 'prov-1', model_id: 'mod-1', enabled: true },
          { task_class: 'fast_local', provider_id: null, model_id: null, enabled: true },
        ],
      })
    }
    if (url.includes('/ai/enterprise/zeus') && route.request().method() === 'PATCH') {
      return route.fulfill({
        json: {
          zeus_admin_role: true,
          zeus_execute_role: true,
          zeus_read_role: true,
          air_gap_llm: true,
          audit_events_24h: 42,
          scim_enabled: false,
          sso_configured: false,
        },
      })
    }
    if (url.includes('/ai/enterprise/zeus')) {
      return route.fulfill({
        json: {
          zeus_admin_role: true,
          zeus_execute_role: true,
          zeus_read_role: true,
          air_gap_llm: false,
          audit_events_24h: 42,
          scim_enabled: false,
          sso_configured: false,
        },
      })
    }
    if (url.includes('/ai/memory/settings') && route.request().method() === 'PATCH') {
      return route.fulfill({
        json: { enabled: true, team_scope: false, project_scope: true, retention_days: 90 },
      })
    }
    if (url.includes('/ai/memory/settings')) {
      return route.fulfill({
        json: { enabled: true, team_scope: false, project_scope: true, retention_days: 90 },
      })
    }
    if (url.match(/\/ai\/memory(\?|$)/) && route.request().method() === 'DELETE') {
      return route.fulfill({ json: { deleted: 5 } })
    }
    if (url.match(/\/ai\/prompts\/[^/]+$/) && route.request().method() === 'PATCH') {
      try {
        const body = JSON.parse(route.request().postData() ?? '{}') as { title?: string }
        if (body.title) promptTitle = body.title
      } catch { /* empty */ }
      return route.fulfill({
        json: { id: 'p1', scope: 'personal', title: promptTitle, body: 'Updated body', tags: ['infrastructure'], agent_id: 'auto' },
      })
    }
    if (url.includes('/ai/prompts') && route.request().method() === 'POST') {
      return route.fulfill({
        json: { id: 'p2', scope: 'personal', title: 'New prompt', body: 'Body', tags: [], agent_id: 'auto' },
      })
    }
    if (url.includes('/ai/prompts')) {
      return route.fulfill({
        json: [{ id: 'p1', scope: 'personal', title: promptTitle, body: 'Analyze host pressure', tags: ['infrastructure'], agent_id: 'auto' }],
      })
    }
    if (url.match(/\/ai\/providers\/[^/]+\/models/)) {
      return route.fulfill({
        json: [{ id: 'mod-1', provider_id: 'prov-1', model_id: 'gpt-4o-mini', display_name: 'gpt-4o-mini', context_window: 128000, enabled: true }],
      })
    }
    if (url.includes('/ai/providers')) {
      return route.fulfill({
        json: [{
          id: 'prov-1',
          name: 'OpenAI',
          kind: 'openai',
          base_url: '',
          org_id: '',
          deployment_name: '',
          api_key_configured: true,
          enabled: true,
          is_default: true,
        }],
      })
    }
    if (url.includes('/ai/marketplace/agents')) {
      return route.fulfill({ json: [] })
    }
    if (url.includes('/ai/autopilot/propose')) {
      return route.fulfill({
        json: {
          mode: 'advisor',
          actions: [
            {
              id: 'auto-1',
              label: 'Power off idle VM',
              review: 'idle-vm unused 30d',
              risk: 'low',
              action_type: 'vm.power_off',
              object_ref: { vm_id: 'v2' },
            },
          ],
        },
      })
    }
    if (url.includes('/ai/copilot/stream') && route.request().method() === 'POST') {
      const sse = [
        'data: {"type":"chunk","text":"Fleet looks healthy. "}',
        'data: {"type":"chunk","text":"2 VMs running."}',
        'data: {"type":"done","deterministic":true}',
      ].join('\n\n') + '\n\n'
      return route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: sse,
      })
    }
    if (url.includes('/ai/cost') && !url.includes('/ai/cost/') && route.request().method() === 'GET') {
      return route.fulfill({
        json: {
          estimated_monthly_usd: 120,
          vm_count: 2,
          idle_vm_count: 1,
          oversized_vm_count: 0,
          snapshot_heavy_count: 0,
          suggestions: ['Power off idle-vm'],
        },
      })
    }
    if (url.includes('/ai/capacity') && !url.includes('/ai/capacity/export') && route.request().method() === 'GET') {
      return route.fulfill({
        json: {
          hosts_online: 1,
          memory_headroom_mib: 8192,
          avg_cpu_percent: 25,
          storage_used_gib: 40,
          storage_capacity_gib: 200,
          cpu_headroom_percent: 60,
          estimated_small_vms_addable: 4,
          recommendations: ['Headroom OK'],
        },
      })
    }
    if (
      url.includes('/ai/cost/export.csv')
      || url.includes('/ai/capacity/export.csv')
      || url.includes('/ai/cost/attribution/export.csv')
      || url.includes('/ai/compliance/export')
    ) {
      const isPdf = url.includes('.pdf')
      return route.fulfill({
        body: isPdf ? '%PDF-1.4 mock' : 'metric,value\nidle_vms,1\n',
        contentType: isPdf ? 'application/pdf' : 'text/csv',
      })
    }
    if (url.includes('/ai/nl-ops')) {
      return route.fulfill({
        json: { intent: 'search', summary: '1 result', steps: [], risk_score: 1, dry_run: true, approval_required: false, action_ids: [], reply: 'Found 1 VM.' },
      })
    }
    if (url.includes('/ai/mission/stack/status')) {
      return route.fulfill({ json: { summary: 'No active mission stack', status: 'idle' } })
    }
    if (url.includes('/enterprise/security/overview')) {
      return route.fulfill({ json: enterpriseSecurity })
    }
    if (url.includes('/enterprise/vault/providers') && route.request().method() === 'POST') {
      return route.fulfill({ status: 500, json: { error: 'vault sync failed' } })
    }
    if (url.includes('/enterprise/vault/sync-all') && route.request().method() === 'POST') {
      return route.fulfill({ status: 500, json: { error: 'vault sync failed' } })
    }
    if (url.includes('/enterprise/vault/providers')) {
      return route.fulfill({ json: enterpriseVaults })
    }
    if (url.includes('/enterprise/mfa/compliance')) {
      return route.fulfill({ json: enterpriseMfa })
    }
    if (url.includes('/enterprise/fips/matrix')) {
      return route.fulfill({ json: enterpriseFips })
    }
    if (url.includes('/enterprise/tenants/overview')) {
      return route.fulfill({ json: enterpriseTenants })
    }
    if (url.match(/\/fleet\/keychain(\?|$|\/)/)) {
      return route.fulfill({ json: fleetKeychain })
    }
    if (url.includes('/fleet/updates')) {
      return route.fulfill({ json: fleetUpdates })
    }
    if (url.includes('/maintenance/schedules') && route.request().method() === 'POST') {
      if (url.includes('fail-schedule')) {
        return route.fulfill({ status: 500, json: { error: 'schedule failed' } })
      }
      return route.fulfill({
        json: {
          id: 'sched-1',
          host_id: 'h1',
          action: 'enter',
          evacuate: true,
          run_at: new Date().toISOString(),
          status: 'pending',
        },
      })
    }
    if (url.includes('/maintenance/schedules')) {
      return route.fulfill({ json: [] })
    }
    if (url.includes('/hosts/') && url.includes('/maintenance') && route.request().method() === 'POST') {
      return route.fulfill({ json: { task_id: 'task-maint-1' } })
    }
    if (url.includes('/ai/fleet/gpu-placement')) {
      return route.fulfill({
        json: {
          summary: '1 GPU-capable host(s) for inference — top: host-1',
          candidates: [{ host_id: 'h1', hostname: 'host-1', gpu_capable: true, numa_hint: 'NUMA 0', score: 92, reason: 'GPU-tagged host · CPU 35% · 1 VMs' }],
        },
      })
    }
    if (url.includes('/ai/fleet/heatmap')) {
      return route.fulfill({
        json: {
          hosts: [{ host_id: 'h1', hostname: 'host-1', cpu_percent: 35, memory_percent: 40, vm_count: 1, classification: 'balanced' }],
          hotspots: [],
          cold_hosts: [],
          power_waste_hosts: [],
        },
      })
    }
    if (url.includes('/ai/fleet/rebalance')) {
      return route.fulfill({
        json: { summary: 'No moves suggested', moves: [], estimated_savings_pct: 0 },
      })
    }
    if (url.includes('/fleet/linux-health')) {
      return route.fulfill({
        json: {
          hosts_scanned: 1,
          pressure_hosts: 0,
          thermal_alerts: 0,
          smart_alerts: 0,
          summary: 'Linux health OK',
          hosts: [{ host_id: 'h1', hostname: 'host-1', io_pressure_pct: 12, status: 'ok' }],
        },
      })
    }
    if (url.includes('/ai/fleet/power')) {
      return route.fulfill({
        json: { summary: 'No power waste detected', total_savings_usd_month: 0, optimizations: [] },
      })
    }
    if (url.includes('/ai/fleet/summary')) {
      return route.fulfill({ json: { summary: '1 host · 1 VM', hosts: 1, vms: 1, alerts: [] } })
    }
    if (url.includes('/ai/fleet/local')) {
      return route.fulfill({ json: { summary: 'Local agent OK', local_agent: {} } })
    }
    if (url.includes('/operations/showback')) {
      return route.fulfill({ json: opsShowback })
    }
    if (url.includes('/operations/overview')) {
      return route.fulfill({ json: { runbook_count: 1, executions_24h: 0, compliance_grade: 'B+' } })
    }
    if (url.includes('/operations/executions')) {
      return route.fulfill({ json: [] })
    }
    if (url.includes('/operations/runbooks') && route.request().method() === 'POST') {
      return route.fulfill({ json: { summary: 'Runbook steps recorded', steps: ['Verify host heartbeat', 'Restart libvirtd if needed'] } })
    }
    if (url.includes('/operations/runbooks')) {
      return route.fulfill({ json: opsRunbooks })
    }
    if (url.includes('/reports/capacity')) {
      return route.fulfill({
        json: {
          hosts_online: 1,
          hosts_offline: 0,
          total_vms: 1,
          running_vms: 1,
          memory_total_mib: 16384,
          memory_used_mib: 4096,
          memory_headroom_mib: 8192,
          avg_cpu_percent: 35,
        },
      })
    }
    if (url.includes('/reports/finops')) {
      return route.fulfill({
        json: {
          estimated_monthly_usd: 100,
          total_vcpu: 4,
          vcpu_hour_usd: 0.01,
          total_memory_gib: 8,
          gib_hour_usd: 0.005,
          vm_count: 1,
          running_vms: 1,
        },
      })
    }
    if (url.includes('/projects')) {
      return route.fulfill({ json: [{ name: 'default', vm_count: 1 }] })
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
    if (url.includes('/placement/recommendations') || url.includes('/placement/refresh')) {
      return route.fulfill({ json: [] })
    }
    if (url.includes('/ha/status')) {
      return route.fulfill({
        json: {
          status: { enabled_vms: 0, offline_hosts: 0, recent_events: 0 },
          events: [],
        },
      })
    }
    if (url.includes('/cluster/settings')) {
      return route.fulfill({
        json: {
          drs_auto_migrate: false,
          drs_cpu_threshold: 80,
          ha_enabled: true,
          placement_policy: 'balanced',
          inventory_sync_interval_secs: 60,
        },
      })
    }
    if (url.includes('/migrations')) {
      return route.fulfill({ json: [] })
    }
    if (url.includes('/fence/events')) {
      return route.fulfill({ json: [] })
    }
    if (url.includes('/storage/pools/discover')) {
      storagePools = [{ id: 'p1', name: 'default', path: '/var/lib/libvirt/images', capacity_gib: 500, used_gib: 12 }]
      return route.fulfill({ json: { imported: 1, pools: storagePools } })
    }
    if (url.includes('/networks/discover')) {
      const nets = opts?.emptyNetworks
        ? []
        : [{ id: 'n1', name: 'default', bridge: 'virbr0' }]
      return route.fulfill({ json: { imported: nets.length, networks: nets } })
    }
    if (url.includes('/networks') && route.request().method() === 'POST') {
      return route.fulfill({ json: { id: 'n2', name: 'vm-net', bridge: 'br0', backend: 'bridge' } })
    }
    if (url.includes('/networks') && !url.includes('/discover')) {
      return route.fulfill({ json: [] })
    }
    if (url.includes('/storage/pools') && route.request().method() === 'POST') {
      return route.fulfill({
        json: { id: 'p2', name: 'datastore-01', path: '/var/lib/libvirt/images', capacity_gib: 500, used_gib: 0, backend: 'directory' },
      })
    }
    if (url.includes('/storage/pools') && !url.includes('/discover')) {
      return route.fulfill({ json: storagePools })
    }
    if (url.includes('/enrollment/tokens') && route.request().method() === 'POST') {
      return route.fulfill({
        json: {
          token: 'enroll-test-token',
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          install_command: 'curl -fsSL https://example/install.sh | sudo bash -s enroll-test-token',
        },
      })
    }
    if (url.includes('/storage/tiers')) {
      return route.fulfill({ json: { tiers: [], pools: [] } })
    }
    if (url.includes('/network/segments/overview')) {
      return route.fulfill({ json: { segments: [], summary: 'No segments' } })
    }
    if (url.includes('/storage/backup-sla')) {
      return route.fulfill({ json: { policies: [], summary: 'No SLA configured' } })
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
    if (url.includes('/soc/')) {
      if (url.includes('/overview')) {
        return route.fulfill({ json: { open_alerts: 2, events_24h: 48, critical_alerts: 1 } })
      }
      if (url.includes('/events')) {
        return route.fulfill({
          json: [
            {
              id: 'e1',
              occurred_at: new Date().toISOString(),
              source: 'packetwolf',
              category: 'intrusion_detection',
              severity: 'high',
              summary: 'Unusual port activity on db-01',
            },
          ],
        })
      }
      if (url.includes('/alerts')) {
        const alertIdMatch = url.match(/\/alerts\/([^/?]+)$/)
        if (alertIdMatch && route.request().method() === 'GET') {
          return route.fulfill({
            json: {
              id: 'a1',
              rule_id: 'r1',
              rule_name: 'critical_anomaly',
              title: 'critical_anomaly (1)',
              severity: 'high',
              status: 'open',
              assigned_to: null,
              first_seen: new Date().toISOString(),
              last_seen: new Date().toISOString(),
              event_count: 1,
              dedupe_key: 'rule:r1:2026-06-03-03',
              detail_json: { rule: 'critical_anomaly', match_count: 1 },
              mitre_tags: [{ id: 'T1046', name: 'Network Service Discovery' }],
              linked_events: [
                {
                  id: 'e1',
                  occurred_at: new Date().toISOString(),
                  source: 'packetwolf',
                  category: 'intrusion_detection',
                  severity: 'high',
                  summary: 'Unusual port activity on db-01',
                  ecs_json: { 'threat': { technique: { id: 'T1046', name: 'Network Service Discovery' } } },
                },
              ],
              playbook_runs: [],
            },
          })
        }
        if (alertIdMatch && route.request().method() === 'PATCH') {
          return route.fulfill({
            json: {
              id: 'a1',
              title: 'critical_anomaly (1)',
              severity: 'high',
              status: 'acknowledged',
              first_seen: new Date().toISOString(),
              last_seen: new Date().toISOString(),
              event_count: 1,
            },
          })
        }
        return route.fulfill({
          json: [
            {
              id: 'a1',
              title: 'critical_anomaly (1)',
              severity: 'high',
              status: 'open',
              first_seen: new Date().toISOString(),
              last_seen: new Date().toISOString(),
              event_count: 1,
            },
          ],
        })
      }
      if (url.includes('/rules')) {
        if (url.includes('/test')) {
          return route.fulfill({ json: { match_count: 3, would_fire: true } })
        }
        return route.fulfill({
          json: [
            {
              id: 'r1',
              name: 'critical_anomaly',
              description: 'PacketWolf critical or high severity anomaly',
              enabled: true,
              severity: 'high',
              query_json: { type: 'match' },
              throttle_minutes: 30,
              builtin: true,
            },
          ],
        })
      }
      if (url.includes('/asm/summary')) {
        return route.fulfill({
          json: {
            exposure_score: 72,
            firewall_targets: 2,
            high_risk_nodes: 1,
            open_port_findings: [{ kind: 'firewall_target', resource: 'host-1', detail: 'Risk high score 85', severity: 'high' }],
            recommendations: ['Review Zeus Firewall open ports'],
          },
        })
      }
      if (url.includes('/integrations') && !url.includes('/integrations/splunk')) {
        if (url.match(/\/integrations\/[^/]+\/test/)) {
          return route.fulfill({ json: { ok: true, message: 'Integration test OK' } })
        }
        if (route.request().method() === 'PATCH') {
          return route.fulfill({
            json: {
              id: 'int-1',
              integration_type: 'elastic_bulk',
              name: 'default',
              enabled: true,
              config: { url: 'https://elastic:9200', api_key: '••••••••' },
              last_success_at: new Date().toISOString(),
            },
          })
        }
        return route.fulfill({
          json: [
            {
              id: 'splunk-1',
              integration_type: 'splunk_hec',
              name: 'default',
              enabled: false,
              config: { url: '', index: 'machina' },
            },
            {
              id: 'elastic-1',
              integration_type: 'elastic_bulk',
              name: 'default',
              enabled: false,
              config: { url: '', index: 'logs-machina.soc' },
            },
          ],
        })
      }
      if (url.includes('/soc/settings')) {
        if (route.request().method() === 'PATCH') {
          return route.fulfill({ json: { webhook_url: 'https://hooks.example/soc' } })
        }
        return route.fulfill({ json: { webhook_url: '' } })
      }
      if (url.includes('/playbook-runs')) {
        return route.fulfill({ json: [] })
      }
      if (url.includes('/soc/playbooks')) {
        const pb = {
          id: 'pb1',
          name: 'notify_on_critical',
          description: 'Webhook notify when critical SOC alert opens',
          enabled: true,
          trigger_json: { min_severity: 'high', rule_names: [] },
          steps_json: [
            { type: 'webhook', url_from_setting: 'soc_webhook_url', body: { alert_id: '{{alert_id}}' } },
          ],
        }
        if (route.request().method() === 'POST') {
          return route.fulfill({ json: { ...pb, id: 'pb2', name: 'new_playbook' } })
        }
        if (url.match(/\/playbooks\/[^/]+$/)) {
          return route.fulfill({ json: pb })
        }
        return route.fulfill({ json: [pb] })
      }
      if (url.includes('/ingest/run')) {
        return route.fulfill({
          json: {
            ingest: { firewall: 1, audit: 2, platform: 0, packetwolf: 1 },
            alerts_fired: 0,
            forwarded: 2,
          },
        })
      }
      if (url.includes('/integrations/splunk')) {
        if (url.includes('/test')) {
          return route.fulfill({ json: { ok: true, message: 'Splunk HEC accepted test event' } })
        }
        if (route.request().method() === 'PUT') {
          return route.fulfill({
            json: {
              id: 'splunk-1',
              integration_type: 'splunk_hec',
              name: 'default',
              enabled: true,
              config: { url: 'https://splunk:8088', token: '••••••••', index: 'machina' },
            },
          })
        }
        return route.fulfill({
          json: {
            id: 'splunk-1',
            integration_type: 'splunk_hec',
            name: 'default',
            enabled: false,
            config: { url: '', token: '', index: 'machina' },
          },
        })
      }
      if (url.includes('/forward/replay')) {
        return route.fulfill({ json: { forwarded: 12, hours: 24 } })
      }
      return route.fulfill({ json: [] })
    }
    if (url.includes('/zeus-security/')) {
      if (url.includes('/status')) {
        return route.fulfill({
          json: {
            fabric_reachable: true,
            packetwolf: {
              enabled: true,
              reachable: true,
              summary: 'PacketWolf connected',
              base_url: 'http://127.0.0.1:9091',
              storage: {
                clickhouse: { configured: true, reachable: true },
                opensearch: { configured: true, reachable: true, document_count: 128 },
                demo_mode: true,
              },
            },
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
      if (url.includes('/fabric/health')) {
        return route.fulfill({
          json: {
            status: 'healthy',
            sensors_total: 1,
            sensors_healthy: 1,
            summary: '1 sensor(s) · 128 OpenSearch doc(s)',
            hunt_index: { configured: true, reachable: true, document_count: 128 },
            issues: [],
          },
        })
      }
      if (url.includes('/hunt/queries')) {
        return route.fulfill({
          json: {
            queries: [
              { id: 'reverse-shell', name: 'Reverse shell listeners', query: 'nc OR netcat', severity: 'critical' },
            ],
          },
        })
      }
      if (url.includes('/hunt/run/')) {
        return route.fulfill({
          json: {
            ok: true,
            query_id: 'reverse-shell',
            query_name: 'Reverse shell listeners',
            backend: 'opensearch',
            hit_count: 1,
            results: [{ summary: 'nc listener on 4444', host_id: 'h1', severity: 'critical' }],
          },
        })
      }
      if (url.includes('/correlations')) {
        return route.fulfill({
          json: { correlations: [{ severity: 'high', summary: 'Suspicious DNS cluster', host_id: 'h2' }] },
        })
      }
      if (url.includes('/enforcement/status')) {
        return route.fulfill({
          json: {
            mode: 'enforce',
            policies_total: 4,
            policies_enabled: 4,
            applied_hosts: ['h1'],
            blocked_events: 2,
            summary: '4 active policy(ies) · 2 blocked event(s) in store',
          },
        })
      }
      if (url.includes('/enforcement/policies') && url.includes('/apply')) {
        return route.fulfill({
          json: { ok: true, summary: 'Applied Block reverse-shell listeners to 1 host(s)' },
        })
      }
      if (url.includes('/enforcement/policies') && route.request().method() === 'POST') {
        return route.fulfill({
          json: { policy: { id: 'pol-new', name: 'test', kind: 'deny_process', match: '/bin/sh', enabled: true } },
        })
      }
      if (url.includes('/enforcement/policies')) {
        return route.fulfill({
          json: {
            policies: [
              { id: 'pol-deny-nc', name: 'Block reverse-shell listeners', kind: 'deny_process', match: '/usr/bin/nc', enabled: true },
            ],
          },
        })
      }
      if (url.includes('/enforcement')) {
        return route.fulfill({ json: { mode: 'observe', policies: [] } })
      }
      if (url.includes('/agents/') && url.includes('/bundle')) {
        return route.fulfill({
          json: { host_id: 'h1', policy_count: 2, tracing_policies: [{ kind: 'TracingPolicy' }] },
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
      if (url.includes('/fabric-status')) {
        return route.fulfill({
          json: {
            host_id: 'h1',
            agent_reachable: true,
            fabric: {
              policy_dir: '/var/lib/machina/tetragon/tracing-policies',
              policy_files: ['packetwolf-pol-deny-nc.json'],
              install_script_present: true,
              tetragon_binary_found: true,
              tetragon_service_active: true,
              tetragon_export_timer_active: true,
              export_url: 'http://127.0.0.1:9091/api/v1/ingest',
            },
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
    if (url.includes('/fleet/') && !url.match(/\/fleet\/(finder|mission|gpu|desktop|storage|network|console|updates|keychain|users|shortcuts|spaces|general|linux|backups|activity|dna|maintenance-mission)/)) {
      return route.fulfill({ json: { summary: 'Fleet aggregate OK', hosts: [], entries: [] } })
    }
    if (url.includes('/cluster')) {
      return route.fulfill({ json: { name: 'e2e-cluster', hosts: 1, vms: 2, offline_hosts: 0 } })
    }
    if (url.includes('/templates/prefetch-missing')) {
      return route.fulfill({ json: { task_id: 'prefetch-task-1' } })
    }
    if (url.includes('/templates/missing-images')) {
      return route.fulfill({
        json: {
          missing: [
            { name: 'photon-os', version: '1.0.0', source_disk: '/var/lib/libvirt/images/photon-os.qcow2', category: 'Appliance', icon: '📦', auto_fetch: true },
          ],
          count: 1,
          auto_fetch_count: 1,
          summary: '1 golden image(s) missing — 1 can auto-download on first VM create.',
        },
      })
    }
    if (url.includes('/templates/') && url.includes('/readiness')) {
      if (opts?.templateNotReady) {
        return route.fulfill({
          json: {
            disk_exists: false,
            host_online: 1,
            cloud_init: true,
            ready: false,
            auto_fetch: false,
            remediation: 'Upload the golden image to Content Library.',
            source_disk: sampleTemplate.source_disk,
          },
        })
      }
      if (opts?.templateAutoFetch) {
        return route.fulfill({
          json: {
            disk_exists: false,
            host_online: 1,
            cloud_init: true,
            ready: true,
            auto_fetch: true,
            remediation: 'Golden image will download over SSH on first create.',
            source_disk: sampleTemplate.source_disk,
          },
        })
      }
      return route.fulfill({
        json: {
          disk_exists: true,
          host_online: 1,
          cloud_init: true,
          ready: true,
          auto_fetch: false,
          remediation: 'Disk present on 1 online host(s).',
          source_disk: sampleTemplate.source_disk,
        },
      })
    }
    if (url.includes('/templates/seed')) {
      return route.fulfill({ json: { inserted: 1, templates: [sampleTemplate] } })
    }
    if (url.includes('/templates/marketplace')) {
      return route.fulfill({ json: [sampleTemplate] })
    }
    if (url.includes('/templates')) {
      return route.fulfill({ json: [sampleTemplate] })
    }
    if (url.includes('/hosts')) {
      if (opts?.emptyStorage) {
        return route.fulfill({ json: [{ ...sampleHost, state: 'offline' }] })
      }
      const hosts = opts?.staleHost ? [sampleHost, staleHost] : [sampleHost]
      return route.fulfill({ json: hosts })
    }
    if (url.match(/\/vms\/[^/]+\/topology/)) {
      return route.fulfill({
        json: {
          nodes: [{ id: 'n1', name: 'vm-1', kind: 'vm' }, { id: 'n2', name: 'host-1', kind: 'host' }],
          edges: [{ from: 'n1', to: 'n2', label: 'runs_on' }],
        },
      })
    }
    if (url.match(/\/vms\/[^/]+\/ha/)) {
      return route.fulfill({ json: { vm_id: 'v1', enabled: false, restart_policy: 'restart' } })
    }
    if (url.match(/\/vms\/[^/]+\/spec/)) {
      return route.fulfill({
        json: {
          domain: { name: 'vm-1' },
          cloud_init: { user: 'ubuntu', ssh_pubkey: 'ssh-ed25519 AAA test' },
        },
      })
    }
    if (url.match(/\/zeus-firewall\/vms\/[^/]+\/guest-ports/)) {
      return route.fulfill({
        json: {
          vm_id: 'v1',
          vm_name: 'vm-1',
          agent_reachable: true,
          summary: '2 listening port(s)',
          ports: [
            { port: 22, protocol: 'tcp', service_name: 'ssh', bind_address: '0.0.0.0', allowed_from: [], risk: 'Safe', evidence: [] },
            { port: 80, protocol: 'tcp', service_name: 'http', bind_address: '0.0.0.0', allowed_from: [], risk: 'Warning', evidence: [] },
          ],
        },
      })
    }
    if (url.match(/\/vms\/[^/]+\/console/)) {
      return route.fulfill({
        json: { vm_name: 'vm-1', console_type: 'vnc', ws_path: '/api/v1/vms/v1/console/ws' },
      })
    }
    if (url.match(/\/vms\/guest-health-fail\/guest\/health/)) {
      return route.fulfill({ status: 500, json: { error: 'guest health unavailable' } })
    }
    if (url.match(/\/vms\/[^/]+\/guest\/health/)) {
      return route.fulfill({
        json: {
          vm_id: 'v1',
          vm_name: 'vm-1',
          agent_reachable: true,
          healthy: true,
          os_pretty_name: 'Ubuntu 24.04 LTS',
          guest_ip: '192.168.122.50',
          guest_hostname: 'vm-1',
          issues: [],
          summary: 'Guest agent running · Ubuntu 24.04 LTS',
          install_state: 'running',
          channel_attached: true,
          channel_connected: true,
          agent_ping: true,
          agent_version: '6.2.0',
          checks: [{ id: 'agent_ping', label: 'QEMU guest agent ping', passed: true, detail: 'OK' }],
          guest_observability: {
            os_pretty_name: 'Ubuntu 24.04 LTS',
            os_kernel: '6.8.0',
            ip_addresses: [{ name: 'eth0', address: '192.168.122.50', source: 'agent', ip_type: 'ipv4' }],
            users: [{ username: 'ubuntu', login_time: new Date().toISOString() }],
            time: { guest_time_rfc3339: new Date().toISOString(), host_time_rfc3339: new Date().toISOString(), delta_ms: 1200 },
          },
        },
      })
    }
    if (url.match(/\/vms\/[^/]+\/guest\/ai-insights/) && route.request().method() === 'POST') {
      return route.fulfill({
        json: {
          vm_id: 'v1',
          vm_name: 'vm-1',
          summary: 'Ubuntu 24.04 with QGA active — time drift minor.',
          insights: [{ title: 'Guest agent active', severity: 'info', detail: 'guest-ping OK' }],
          recommendations: [{ label: 'Sync guest time', action: 'guest.sync_time', risk: 'low', rationale: 'Minor drift' }],
          llm_powered: false,
          snapshot: { install_state: 'running', agent_ping: true },
        },
      })
    }
    if (url.includes('/ai/fleet/guest-query') && route.request().method() === 'POST') {
      const raw = route.request().postData() ?? ''
      let body: { query?: string } = {}
      try {
        body = JSON.parse(raw) as { query?: string }
      } catch { /* empty */ }
      if (body.query?.includes('empty-test') || raw.includes('empty-test')) {
        return route.fulfill({
          json: {
            query: body.query,
            summary: 'No VMs matched for empty-test query.',
            matched_count: 0,
            scanned_count: 3,
            llm_powered: false,
            vms: [],
          },
        })
      }
      return route.fulfill({
        json: {
          query: 'guest agent',
          summary: '1 VM matched with active guest agent.',
          matched_count: 1,
          scanned_count: 1,
          llm_powered: false,
          vms: [{ vm_id: 'v1', vm_name: 'vm-1', os_pretty_name: 'Ubuntu 24.04', guest_ip: '192.168.122.50', install_state: 'running', user_count: 1, flags: [] }],
        },
      })
    }
    if (url.includes('/ai/migration/readiness-report') && route.request().method() === 'POST') {
      return route.fulfill({
        json: {
          executive_summary: 'Fleet migration readiness: average 85%. Enable QGA on all guests before cutover.',
          vm_count: 1,
          rows: [{ vm_id: 'v1', vm_name: 'vm-1', readiness_percent: 85, install_state: 'running', os_pretty_name: 'Ubuntu 24.04', guest_ip: '192.168.122.50', qga_gaps: [], remediation: [] }],
          prioritized_remediation: ['Verify virtio drivers post-migration'],
          llm_powered: false,
        },
      })
    }
    if (url.match(/\/vms\/[^/]+\/domain-xml/)) {
      return route.fulfill({ json: { xml: '<domain type="kvm"><name>vm-1</name></domain>' } })
    }
    if (url.match(/\/vms\/[^/]+\/health-check/) && route.request().method() === 'POST') {
      return route.fulfill({
        json: {
          vm_id: 'v1',
          vm_name: 'vm-1',
          score: 'ok',
          healthy: true,
          checks_passed: 3,
          checks_total: 3,
          issues: [],
          guest_tools_status: 'installed',
          guest_ip: '192.168.122.50',
        },
      })
    }
    if (url.match(/\/vms\/[^/]+\/delete/) && route.request().method() === 'POST') {
      return route.fulfill({
        json: { task_id: 'task-delete-mock', status: 'pending', operation: 'vm.delete' },
      })
    }
    if (url.match(/\/vms\/[^/]+\/(shutdown|pause|resume|start|stop|reboot)$/) && route.request().method() === 'POST') {
      return route.fulfill({ json: { task_id: 'task-power-mock' } })
    }
    if (url.match(/\/vms\/[^/]+\/snapshots/)) {
      return route.fulfill({ json: [] })
    }
    if (url.match(/\/vms\/[^/]+\/backups/)) {
      return route.fulfill({ json: [] })
    }
    if (url.match(/\/vms\/[^/]+\/disks/)) {
      return route.fulfill({ json: [] })
    }
    if (url.match(/\/vms\/[^/]+\/metrics/)) {
      return route.fulfill({ json: { cpu_percent: 12, memory_percent: 40 } })
    }
    if (url.match(/\/vms\/[^/]+\/migrations/)) {
      return route.fulfill({ json: [] })
    }
    if (url.match(/\/vms\/[^/]+\/timeline/)) {
      return route.fulfill({ json: [] })
    }
    if (url.match(/\/vms\/[^/]+\/doctor/)) {
      return route.fulfill({
        json: {
          vm_id: vmFixture.id,
          vm_name: vmFixture.name,
          score: 'warn',
          score_numeric: 62,
          score_label: 'Degraded',
          healthy: false,
          checks_passed: 2,
          checks_total: 4,
          issues: [{ id: 'power', severity: 'warn', message: 'VM is not running' }],
          guest_tools_status: 'unknown',
        },
      })
    }
    if (url.match(/\/vms\/[^/]+(\?|$)/) || url.match(/\/vms\/[^/]+$/)) {
      return route.fulfill({ json: vmFixture })
    }
    if (url.includes('/vms')) {
      return route.fulfill({ json: [vmFixture] })
    }
    if (url.includes('/zeus-firewall/overview')) {
      return route.fulfill({
        json: {
          summary: '1 target monitored',
          critical_count: 0,
          warning_count: 0,
          targets: [{ id: 'h1', hostname: 'host-1', kind: 'host', risk: 'ok', score: 92 }],
        },
      })
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
    if (url.includes('/ai/security/explain-event')) {
      return route.fulfill({ json: { explanation: 'Routine administrative activity.', risk: 'Low', recommendation: 'Monitor timeline.' } })
    }
    if (url.includes('/ai/security/attack-reconstruct')) {
      return route.fulfill({ json: { attack_chain: ['1. curl downloaded file', '2. payload executed'], summary: '2 steps' } })
    }
    if (url.includes('/ai/security/nl-search')) {
      return route.fulfill({
        json: {
          original_query: 'curl',
          search_query: 'curl',
          hit_count: 1,
          search_backend: 'opensearch',
          llm_powered: false,
          results: { results: [{ summary: 'curl started', host_id: 'h1', severity: 'info' }] },
        },
      })
    }
    if (url.includes('/ai/security/hunt-summary')) {
      return route.fulfill({
        json: {
          summary: '2 correlation finding(s), 4 timeline event(s), 1 high/critical.',
          priority_actions: ['Review high/critical correlations in Security Center'],
          llm_powered: false,
        },
      })
    }
    if (url.includes('/ai/security')) {
      return route.fulfill({
        json: { summary: 'OK', findings: [], remediations: [], status: 'idle' },
      })
    }
    if (url.includes('/ai/')) {
      return route.fulfill({
        json: { summary: 'OK', remediations: [], forecasts: [], highlights: [], status: 'idle', tagline: 'OK' },
      })
    }
    return route.fulfill({ json: [] })
  })

  // Registered after the catch-all api handler so Playwright matches this route first.
  await page.route('**/fleet/mission**', async (route) => {
    await route.fulfill({ json: fleetMission })
  })
}
