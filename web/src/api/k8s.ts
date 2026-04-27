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
  /** Heuristic: k3s, rke2, eks, gke, aks, minikube, kind, generic, unknown */
  distribution?: string
  distribution_hints?: string[]
  extra_resource_counts?: Record<string, number>
}

export interface K8sHostSignals {
  k3s_config_present: boolean
  k3s_data_dir_present: boolean
  rke2_config_present: boolean
  rke2_data_dir_present: boolean
  k3s_systemd: string
  k3s_agent_systemd: string
  rke2_server_systemd: string
  rke2_agent_systemd: string
  k3s_binary_version: string | null
  rke2_binary_version: string | null
  helm_version: string | null
  crictl_version: string | null
}

export interface K8sEnvironment {
  kubectl_on_path: boolean
  kubectl_client_version: string | null
  kubectl_server_reachable: boolean
  kubeconfig_hint: string | null
  kubeconfig_from_env: boolean
  /** When set, machina-daemon injects this file as `--kubeconfig` for kubectl (auto-detected). */
  kubeconfig_auto_selected?: string | null
  current_context: string | null
  cluster_distribution: string
  cluster_distribution_hints: string[]
  host: K8sHostSignals
  snippets: Record<string, string>
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
  name?: string
  namespace?: string
}

/** Standard Kubernetes list item with nested metadata. */
export interface K8sMetadataName {
  metadata?: { name?: string; namespace?: string }
}

export interface K8sDeployment {
  metadata: K8sObjectMeta
  spec?: { replicas?: number }
  status?: { readyReplicas?: number; replicas?: number; availableReplicas?: number }
}

export interface K8sPod {
  metadata: K8sObjectMeta
  spec?: { nodeName?: string }
  status?: { phase?: string; podIP?: string; hostIP?: string }
}

export interface K8sServicePort {
  name?: string
  port?: number
  /** Service target; may be number or named port string from pod spec. */
  targetPort?: number | string
  nodePort?: number
  protocol?: string
}

export interface K8sService {
  metadata?: K8sObjectMeta & { labels?: Record<string, string> }
  spec?: {
    type?: string
    clusterIP?: string
    /** Selectors for VM-expose Services often include `kubevirt.io/vmName` or `kubevirt.io/domain`. */
    selector?: Record<string, string>
    ports?: K8sServicePort[]
  }
  status?: {
    loadBalancer?: {
      ingress?: Array<{ ip?: string; hostname?: string }>
    }
  }
}

/** KubeVirt `VirtualMachine` (`virtualmachines.kubevirt.io`). */
export interface K8sKubeVirtVM {
  metadata?: { name?: string; namespace?: string }
  spec?: { running?: boolean }
  status?: { printableStatus?: string; ready?: boolean; created?: boolean }
}

/** VM + VMI merge from `GET /k8s/kubevirt/vm-summary`. */
export interface KubeVirtVmSummaryRow {
  name: string
  namespace: string
  spec_running?: boolean | null
  vm_printable_status?: string | null
  vm_ready?: boolean | null
  guest_ip?: string | null
  pod_ip?: string | null
  vmi_phase?: string | null
  node_name?: string | null
  node_internal_ip?: string | null
  virtctl_console: string
  virtctl_vnc: string
  virtctl_vnc_socks: string
  vnc_subresource_path: string
}

export interface K8sListResponse<T> {
  items: T[]
}

export type K8sNamespaceList = K8sListResponse<K8sMetadataName>

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
export const getK8sEnvironment = () => apiGet<K8sEnvironment>(`${API}/k8s/environment`)
export const getK8sNodes = () => apiGet<K8sNodeInfo[]>(`${API}/k8s/nodes`)
export const getK8sNamespaces = () => apiGet<K8sNamespaceList>(`${API}/k8s/namespaces`)
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

export const getK8sKubevirtVirtualMachines = (namespace?: string) =>
  apiGet<K8sListResponse<K8sKubeVirtVM>>(
    namespace
      ? `${API}/k8s/kubevirt/virtualmachines?namespace=${encodeURIComponent(namespace)}`
      : `${API}/k8s/kubevirt/virtualmachines?all_namespaces=true`,
  )

export const getK8sKubevirtVmSummary = (namespace?: string) =>
  apiGet<KubeVirtVmSummaryRow[]>(
    namespace
      ? `${API}/k8s/kubevirt/vm-summary?namespace=${encodeURIComponent(namespace)}`
      : `${API}/k8s/kubevirt/vm-summary?all_namespaces=true`,
  )

export const runK8sAction = (body: K8sActionRequest) => apiPost<K8sActionResult>(`${API}/k8s/action`, body)
