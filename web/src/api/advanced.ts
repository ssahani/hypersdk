import { apiGet, apiPost, apiPostVoid, apiDelete } from './client'

const API = '/api/v1'

export interface CapabilitiesInfo {
  host_arch: string
  host_cpu_model: string
  guests: { os_type: string; arch: string; machines: string[] }[]
  spice_available: boolean
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
export const getDeviceXml = (name: string) => apiGet<string>(`${API}/devices/${encodeURIComponent(name)}`)
export const listNwfilters = () => apiGet<NwfilterInfo[]>(`${API}/nwfilters`)
export const getNwfilterXml = (name: string) => apiGet<string>(`${API}/nwfilters/${encodeURIComponent(name)}`)
export const defineNwfilter = (xml: string) => apiPost<{ status: string; name: string }>(`${API}/nwfilters`, { xml })
export const deleteNwfilter = (name: string) => apiDelete(`${API}/nwfilters/${encodeURIComponent(name)}`)
export const listSecrets = () => apiGet<SecretInfo[]>(`${API}/secrets`)

export interface DefineSecretRequest {
  xml: string
  value_base64?: string
  validate_xml?: boolean
  set_value_flags?: number
}

export const defineSecret = (req: DefineSecretRequest) =>
  apiPost<{ status: string; uuid: string }>(`${API}/secrets`, req)

export const deleteSecret = (uuid: string) => apiDelete(`${API}/secrets/${encodeURIComponent(uuid)}`)
export const getSecretXml = (uuid: string) => apiGet<string>(`${API}/secrets/${encodeURIComponent(uuid)}`)
export const createPool = (req: CreatePoolRequest) => apiPost<unknown>(`${API}/storage/pools`, req)
export const deletePool = (name: string) => apiDelete(`${API}/storage/pools/${encodeURIComponent(name)}`)
export const getPoolXml = (name: string) => apiGet<string>(`${API}/storage/pools/${encodeURIComponent(name)}/xml`)
export const resizeVolume = (pool: string, vol: string, capacityGb: number) => apiPostVoid(`${API}/storage/pools/${encodeURIComponent(pool)}/volumes/${encodeURIComponent(vol)}/resize`, { capacity_gb: capacityGb })
export const cloneVolume = (pool: string, vol: string, newName: string) => apiPostVoid(`${API}/storage/pools/${encodeURIComponent(pool)}/volumes/${encodeURIComponent(vol)}/clone`, { new_name: newName })

export const attachPciHostdev = (vmName: string, pci: string) =>
  apiPostVoid(`${API}/vms/${encodeURIComponent(vmName)}/hostdev/pci/attach`, { pci })

export const detachPciHostdev = (vmName: string, pci: string) =>
  apiPostVoid(`${API}/vms/${encodeURIComponent(vmName)}/hostdev/pci/detach`, { pci })

export const detachNodeDevice = (devName: string) =>
  apiPostVoid(`${API}/host/nodedev/${encodeURIComponent(devName)}/detach`)

export const reattachNodeDevice = (devName: string) =>
  apiPostVoid(`${API}/host/nodedev/${encodeURIComponent(devName)}/reattach`)
