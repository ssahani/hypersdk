import { apiGet, apiPost } from './client'

const API = '/api/v1'

export interface K8sOverview {
  version: string
  nodes: number
  ready_nodes: number
  namespaces: number
  pods: number
  deployments: number
  services: number
}

export interface K8sNodeInfo {
  name: string
  roles: string[]
  ready: boolean
  kubelet_version: string
  os_image: string
  kernel_version: string
  container_runtime: string
  architecture: string
  capacity: Record<string, string>
  allocatable: Record<string, string>
  labels: Record<string, string>
}

export interface K8sObjectMeta {
  name: string
  namespace?: string
}

export interface K8sDeployment {
  metadata: K8sObjectMeta
  spec?: { replicas?: number }
  status?: { readyReplicas?: number; replicas?: number; availableReplicas?: number }
}

export interface K8sPod {
  metadata: K8sObjectMeta
  status?: { phase?: string; podIP?: string; hostIP?: string }
}

export interface K8sService {
  metadata: K8sObjectMeta
  spec?: { type?: string; clusterIP?: string; ports?: Array<{ port?: number; protocol?: string }> }
}

export interface K8sListResponse<T> {
  items: T[]
}

export type K8sAction =
  | 'node_cordon'
  | 'node_uncordon'
  | 'node_drain'
  | 'rollout_restart_deployment'
  | 'delete_pod'
  | 'scale_deployment'

export interface K8sActionRequest {
  action: K8sAction
  name: string
  namespace?: string
  replicas?: number
}

export interface K8sActionResult {
  command: string
  stdout: string
  stderr: string
  exit_code: number
  ok: boolean
}

export const getK8sOverview = () => apiGet<K8sOverview>(`${API}/k8s/overview`)
export const getK8sNodes = () => apiGet<K8sNodeInfo[]>(`${API}/k8s/nodes`)
export const getK8sNamespaces = () => apiGet<K8sListResponse<K8sObjectMeta>>(`${API}/k8s/namespaces`)
export const getK8sPods = (namespace?: string) =>
  apiGet<K8sListResponse<K8sPod>>(
    namespace ? `${API}/k8s/pods?namespace=${encodeURIComponent(namespace)}` : `${API}/k8s/pods?all_namespaces=true`,
  )
export const getK8sDeployments = (namespace?: string) =>
  apiGet<K8sListResponse<K8sDeployment>>(
    namespace ? `${API}/k8s/deployments?namespace=${encodeURIComponent(namespace)}` : `${API}/k8s/deployments?all_namespaces=true`,
  )
export const getK8sServices = (namespace?: string) =>
  apiGet<K8sListResponse<K8sService>>(
    namespace ? `${API}/k8s/services?namespace=${encodeURIComponent(namespace)}` : `${API}/k8s/services?all_namespaces=true`,
  )

export const runK8sAction = (body: K8sActionRequest) => apiPost<K8sActionResult>(`${API}/k8s/action`, body)
