// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { platformFetch } from './platform'
import { readJsonObject } from './client'

const DAEMON_API = '/api/v1'

export type ExposureRisk = 'Safe' | 'Warning' | 'Critical' | 'safe' | 'warning' | 'critical'

export interface FirewallTargetSummary {
  id: string
  kind: string
  name: string
  hostname: string
  enabled: boolean
  backend: string
  profile?: string | null
  risk: string
  score: number
  open_ports: number
  blocked_today: number
  agent_reachable: boolean
}

export interface FirewallOverview {
  targets: FirewallTargetSummary[]
  critical_count: number
  warning_count: number
  profiles: string[]
  summary: string
}

export interface OpenPort {
  port: number
  protocol: string
  service_name: string
  bind_address: string
  process?: string
  allowed_from: string[]
  risk: ExposureRisk
  evidence: string[]
}

export interface AllowedService {
  name: string
  port: number
  protocol: string
  allowed_from: string
  status: ExposureRisk
  recommendation?: string
}

export interface FirewallScore {
  score: number
  breakdown: Array<{ category: string; status: string; points: number; detail: string }>
  recommendations: Array<{ label: string; points: number; action: string }>
}

export interface FirewallInventory {
  hostname: string
  posture: {
    enabled: boolean
    backend: string
    profile?: string
    stealth_level: string
    drift_detected: boolean
  }
  rules: unknown[]
  open_ports: OpenPort[]
  services: AllowedService[]
  score: FirewallScore
}

export interface FirewallTargetDetail {
  target: FirewallTargetSummary
  inventory: FirewallInventory
}

export interface FirewallExplainReport {
  target: string
  risk: string
  evidence: string[]
  recommendation: string
  summary: string
}

export interface SecurePlanReport {
  target: string
  steps: Array<{ step: number; action: string }>
  risk_after: string
  rollback: boolean
  summary: string
}

export const getZeusFirewallStatus = () =>
  platformFetch<{ zeus_firewall: Record<string, unknown>; packetwolf: Record<string, unknown> }>(
    '/api/v1/zeus-firewall/status',
  )

export const getZeusFirewallDaemonStatus = () =>
  readJsonObject<{ zeus_firewall: Record<string, unknown> }>(`${DAEMON_API}/zeus-firewall/status`)

export const getFirewallOverview = () =>
  platformFetch<FirewallOverview>('/api/v1/zeus-firewall/overview')

export const getFirewallTarget = (id: string) =>
  platformFetch<FirewallTargetDetail>(`/api/v1/zeus-firewall/targets/${id}`)

export const getFirewallPorts = (id: string) =>
  platformFetch<OpenPort[]>(`/api/v1/zeus-firewall/targets/${id}/ports`)

export const getFirewallServices = (id: string) =>
  platformFetch<AllowedService[]>(`/api/v1/zeus-firewall/targets/${id}/services`)

export const getFirewallScore = (id: string) =>
  platformFetch<FirewallScore>(`/api/v1/zeus-firewall/targets/${id}/score`)

export interface FirewallPlanDiff {
  warnings?: string[]
}

export interface FirewallPlanResult {
  diff: FirewallPlanDiff
  operations: string[]
}

