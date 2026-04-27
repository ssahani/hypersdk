import { apiGet, apiPost, apiDelete } from './client'

const API = '/api/v1'

export interface HostInterface {
  name: string
  iface_type: string
  state: string
  mac: string
  ipv4: string[]
  mtu: number
  master: string
}

export interface PortForwardRule {
  id: string
  protocol: string
  host_port: number
  vm_ip: string
  vm_port: number
  description: string
}

export interface FirewallRule {
  id: string
  vm_ip: string
  direction: string
  protocol: string
  port: number
  action: string
  description: string
}

export interface CreateBridgeRequest {
  name: string
  interfaces: string[]
  mtu: number
  stp: boolean
}

export interface CreatePortForwardRequest {
  protocol: string
  host_port: number
  vm_ip: string
  vm_port: number
  description?: string
}

export interface CreateFirewallRuleRequest {
  vm_ip: string
  direction: string
  protocol: string
  port: number
  action: string
  description?: string
}

export interface SysctlTuningRow {
  key: string
  recommended: string
  current: string | null
  current_error: string | null
}

export interface SysctlTuningResponse {
  dropin_path: string
  recommended_conf: string
  rows: SysctlTuningRow[]
  notes: string[]
}

export interface SystemdNetworkDiagnostics {
  systemd_networkd_active: boolean
  network_manager_active: boolean
  networkctl_list: string
  networkctl_status_all: string
  resolvectl_status: string
  resolvectl_statistics: string
  networkd_recent_logs: string
  resolved_recent_logs: string
}

// Host interfaces
export const listHostInterfaces = () => apiGet<HostInterface[]>(`${API}/host/interfaces`)

/** Recommended sysctl drop-in + current runtime values (hypervisor / high-concurrency tuning). */
export const getSysctlTuning = () => apiGet<SysctlTuningResponse>(`${API}/host/sysctl-tuning`)
export const getSystemdNetworkDiagnostics = () => apiGet<SystemdNetworkDiagnostics>(`${API}/host/network-diag`)
export const getSystemdInterfaceStatus = (name: string) =>
  apiGet<{ interface: string; status: string }>(`${API}/host/network-diag/interface/${encodeURIComponent(name)}`)

// Bridges
export const createBridge = (req: CreateBridgeRequest) => apiPost<unknown>(`${API}/host/bridges`, req)
export const deleteBridge = (name: string) => apiDelete(`${API}/host/bridges/${encodeURIComponent(name)}`)

// Port forwarding
export const listPortForwards = () => apiGet<PortForwardRule[]>(`${API}/portforward`)
export const createPortForward = (req: CreatePortForwardRequest) => apiPost<unknown>(`${API}/portforward`, req)
export const deletePortForward = (req: { protocol: string; host_port: number; vm_ip: string; vm_port: number }) =>
  apiPost<unknown>(`${API}/portforward/delete`, req)

// Firewall
export const listFirewallRules = () => apiGet<FirewallRule[]>(`${API}/firewall`)
export const createFirewallRule = (req: CreateFirewallRuleRequest) => apiPost<unknown>(`${API}/firewall`, req)
export const deleteFirewallRule = (req: CreateFirewallRuleRequest) => apiPost<unknown>(`${API}/firewall/delete`, req)
