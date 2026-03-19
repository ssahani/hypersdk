import { apiGet, apiPost, apiPostVoid, apiDelete } from './client'

const API = '/api/v1'

export interface NetworkInfo {
  name: string
  uuid: string
  active: boolean
  persistent: boolean
  autostart: boolean
  bridge: string
}

export interface CreateNetworkRequest {
  name: string
  subnet: string
  dhcp_start: string
  dhcp_end: string
}

export const listNetworks = () => apiGet<NetworkInfo[]>(`${API}/networks`)
export const createNetwork = (req: CreateNetworkRequest) => apiPost<unknown>(`${API}/networks`, req)
export const deleteNetwork = (name: string) => apiDelete(`${API}/networks/${name}`)
export const startNetwork = (name: string) => apiPostVoid(`${API}/networks/${name}/start`)
export const stopNetwork = (name: string) => apiPostVoid(`${API}/networks/${name}/stop`)
export const getNetworkXml = (name: string) => apiGet<string>(`${API}/networks/${name}/xml`)
export const setNetworkAutostart = (name: string, enabled: boolean) => apiPostVoid(`${API}/networks/${name}/autostart/${enabled}`)
