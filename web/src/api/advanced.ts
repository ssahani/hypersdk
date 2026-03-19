import { apiGet, apiPost, apiPostVoid, apiDelete } from './client'

const API = '/api/v1'

export interface CapabilitiesInfo {
  host_arch: string
  host_cpu_model: string
  guests: { os_type: string; arch: string; machines: string[] }[]
}

export interface NodeDeviceInfo {
  name: string
  parent: string
  driver: string
  capability_type: string
}

export interface NwfilterInfo {
  name: string
  uuid: string
}

export interface SecretInfo {
  uuid: string
  usage_type: string
  usage_id: string
}

export interface CreatePoolRequest {
  name: string
  pool_type: string
  target_path: string
}

export const getCapabilities = () => apiGet<CapabilitiesInfo>(`${API}/capabilities`)
export const getSysinfo = () => apiGet<string>(`${API}/sysinfo`)
export const listDevices = () => apiGet<NodeDeviceInfo[]>(`${API}/devices`)
export const getDeviceXml = (name: string) => apiGet<string>(`${API}/devices/${name}`)
export const listNwfilters = () => apiGet<NwfilterInfo[]>(`${API}/nwfilters`)
export const getNwfilterXml = (name: string) => apiGet<string>(`${API}/nwfilters/${name}`)
export const deleteNwfilter = (name: string) => apiDelete(`${API}/nwfilters/${name}`)
export const listSecrets = () => apiGet<SecretInfo[]>(`${API}/secrets`)
export const deleteSecret = (uuid: string) => apiDelete(`${API}/secrets/${uuid}`)
export const createPool = (req: CreatePoolRequest) => apiPost<unknown>(`${API}/storage/pools`, req)
export const deletePool = (name: string) => apiDelete(`${API}/storage/pools/${name}`)
export const getPoolXml = (name: string) => apiGet<string>(`${API}/storage/pools/${name}/xml`)
export const resizeVolume = (pool: string, vol: string, capacityGb: number) => apiPostVoid(`${API}/storage/pools/${pool}/volumes/${vol}/resize`, { capacity_gb: capacityGb })
export const cloneVolume = (pool: string, vol: string, newName: string) => apiPostVoid(`${API}/storage/pools/${pool}/volumes/${vol}/clone`, { new_name: newName })
