// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { platformFetch, getControllerBase, platformHeaders } from './platform'

export interface AiSettings {
  enabled: boolean
  mode: string
  provider: string
  model: string
  api_key_configured: boolean
  autopilot_interval_secs: number
  autopilot_last_run?: string
}

export interface SpotlightIntent {
  id: string
  label: string
  review: string
  action: string
  vm_name?: string
  navigate?: string
}

export interface SpotlightResult {
  intents: SpotlightIntent[]
  search_hits: Array<{ kind: string; id: string; label: string; sublabel?: string }>
  suggested_action?: SpotlightIntent
}

export interface CopilotResponse {
  reply: string
  deterministic: boolean
  context_summary?: string
}

export interface VmDoctorReport {
  vm_id: string
  vm_name: string
  score: string
  score_numeric: number
  score_label: string
  healthy: boolean
  checks_passed: number
  checks_total: number
  issues: Array<{
    id: string
    severity: string
    message: string
    remediation?: string
    fix_action?: string
    fix_label?: string
  }>
  guest_tools_status: string
}

export interface MigrationAdvisorReport {
  vm_name: string
  provider: string
  readiness_percent: number
  safe: string[]
  risks: string[]
  recommended_target: Record<string, unknown>
  remediation: string[]
}

export interface CostAnalysis {
  estimated_monthly_usd: number
  vm_count: number
  idle_vm_count: number
  oversized_vm_count: number
  snapshot_heavy_count: number
  suggestions: string[]
}

export interface CapacityPlan {
  hosts_online: number
  memory_headroom_mib: number
  avg_cpu_percent: number
  storage_used_gib: number
  storage_capacity_gib: number
  storage_runway_days?: number
  cpu_headroom_percent: number
  estimated_small_vms_addable: number
  recommendations: string[]
}

export interface SecurityReport {
  risk_level: string
  findings: Array<{
    id: string
    severity: string
    title: string
    detail: string
    remediation: string
  }>
}

export const getAiSettings = () => platformFetch<AiSettings>('/api/v1/ai/settings')
export const patchAiSettings = (body: Partial<AiSettings & { api_key?: string }>) =>
  platformFetch<AiSettings>('/api/v1/ai/settings', { method: 'PATCH', body: JSON.stringify(body) })

export const aiSpotlight = (query: string) =>
  platformFetch<SpotlightResult>('/api/v1/ai/spotlight', { method: 'POST', body: JSON.stringify({ query }) })

export const aiCopilotChat = (message: string, vmId?: string) =>
  platformFetch<CopilotResponse>('/api/v1/ai/copilot/chat', {
    method: 'POST',
    body: JSON.stringify({ message, vm_id: vmId }),
  })

export interface CopilotStreamEvent {
  type: 'chunk' | 'done' | 'error'
  text?: string
  deterministic?: boolean
  context_summary?: string
  message?: string
}

export async function aiCopilotStream(
  message: string,
  vmId: string | undefined,
  onEvent: (ev: CopilotStreamEvent) => void,
): Promise<void> {
  const url = `${getControllerBase()}/api/v1/ai/copilot/stream`
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: platformHeaders(),
    body: JSON.stringify({ message, vm_id: vmId }),
  })
  if (!res.ok) {
    throw new Error(`Copilot stream failed (HTTP ${res.status})`)
  }
  if (!res.body) throw new Error('Copilot stream: empty response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6).trim()
        if (!payload) continue
        onEvent(JSON.parse(payload) as CopilotStreamEvent)
      }
    }
  }
}

export const aiExplain = (screen: string, objectRef: Record<string, unknown> = {}) =>
  platformFetch<{ explanation: string }>('/api/v1/ai/explain', {
    method: 'POST',
    body: JSON.stringify({ screen, object_ref: objectRef }),
  })

export const aiRunbook = (incident: string, context: Record<string, unknown> = {}) =>
  platformFetch<{ incident: string; title: string; steps: string[]; commands: string[]; summary?: string }>(
    '/api/v1/ai/runbook',
    { method: 'POST', body: JSON.stringify({ incident, context }) },
  )

