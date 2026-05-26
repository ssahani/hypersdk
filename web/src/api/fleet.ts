import { readJsonObject, apiPost } from './client'

const API = '/api/v1'

export interface FleetPeerStatus {
  name: string
  url: string
  reachable: boolean
  error?: string
  version?: string
  vm_count?: number
  host_cpu_percent?: number
  host_memory_percent?: number
  vms_running?: number
}

export interface FleetVmRow {
  name: string
  state: string
  peer: string
  libvirt_connection?: string
}

export function getFleetStatus() {
  return readJsonObject<{
    enabled: boolean
    peers: FleetPeerStatus[]
    primary_peer?: string
    standby_peer?: string
  }>(`${API}/fleet/status`)
}

export function getFleetVms() {
  return readJsonObject<{ enabled: boolean; vms: FleetVmRow[] }>(`${API}/fleet/vms`)
}

export interface FleetCapacity {
  score: number
  label: 'low' | 'medium' | 'high' | string
}

export interface FleetMetricsResponse {
  enabled: boolean
  local: {
    host_cpu_percent: number
    host_memory_percent: number
    host_disk_percent?: number
    load_1: number
    vm_count: number
    vms_running: number
    capacity?: FleetCapacity
  }
  peers: Array<{
    name: string
    url: string
    reachable: boolean
    host_cpu_percent?: number
    host_memory_percent?: number
    host_disk_percent?: number
    vm_count?: number
    vms_running?: number
    capacity?: FleetCapacity
  }>
}

export function getFleetMetrics() {
  return readJsonObject<FleetMetricsResponse>(`${API}/fleet/metrics`)
}

export interface FleetAlertPeer {
  peer: string
  error?: string
  alerts: Array<{
    id: string
    rule_name: string
    message: string
    severity: string
    timestamp: string
    acknowledged: boolean
  }>
  unacknowledged: number
}

export function getFleetAlerts() {
  return readJsonObject<{
    enabled: boolean
    total_unacknowledged: number
    peers: FleetAlertPeer[]
  }>(`${API}/fleet/alerts`)
}

export function getFleetPrometheusTargets() {
  return readJsonObject<{
    enabled: boolean
    metrics_path: string
    note: string
    scrape_configs: unknown[]
  }>(`${API}/fleet/prometheus-targets`)
}

export function fleetPeerProxy(
  peer: string,
  method: string,
  path: string,
  body?: unknown,
) {
  return apiPost<{ peer: string; status: number; body: unknown }>(
    `${API}/fleet/peers/${encodeURIComponent(peer)}/proxy`,
    { method, path, body },
  )
}
