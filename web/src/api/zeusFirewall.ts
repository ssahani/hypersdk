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

export const planFirewall = (id: string, body: Record<string, unknown>) =>
  platformFetch<{ diff: unknown; operations: string[] }>(`/api/v1/zeus-firewall/targets/${id}/plan`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const applyFirewall = (id: string, body: Record<string, unknown>) =>
  platformFetch<{ diff: unknown; operations: string[] }>(`/api/v1/zeus-firewall/targets/${id}/apply`, {
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
