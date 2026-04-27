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
  | 'rollout_restart_stateful_set'
  | 'rollout_restart_daemon_set'
  | 'delete_pod'
  | 'delete_job'
  | 'scale_deployment'
  | 'scale_stateful_set'

export interface K8sActionRequest {
  action: K8sAction
  name: string
  namespace?: string
  replicas?: number
  context?: string
}

export interface K8sActionResult {
  command: string
  stdout: string
  stderr: string
  exit_code: number
  ok: boolean
}

function withK8sContext(base: string, context?: string): string {
  const c = context?.trim()
  if (!c) return base
  return `${base}${base.includes('?') ? '&' : '?'}context=${encodeURIComponent(c)}`
}

export const getK8sOverview = (context?: string) =>
  apiGet<K8sOverview>(withK8sContext(`${API}/k8s/overview`, context))

export const getK8sEnvironment = () => apiGet<K8sEnvironment>(`${API}/k8s/environment`)

export const getK8sContexts = () => apiGet<{ contexts: string[] }>(`${API}/k8s/contexts`)

export const getK8sNodes = (context?: string) =>
  apiGet<K8sNodeInfo[]>(withK8sContext(`${API}/k8s/nodes`, context))

export const getK8sNamespaces = (context?: string) =>
  apiGet<K8sNamespaceList>(withK8sContext(`${API}/k8s/namespaces`, context))

export const getK8sPods = (namespace?: string, context?: string) =>
  apiGet<K8sListResponse<K8sPod>>(
    withK8sContext(
      namespace ? `${API}/k8s/pods?namespace=${encodeURIComponent(namespace)}` : `${API}/k8s/pods?all_namespaces=true`,
      context,
    ),
  )

export const getK8sDeployments = (namespace?: string, context?: string) =>
  apiGet<K8sListResponse<K8sDeployment>>(
    withK8sContext(
      namespace
        ? `${API}/k8s/deployments?namespace=${encodeURIComponent(namespace)}`
        : `${API}/k8s/deployments?all_namespaces=true`,
      context,
    ),
  )

export const getK8sServices = (namespace?: string, context?: string) =>
  apiGet<K8sListResponse<K8sService>>(
    withK8sContext(
      namespace ? `${API}/k8s/services?namespace=${encodeURIComponent(namespace)}` : `${API}/k8s/services?all_namespaces=true`,
      context,
    ),
  )

export const getK8sStatefulSets = (namespace?: string, context?: string) =>
  apiGet<K8sListResponse<K8sDeployment>>(
    withK8sContext(
      namespace
        ? `${API}/k8s/statefulsets?namespace=${encodeURIComponent(namespace)}`
        : `${API}/k8s/statefulsets?all_namespaces=true`,
      context,
    ),
  )

export const getK8sDaemonSets = (namespace?: string, context?: string) =>
  apiGet<K8sListResponse<K8sDeployment>>(
    withK8sContext(
      namespace ? `${API}/k8s/daemonsets?namespace=${encodeURIComponent(namespace)}` : `${API}/k8s/daemonsets?all_namespaces=true`,
      context,
    ),
  )

export const getK8sJobs = (namespace?: string, context?: string) =>
  apiGet<K8sListResponse<K8sMetadataName>>(
    withK8sContext(
      namespace ? `${API}/k8s/jobs?namespace=${encodeURIComponent(namespace)}` : `${API}/k8s/jobs?all_namespaces=true`,
      context,
    ),
  )

export const getK8sCronJobs = (namespace?: string, context?: string) =>
  apiGet<K8sListResponse<K8sMetadataName>>(
    withK8sContext(
      namespace ? `${API}/k8s/cronjobs?namespace=${encodeURIComponent(namespace)}` : `${API}/k8s/cronjobs?all_namespaces=true`,
      context,
    ),
  )

