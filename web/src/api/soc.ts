// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { platformFetch } from './platform'

export interface SocOverview {
  open_alerts: number
  events_24h: number
  critical_alerts: number
}

export interface SocEvent {
  id: string
  occurred_at: string
  source: string
  category: string
  severity: string
  host_id?: string
  vm_id?: string
  actor?: string
  summary: string
}

export interface SocAlert {
  id: string
  rule_id?: string
  title: string
  severity: string
  status: string
  assigned_to?: string
  first_seen: string
  last_seen: string
  event_count: number
}

export interface SocRule {
  id: string
  name: string
  description: string
  enabled: boolean
  severity: string
  query_json: Record<string, unknown>
  throttle_minutes: number
  builtin: boolean
}

export interface SocIntegration {
  id: string
  integration_type: string
  name: string
  enabled: boolean
  config: Record<string, unknown>
  last_success_at?: string
  last_error?: string
}

export interface AsmSummary {
  exposure_score: number
  firewall_targets: number
  high_risk_nodes: number
  open_port_findings: Array<{ kind: string; resource: string; detail: string; severity: string }>
  recommendations: string[]
}

export const getSocOverview = () => platformFetch<SocOverview>('/api/v1/soc/overview')

export const getSocEvents = (limit = 100) =>
  platformFetch<SocEvent[]>(`/api/v1/soc/events?limit=${limit}`)

export const getSocAlerts = (params?: { status?: string; limit?: number }) => {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.limit) qs.set('limit', String(params.limit))
  const q = qs.toString()
  return platformFetch<SocAlert[]>(`/api/v1/soc/alerts${q ? `?${q}` : ''}`)
}

export const patchSocAlert = (id: string, body: { status?: string; assigned_to?: string }) =>
  platformFetch<SocAlert>(`/api/v1/soc/alerts/${id}`, { method: 'PATCH', body: JSON.stringify(body) })

export const getSocRules = () => platformFetch<SocRule[]>('/api/v1/soc/rules')

export const patchSocRule = (id: string, body: { enabled?: boolean }) =>
  platformFetch<SocRule>(`/api/v1/soc/rules/${id}`, { method: 'PATCH', body: JSON.stringify(body) })

export const testSocRule = (id: string, hours = 24) =>
  platformFetch<{ match_count: number; would_fire: boolean }>(
    `/api/v1/soc/rules/${id}/test?hours=${hours}`,
    { method: 'POST' },
  )

export const getAsmSummary = () => platformFetch<AsmSummary>('/api/v1/soc/asm/summary')

export const getSplunkIntegration = () =>
  platformFetch<SocIntegration>('/api/v1/soc/integrations/splunk')

export const putSplunkIntegration = (body: {
  url: string
  token: string
  index?: string
  sourcetype_events?: string
  sourcetype_alerts?: string
  host?: string
  enabled?: boolean
}) =>
  platformFetch<SocIntegration>('/api/v1/soc/integrations/splunk', {
    method: 'PUT',
    body: JSON.stringify(body),
  })

export const testSplunkIntegration = () =>
  platformFetch<{ ok: boolean; message: string }>('/api/v1/soc/integrations/splunk/test', {
    method: 'POST',
  })

export const getSocIntegrations = () => platformFetch<SocIntegration[]>('/api/v1/soc/integrations')

export const patchSocIntegration = (
  integrationType: string,
  body: { enabled?: boolean; config_json?: Record<string, unknown> },
) =>
  platformFetch<SocIntegration>(`/api/v1/soc/integrations/${integrationType}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

export const testSocIntegration = (integrationType: string) =>
  platformFetch<{ ok: boolean; message: string }>(
    `/api/v1/soc/integrations/${integrationType}/test`,
    { method: 'POST' },
  )

export const replaySocForward = (hours = 24) =>
  platformFetch<{ forwarded: number }>(`/api/v1/soc/forward/replay?hours=${hours}`, { method: 'POST' })