export const planFirewall = (id: string, body: Record<string, unknown>) =>
  platformFetch<FirewallPlanResult>(`/api/v1/zeus-firewall/targets/${id}/plan`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const applyFirewall = (id: string, body: Record<string, unknown>) =>
  platformFetch<FirewallPlanResult>(`/api/v1/zeus-firewall/targets/${id}/apply`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const explainFirewall = (target_id: string, question?: string) =>
  platformFetch<FirewallExplainReport>('/api/v1/ai/firewall/explain', {
    method: 'POST',
    body: JSON.stringify({ target_id, question }),
  })

export const secureMachinePlan = (target_id: string) =>
  platformFetch<SecurePlanReport>('/api/v1/ai/firewall/secure-plan', {
    method: 'POST',
    body: JSON.stringify({ target_id }),
  })

export const lockdownMachine = (id: string, capture = false) =>
  platformFetch<unknown>(`/api/v1/zeus-firewall/targets/${id}/lockdown`, {
    method: 'POST',
    body: JSON.stringify({ capture }),
  })

export const getFirewallActivity = (id: string, hours = 24) =>
  platformFetch<Record<string, unknown>>(`/api/v1/zeus-firewall/targets/${id}/activity?hours=${hours}`)

export const getFirewallCompliance = (kind: string) =>
  platformFetch<Record<string, unknown>>(`/api/v1/zeus-firewall/compliance/${kind}`)

export const exportFirewallSiem = (hours = 168) =>
  platformFetch<Record<string, unknown>>(`/api/v1/zeus-firewall/siem/export?hours=${hours}`)

export const getFirewallTimeline = (id: string) =>
  platformFetch<Array<Record<string, unknown>>>(`/api/v1/zeus-firewall/targets/${id}/timeline`)

export const listFirewallProfiles = () =>
  platformFetch<Array<{ name: string; display_name: string; description: string }>>('/api/v1/zeus-firewall/profiles')

export const applyFirewallProfile = (id: string, profile: string, dry_run = true) =>
  platformFetch<{ diff: unknown; operations: string[] }>(`/api/v1/zeus-firewall/targets/${id}/profile`, {
    method: 'POST',
    body: JSON.stringify({ profile, dry_run }),
  })

export const listFirewallCheckpoints = (id: string) =>
  platformFetch<Array<{ id: string; label: string; created_at: string; created_by?: string }>>(
    `/api/v1/zeus-firewall/targets/${id}/checkpoints`,
  )

export const rollbackFirewall = (id: string, checkpoint_id: string) =>
  platformFetch<unknown>(`/api/v1/zeus-firewall/targets/${id}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ checkpoint_id }),
  })

export const detectFirewallDrift = (id: string) =>
  platformFetch<{ drift_detected: boolean; summary: string; expected: string; actual: string }>(
    `/api/v1/zeus-firewall/targets/${id}/drift`,
  )

export const getK8sFirewallStatus = () =>
  platformFetch<Record<string, unknown>>('/api/v1/zeus-firewall/k8s/status')

export const planK8sFirewall = (namespace: string, profile: string) =>
  platformFetch<Record<string, unknown>>('/api/v1/zeus-firewall/k8s/plan', {
    method: 'POST',
    body: JSON.stringify({ namespace, profile, dry_run: true }),
  })

export const getCloudFirewallOverview = () =>
  platformFetch<Record<string, unknown>>('/api/v1/zeus-firewall/cloud/overview')

export interface GuestPortReport {
  vm_id: string
  vm_name: string
  agent_reachable: boolean
  ports: OpenPort[]
  summary: string
}

export const getVmGuestFirewallPorts = (vmId: string) =>
  platformFetch<GuestPortReport>(`/api/v1/zeus-firewall/vms/${vmId}/guest-ports`)

export const simulateConnectivity = (target_id: string, profile: string) =>
  platformFetch<Record<string, unknown>>('/api/v1/zeus-firewall/connectivity', {
    method: 'POST',
    body: JSON.stringify({ target_id, profile }),
  })

export const getPacketwolfAnomalies = () =>
  platformFetch<Record<string, unknown>>('/api/v1/zeus-firewall/packetwolf/anomalies')

export interface BaremetalFirewallOverview {
  servers: Array<{
    id: string
    hostname: string
    bmc_address: string
    firewall_profile: string
    risk: string
    score: number
    open_ports: number
  }>
  critical_count: number
  warning_count: number
  summary: string
}

export const getBaremetalFirewallOverview = () =>
  platformFetch<BaremetalFirewallOverview>('/api/v1/zeus-firewall/baremetal/overview')

export const scanBaremetalExposure = (id: string) =>
  platformFetch<Record<string, unknown>>(`/api/v1/zeus-firewall/baremetal/${id}/scan`, { method: 'POST' })

export const createBaremetalTemporaryRule = (
  id: string,
  body: { preset: 'pxe' | 'bmc'; reason: string; owner?: string },
) =>
  platformFetch<{ id: string; reason: string; expires_at: string }>(
    `/api/v1/zeus-firewall/baremetal/${id}/temporary`,
    { method: 'POST', body: JSON.stringify(body) },
  )

export interface FirewallApproval {
  id: string
  target_kind: string
  target_id: string
  profile?: string | null
  plan_json: Record<string, unknown>
  status: string
  requested_by: string
  reviewed_by?: string | null
  review_note?: string | null
  created_at: string
  reviewed_at?: string | null
}

export const listFirewallApprovals = (status?: string) =>
  platformFetch<FirewallApproval[]>(
    `/api/v1/zeus-firewall/approvals${status ? `?status=${encodeURIComponent(status)}` : ''}`,
  )

export const requestFirewallApproval = (body: { target_id: string; profile?: string }) =>
  platformFetch<FirewallApproval>('/api/v1/zeus-firewall/approvals', {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const approveFirewallChange = (id: string, note?: string) =>
  platformFetch<FirewallApproval>(`/api/v1/zeus-firewall/approvals/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })

export const rejectFirewallChange = (id: string, note?: string) =>
  platformFetch<FirewallApproval>(`/api/v1/zeus-firewall/approvals/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })

export const exportFirewallGitOps = () =>
  platformFetch<{ policies: Array<{ name: string; spec_yaml: string }>; exported_at: string }>(
    '/api/v1/zeus-firewall/policies/gitops/export',
  )

export const syncFirewallGitOps = (policies: Array<{ name: string; spec_yaml: string }>, replace = false) =>
  platformFetch<{ upserted: number; removed: number; sync_id: string }>(
    '/api/v1/zeus-firewall/policies/gitops/sync',
    {
      method: 'POST',
      body: JSON.stringify({ policies, replace }),
    },
  )

export interface ExposureFinOpsReport {
  fleet_exposure_monthly_usd: number
  idle_port_waste_usd: number
  cloud_sg_monthly_usd: number
  gpu_exposure_usd: number
  storage_exposure_usd: number
  mission_stack_network_usd: number
  public_port_alerts: string[]
  targets: Array<{
    target_id: string
    kind: string
    name: string
    team: string
    chargeback_tag: string
    open_ports: number
    critical_ports: number
    idle_port_waste_usd: number
    exposure_monthly_usd: number
    profile_multiplier: number
    alert?: string | null
  }>
  vm_idle_ranking: Array<{
    vm_id: string
    vm_name: string
    team: string
    idle_ports: number
    waste_usd: number
    rank: number
  }>
  cloud_attribution: {
    provider: string
    rule_count: number
    public_rules: number
    estimated_monthly_usd: number
  }
  chargeback_lines: Array<{
    line_id: string
    team: string
    category: string
    label: string
    monthly_usd: number
    chargeback_tag: string
  }>
  monthly_trend: Array<{ month: string; exposure_usd: number; idle_waste_usd: number }>
  summary: string
}

export const getFirewallExposureFinOps = () =>
  platformFetch<ExposureFinOpsReport>('/api/v1/zeus-firewall/finops/exposure')

export const getFirewallExposureFinOpsExportUrl = () =>
  `${DAEMON_API}/zeus-firewall/finops/exposure/export.csv`

export interface MultisiteOverview {
  sites: Array<{
    id: string
    name: string
    region: string
    role: string
    gitops_namespace: string
    lockdown_enabled: boolean
    geo_fence?: string | null
    dr_pair?: string | null
    target_count: number
    critical_count: number
  }>
  policy_conflicts: Array<{ id: string; policy_name: string; sites: string[]; detail: string }>
  compliance_rollup: { average_score: number; sites: Array<{ site: string; targets: number; critical: number; grade: string }> }
  summary: string
}

export const getMultisiteOverview = () =>
  platformFetch<MultisiteOverview>('/api/v1/zeus-firewall/multisite/overview')

export const getMultisiteDrTemplates = () =>
  platformFetch<{ primary_site: string; dr_site: string; profiles: Array<{ primary_profile: string; dr_profile: string; geo_fence?: string }>; summary: string }>(
    '/api/v1/zeus-firewall/multisite/dr-templates',
  )

export interface FleetSecurePlan {
  previews: Array<{
    host_id: string
    hostname: string
    current_score: number
    target_profile: string
    predicted_score: number
    risk: string
    monthly_exposure_usd: number
    requires_approval: boolean
    summary: string
  }>
  auto_eligible: number
  approval_required: number
  summary: string
}

export const getOperatorSecurePlan = () =>
  platformFetch<FleetSecurePlan>('/api/v1/zeus-firewall/operator/plan')
