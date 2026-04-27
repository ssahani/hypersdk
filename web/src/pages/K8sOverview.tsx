import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CheckCircle2, RefreshCw, ShieldAlert, Server } from 'lucide-react'
import K8sConnectionErrorBanner from '../components/K8sConnectionErrorBanner'
import { summarizeK8sClientError } from '../utils/k8sErrors'
import {
  getK8sEnvironment,
  getK8sNodes,
  getK8sOverview,
  K8sEnvironment,
  K8sNodeInfo,
  runK8sAction,
} from '../api/k8s'
import { useToastContext } from '../contexts/ToastContext'

type NodeAction = 'node_cordon' | 'node_uncordon' | 'node_drain'

export default function K8sOverviewPage() {
  const toast = useToastContext()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getK8sOverview>> | null>(null)
  const [environment, setEnvironment] = useState<K8sEnvironment | null>(null)
  const [nodes, setNodes] = useState<K8sNodeInfo[]>([])
  const [acting, setActing] = useState<string | null>(null)
  const [lastCommand, setLastCommand] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true)
    try {
      const [ov, n] = await Promise.all([getK8sOverview(), getK8sNodes()])
      setOverview(ov)
      setNodes(n)
      setLoadError(null)
      try {
        setEnvironment(await getK8sEnvironment())
      } catch {
        setEnvironment(null)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setLoadError(msg)
      setOverview(null)
      setNodes([])
      try {
        setEnvironment(await getK8sEnvironment())
      } catch {
        setEnvironment(null)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const runNodeAction = useCallback(async (name: string, action: NodeAction) => {
    setActing(`${action}:${name}`)
    try {
      const result = await runK8sAction({ action, name })
      setLastCommand(result.command)
      toast.success(result.stdout.trim() || `${action} succeeded for ${name}`)
      await load(true)
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e)
      toast.error(`Action failed: ${summarizeK8sClientError(raw).headline}`)
    } finally {
      setActing(null)
    }
  }, [load, toast])

  const counts = useMemo(() => {
    const extra = overview?.extra_resource_counts ?? {}
    const base = [
      { label: 'Nodes', value: overview?.nodes ?? 0 },
      { label: 'Ready nodes', value: overview?.ready_nodes ?? 0 },
      { label: 'Namespaces', value: overview?.namespaces ?? 0 },
      { label: 'Pods', value: overview?.pods ?? 0 },
      { label: 'Deployments', value: overview?.deployments ?? 0 },
      { label: 'Services', value: overview?.services ?? 0 },
    ]
    const tail = [
      { label: 'StatefulSets', value: extra.statefulsets ?? 0 },
      { label: 'DaemonSets', value: extra.daemonsets ?? 0 },
      { label: 'CronJobs', value: extra.cronjobs ?? 0 },
      { label: 'Jobs', value: extra.jobs ?? 0 },
      { label: 'PVs', value: extra.persistentvolumes ?? 0 },
      { label: 'PVCs', value: extra.persistentvolumeclaims ?? 0 },
      { label: 'StorageClasses', value: extra.storageclasses ?? 0 },
      { label: 'Ingresses', value: extra.ingresses ?? 0 },
      { label: 'APIServices', value: extra.apiservices ?? 0 },
      { label: 'KubeVirt VMs', value: extra.kubevirt_virtualmachines ?? 0 },
    ]
    return [...base, ...tail]
  }, [overview])

  if (loading) {
    return <div className="flex items-center justify-center h-36"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Server className="w-6 h-6 text-blue-400" /> Kubernetes Cluster</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Auto-detects distro (k3s, RKE2, cloud, kind, …), host agents, and expands resource counts. Safe kubectl node actions below.
          </p>
        </div>
        <button onClick={() => void load(true)} className="p-2 hover:bg-slate-700 rounded-lg transition" aria-label="Refresh">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loadError && (
        <div className="sticky top-2 z-30">
          <K8sConnectionErrorBanner
            title="Could not load cluster overview"
            message={loadError}
            onDismiss={() => setLoadError(null)}
          />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {counts.map((c) => (
          <div key={c.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3">
            <div className="text-xs text-slate-400">{c.label}</div>
            <div className="text-2xl font-semibold text-white">{c.value}</div>
          </div>
        ))}
      </div>

      {environment && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white">Detection &amp; host</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={`px-2 py-1 rounded-md border ${environment.kubectl_on_path ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-amber-500/15 border-amber-500/40 text-amber-200'}`}>
              kubectl {environment.kubectl_on_path ? 'available' : 'missing / failing'}
            </span>
            <span className={`px-2 py-1 rounded-md border ${environment.kubectl_server_reachable ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-slate-700 border-slate-600 text-slate-300'}`}>
              API {environment.kubectl_server_reachable ? 'reachable' : 'unreachable'}
            </span>
            <span className="px-2 py-1 rounded-md bg-blue-500/15 border border-blue-500/40 text-blue-200">
              cluster: <span className="font-mono">{environment.cluster_distribution}</span>
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-300">
            <div className="space-y-1">
              <div><span className="text-slate-500">kubectl client:</span> {environment.kubectl_client_version ?? '—'}</div>
              <div><span className="text-slate-500">Current context:</span> {environment.current_context ?? '—'}</div>
              <div><span className="text-slate-500">Kubeconfig:</span> {environment.kubeconfig_hint ?? '—'}{environment.kubeconfig_from_env ? ' (KUBECONFIG)' : ''}</div>
              {environment.kubeconfig_auto_selected && (
                <div className="text-emerald-200/90">
                  <span className="text-slate-500">Machina auto-selected:</span>{' '}
                  <code className="text-xs bg-slate-900/80 px-1 rounded break-all">{environment.kubeconfig_auto_selected}</code>
                  <span className="text-slate-500 text-xs"> (used because default config did not reach the API)</span>
                </div>
              )}
            </div>
            <div className="space-y-1 text-xs">
              <div className="text-slate-400 font-medium">k3s / RKE2 on this host</div>
              <div>k3s config / data: {environment.host.k3s_config_present ? 'yes' : 'no'} / {environment.host.k3s_data_dir_present ? 'yes' : 'no'} · systemd k3s: <span className="font-mono">{environment.host.k3s_systemd}</span> · agent: <span className="font-mono">{environment.host.k3s_agent_systemd}</span></div>
              <div>RKE2 config / data: {environment.host.rke2_config_present ? 'yes' : 'no'} / {environment.host.rke2_data_dir_present ? 'yes' : 'no'} · server: <span className="font-mono">{environment.host.rke2_server_systemd}</span></div>
              <div>k3s binary: {environment.host.k3s_binary_version ?? '—'} · rke2 binary: {environment.host.rke2_binary_version ?? '—'}</div>
              <div>helm: {environment.host.helm_version ?? '—'} · crictl: {environment.host.crictl_version ?? '—'}</div>
            </div>
          </div>
          {(environment.cluster_distribution_hints?.length ?? 0) > 0 && (
            <div>
              <div className="text-xs text-slate-500 mb-1">Detection hints</div>
              <ul className="text-xs text-slate-400 list-disc pl-5 space-y-0.5">
                {environment.cluster_distribution_hints.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}
          {Object.keys(environment.snippets).length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-slate-500">kubectl snippets (truncated)</div>
              <div className="space-y-2 max-h-[28rem] overflow-y-auto">
                {Object.entries(environment.snippets).map(([key, text]) => (
                  <details key={key} className="group border border-slate-700/60 rounded-lg bg-slate-900/40">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-mono text-slate-300 hover:bg-slate-800/60 rounded-lg">{key}</summary>
                    <pre className="px-3 pb-3 text-[11px] text-slate-400 whitespace-pre-wrap break-words max-h-64 overflow-y-auto">{text}</pre>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-300">API server version: <span className="font-medium text-emerald-300">{overview?.version || 'unknown'}</span></span>
        {overview?.distribution && (
          <span className="text-sm text-slate-400">Detected: <span className="font-mono text-slate-200">{overview.distribution}</span></span>
        )}
        <Link to="/k8s/workloads" className="text-sm text-blue-300 hover:text-blue-200 underline underline-offset-4">
          Open workloads view
        </Link>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold">Nodes</h2>
          <p className="text-xs text-slate-500 mt-1">Actions are allowlisted: cordon, uncordon, drain.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 text-slate-400 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Node</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Kubelet</th>
                <th className="text-left px-4 py-3 hidden xl:table-cell">OS</th>
                <th className="text-center px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {nodes.map((n) => (
                <tr key={n.name} className="hover:bg-slate-700/30">
                  <td className="px-4 py-3 font-medium text-white">{n.name}</td>
                  <td className="px-4 py-3 text-slate-300">{n.roles.join(', ')}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 ${n.ready ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {n.ready ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                      {n.ready ? 'Ready' : 'Not ready'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">{n.kubelet_version}</td>
                  <td className="px-4 py-3 text-slate-400 hidden xl:table-cell">{n.os_image}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        className="px-2 py-1 rounded-md text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-50"
                        onClick={() => void runNodeAction(n.name, 'node_cordon')}
                        disabled={acting !== null}
                      >
                        Cordon
                      </button>
                      <button
                        className="px-2 py-1 rounded-md text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50"
                        onClick={() => void runNodeAction(n.name, 'node_uncordon')}
                        disabled={acting !== null}
                      >
                        Uncordon
                      </button>
                      <button
                        className="px-2 py-1 rounded-md text-xs bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50"
                        onClick={() => void runNodeAction(n.name, 'node_drain')}
                        disabled={acting !== null}
                      >
                        Drain
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {nodes.length === 0 && <div className="p-8 text-center text-slate-500">No nodes found</div>}
      </div>

      {lastCommand && (
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Last executed command</div>
          <code className="text-xs text-emerald-300 break-all">{lastCommand}</code>
        </div>
      )}
    </div>
  )
}
