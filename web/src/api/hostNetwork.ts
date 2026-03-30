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

// Host interfaces
export const listHostInterfaces = () => apiGet<HostInterface[]>(`${API}/host/interfaces`)

// Bridges
export const createBridge = (req: CreateBridgeRequest) => apiPost<unknown>(`${API}/host/bridges`, req)
export const deleteBridge = (name: string) => apiDelete(`${API}/host/bridges/${name}`)

// Port forwarding
export const listPortForwards = () => apiGet<PortForwardRule[]>(`${API}/portforward`)
export const createPortForward = (req: CreatePortForwardRequest) => apiPost<unknown>(`${API}/portforward`, req)
export const deletePortForward = (req: { protocol: string; host_port: number; vm_ip: string; vm_port: number }) =>
  apiPost<unknown>(`${API}/portforward/delete`, req)

// Firewall
export const listFirewallRules = () => apiGet<FirewallRule[]>(`${API}/firewall`)
export const createFirewallRule = (req: CreateFirewallRuleRequest) => apiPost<unknown>(`${API}/firewall`, req)
export const deleteFirewallRule = (req: CreateFirewallRuleRequest) => apiPost<unknown>(`${API}/firewall/delete`, req)