export const getK8sIngresses = (namespace?: string, context?: string) =>
  apiGet<K8sListResponse<K8sMetadataName>>(
    withK8sContext(
      namespace ? `${API}/k8s/ingresses?namespace=${encodeURIComponent(namespace)}` : `${API}/k8s/ingresses?all_namespaces=true`,
      context,
    ),
  )

export const getK8sPersistentVolumeClaims = (namespace?: string, context?: string) =>
  apiGet<K8sListResponse<K8sMetadataName>>(
    withK8sContext(
      namespace
        ? `${API}/k8s/persistentvolumeclaims?namespace=${encodeURIComponent(namespace)}`
        : `${API}/k8s/persistentvolumeclaims?all_namespaces=true`,
      context,
    ),
  )

export const getK8sPersistentVolumes = (context?: string) =>
  apiGet<{ items: unknown[] }>(withK8sContext(`${API}/k8s/persistentvolumes`, context))

export const getK8sStorageClasses = (context?: string) =>
  apiGet<{ items: unknown[] }>(withK8sContext(`${API}/k8s/storageclasses`, context))

export const getK8sEvents = (opts: { namespace?: string; allNamespaces?: boolean; context?: string }) => {
  const q: string[] = []
  if (opts.allNamespaces) q.push('all_namespaces=true')
  else if (opts.namespace) q.push(`namespace=${encodeURIComponent(opts.namespace)}`)
  else q.push('namespace=default')
  let url = `${API}/k8s/events?${q.join('&')}`
  url = withK8sContext(url, opts.context)
  return apiGet<{ items: unknown[] }>(url)
}

export const getK8sPodLogs = (opts: {
  pod: string
  namespace?: string
  container?: string
  tailLines?: number
  previous?: boolean
  context?: string
}) => {
  const q = new URLSearchParams()
  q.set('pod', opts.pod)
  if (opts.namespace) q.set('namespace', opts.namespace)
  if (opts.container) q.set('container', opts.container)
  if (opts.tailLines != null) q.set('tail_lines', String(opts.tailLines))
  if (opts.previous) q.set('previous', 'true')
  let url = `${API}/k8s/logs?${q.toString()}`
  url = withK8sContext(url, opts.context)
  return apiGet<K8sActionResult>(url)
}

export const postK8sApply = (manifest: string, dryRun?: boolean, context?: string) =>
  apiPost<K8sActionResult>(`${API}/k8s/apply`, { manifest, dry_run: dryRun, context })

export const postK8sAuthCanI = (body: {
  verb: string
  resource: string
  namespace?: string
  resource_name?: string
  context?: string
}) => apiPost<K8sActionResult>(`${API}/k8s/auth-can-i`, body)

export const getK8sHelmReleases = (namespace?: string, context?: string) => {
  const q = new URLSearchParams()
  if (namespace) q.set('namespace', namespace === '*' ? 'all' : namespace)
  let url = `${API}/k8s/helm/releases${q.toString() ? `?${q}` : ''}`
  url = withK8sContext(url, context)
  return apiGet<unknown>(url)
}

export const getK8sKubevirtVirtualMachines = (namespace?: string, context?: string) =>
  apiGet<K8sListResponse<K8sKubeVirtVM>>(
    withK8sContext(
      namespace
        ? `${API}/k8s/kubevirt/virtualmachines?namespace=${encodeURIComponent(namespace)}`
        : `${API}/k8s/kubevirt/virtualmachines?all_namespaces=true`,
      context,
    ),
  )

export const getK8sKubevirtVmSummary = (namespace?: string, context?: string) =>
  apiGet<KubeVirtVmSummaryRow[]>(
    withK8sContext(
      namespace
        ? `${API}/k8s/kubevirt/vm-summary?namespace=${encodeURIComponent(namespace)}`
        : `${API}/k8s/kubevirt/vm-summary?all_namespaces=true`,
      context,
    ),
  )

export const runK8sAction = (body: K8sActionRequest) => apiPost<K8sActionResult>(`${API}/k8s/action`, body)