export const aiGenerateBlueprint = (prompt: string) =>
  platformFetch<{ name: string; description: string; actions: string[]; notes: string }>(
    '/api/v1/ai/blueprints/generate',
    { method: 'POST', body: JSON.stringify({ prompt }) },
  )

export const getAiCost = () => platformFetch<CostAnalysis>('/api/v1/ai/cost')
export const getAiCapacity = () => platformFetch<CapacityPlan>('/api/v1/ai/capacity')
export const getAiSecurity = () => platformFetch<SecurityReport>('/api/v1/ai/security')

export const getVmDoctor = (vmId: string) => platformFetch<VmDoctorReport>(`/api/v1/vms/${vmId}/doctor`)

export const getMigrationAdvisor = (vm: string, provider = 'vmware', os?: string) => {
  const q = new URLSearchParams({ vm, provider })
  if (os) q.set('os', os)
  return platformFetch<MigrationAdvisorReport>(`/api/v1/migrations/advisor?${q}`)
}

export const aiNetworkExplain = (vm_a: string, vm_b: string, port?: number) =>
  platformFetch<{ can_reach: boolean; explanation: string; hops: string[]; remediation: string }>(
    '/api/v1/ai/network/explain',
    { method: 'POST', body: JSON.stringify({ vm_a, vm_b, port }) },
  )

export interface PolicyExport {
  yaml: string
  rule_count: number
  quota_count: number
}

export const getAiPolicyExport = () => platformFetch<PolicyExport>('/api/v1/ai/policy/export')

export interface ProposedAction {
  id: string
  label: string
  review: string
  risk: string
  action_type: string
  object_ref: Record<string, unknown>
}

export interface AutopilotProposal {
  mode: string
  actions: ProposedAction[]
}

export interface ComplianceReport {
  score: number
  grade: string
  summary: string
  checks: Array<{ id: string; name: string; passed: boolean; score: number; detail: string }>
  markdown: string
  finding_count: number
}

export const getAutopilotProposal = (vmId?: string) => {
  const q = vmId ? `?vm_id=${encodeURIComponent(vmId)}` : ''
  return platformFetch<AutopilotProposal>(`/api/v1/ai/autopilot/propose${q}`)
}

export const executeAutopilotAction = (action_type: string, object_ref: Record<string, unknown> = {}) =>
  platformFetch<{ message: string; task_ids: string[] }>('/api/v1/ai/autopilot/execute', {
    method: 'POST',
    body: JSON.stringify({ action_type, object_ref }),
  })

export const getAiCompliance = () => platformFetch<ComplianceReport>('/api/v1/ai/compliance')

export const getAiComplianceExportUrl = () => `${getControllerBase()}/api/v1/ai/compliance/export`

export const getAiCompliancePdfUrl = () => `${getControllerBase()}/api/v1/ai/compliance/export.pdf`

export interface TerminalSuggestResult {
  vm_name: string
  observed_state: string
  suggestions: Array<{ label: string; command: string; description: string; scope: string }>
  notes: string
}

export const aiTerminalSuggest = (vmId?: string, vmName?: string) =>
  platformFetch<TerminalSuggestResult>('/api/v1/ai/terminal/suggest', {
    method: 'POST',
    body: JSON.stringify({ vm_id: vmId, vm_name: vmName }),
  })

export const runAutopilotSafe = (vmId?: string, maxActions = 3) =>
  platformFetch<{ executed_count: number; skipped_count: number; results: Array<{ message: string }> }>(
    '/api/v1/ai/autopilot/run',
    { method: 'POST', body: JSON.stringify({ vm_id: vmId, max_actions: maxActions }) },
  )

export interface AutopilotHistoryEntry {
  id: string
  actor: string
  action: string
  created_at: string
  detail: Record<string, unknown>
}

export const getAutopilotHistory = (limit = 20) =>
  platformFetch<AutopilotHistoryEntry[]>(`/api/v1/ai/autopilot/history?limit=${limit}`)

export const getAiCostExportUrl = () => `${getControllerBase()}/api/v1/ai/cost/export.csv`
