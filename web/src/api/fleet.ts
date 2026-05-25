import { readJsonObject, apiPost } from './client'

const API = '/api/v1'

export interface FleetPeerStatus {
  name: string
  url: string
  reachable: boolean
  error?: string
  version?: string
  vm_count?: number
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
