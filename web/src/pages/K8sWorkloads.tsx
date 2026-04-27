import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, ExternalLink, Monitor, Network, RefreshCw, Terminal } from 'lucide-react'
import VNCViewer from '../components/VNCViewer'
import KubeVirtSerialConsole from '../components/KubeVirtSerialConsole'
import KubeVirtExposeServiceModal from '../components/KubeVirtExposeServiceModal'
import K8sConnectionErrorBanner from '../components/K8sConnectionErrorBanner'
import {
  getK8sDeployments,
  getK8sKubevirtVmSummary,
  getK8sNamespaces,
  getK8sPods,
  getK8sServices,
  K8sDeployment,
  KubeVirtVmSummaryRow,
  K8sPod,
  K8sService,
  runK8sAction,
} from '../api/k8s'
import { useToastContext } from '../contexts/ToastContext'
import { summarizeK8sClientError } from '../utils/k8sErrors'

export default function K8sWorkloadsPage() {
  const toast = useToastContext()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [namespace, setNamespace] = useState<string>('all')
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [deployments, setDeployments] = useState<K8sDeployment[]>([])
  const [pods, setPods] = useState<K8sPod[]>([])
  const [services, setServices] = useState<K8sService[]>([])
  const [kubevirtRows, setKubevirtRows] = useState<KubeVirtVmSummaryRow[]>([])
  const [kubevirtListError, setKubevirtListError] = useState<string | null>(null)
  const [liveKubeVirt, setLiveKubeVirt] = useState<null | { kind: 'vnc' | 'console'; namespace: string; name: string }>(null)
  const [exposeVm, setExposeVm] = useState<null | { name: string; namespace: string; nodeInternalIp?: string | null }>(null)
  const [acting, setActing] = useState<string | null>(null)
  const [scaleValue, setScaleValue] = useState<Record<string, number>>({})
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const nsValue = namespace === 'all' ? undefined : namespace

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true)
    try {
      const [ns, dep, pod, svc] = await Promise.all([
        getK8sNamespaces(),
        getK8sDeployments(nsValue),
        getK8sPods(nsValue),
        getK8sServices(nsValue),
      ])
      setConnectionError(null)
      setNamespaces(
        (ns.items ?? [])
          .map((n) => n.metadata?.name)
          .filter((x): x is string => Boolean(x)),
      )
      setDeployments(dep.items ?? [])
      setPods(pod.items ?? [])
      setServices(svc.items ?? [])
      setKubevirtListError(null)
      try {
        const rows = await getK8sKubevirtVmSummary(nsValue)
        setKubevirtRows(Array.isArray(rows) ? rows : [])
      } catch (e: unknown) {
        setKubevirtRows([])
        setKubevirtListError(e instanceof Error ? e.message : String(e))
      }
    } catch (e: unknown) {
      setConnectionError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [nsValue])

  useEffect(() => {
    void load()
  }, [load])

  const copyText = useCallback((label: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copied`)
    }).catch(() => {
      toast.error('Could not copy to clipboard')
    })
  }, [toast])

  const runAction = useCallback(async (payload: Parameters<typeof runK8sAction>[0]) => {
    setActing(`${payload.action}:${payload.name}`)
    try {
      const res = await runK8sAction(payload)
      toast.success(res.stdout.trim() || `Action ${payload.action} succeeded`)
      await load(true)
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e)
      toast.error(`Action failed: ${summarizeK8sClientError(raw).headline}`)
    } finally {
      setActing(null)
    }
  }, [load, toast])

  const byNs = useMemo(() => {
    const m: Record<string, { pods: number; deployments: number; services: number; kubevirtVms: number }> = {}
    const touch = (ns: string) => {
      if (!m[ns]) m[ns] = { pods: 0, deployments: 0, services: 0, kubevirtVms: 0 }
    }
    for (const d of deployments) {
      const ns = d.metadata.namespace || 'default'
      touch(ns)
      m[ns].deployments += 1
    }
    for (const p of pods) {
      const ns = p.metadata.namespace || 'default'
      touch(ns)
      m[ns].pods += 1
    }
    for (const s of services) {
      const ns = s.metadata?.namespace || 'default'
      touch(ns)
      m[ns].services += 1
    }
    for (const v of kubevirtRows) {
      const ns = v.namespace || 'default'
      touch(ns)
      m[ns].kubevirtVms += 1
    }
    return m
  }, [deployments, pods, services, kubevirtRows])

  if (loading) {
    return <div className="flex items-center justify-center h-36"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>
  }

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Kubernetes Workloads</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Pods show node name and host IP. KubeVirt VMs merge VMI guest / pod IP and node InternalIP; use <strong className="text-slate-400">Console</strong> / <strong className="text-slate-400">VNC</strong> to copy <code className="text-xs bg-slate-900/80 px-1 rounded">virtctl</code> commands (run where kubeconfig reaches the cluster).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All namespaces</option>
            {namespaces.map((ns) => (
              <option key={ns} value={ns}>{ns}</option>
            ))}
          </select>
          <button onClick={() => void load(true)} className="p-2 hover:bg-slate-700 rounded-lg transition" aria-label="Refresh">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {connectionError && (
        <div className="sticky top-2 z-30">
          <K8sConnectionErrorBanner
            title="Could not load workloads from the API"
            message={connectionError}
            onDismiss={() => setConnectionError(null)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.entries(byNs).slice(0, 9).map(([ns, counts]) => (
          <div key={ns} className="rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-3">
            <div className="text-sm font-medium text-white">{ns}</div>
            <div className="text-xs text-slate-400 mt-1">
              {counts.deployments} deployments, {counts.pods} pods, {counts.services} services
              {counts.kubevirtVms > 0 ? `, ${counts.kubevirtVms} KubeVirt VMs` : ''}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold">Deployments</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 text-slate-400 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Namespace</th>
                <th className="text-left px-4 py-3">Ready</th>
                <th className="text-left px-4 py-3">Replicas</th>
                <th className="text-center px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {deployments.map((d) => {
                const key = `${d.metadata.namespace || 'default'}/${d.metadata.name}`
                const replicaCurrent = d.spec?.replicas ?? 1
                const scale = scaleValue[key] ?? replicaCurrent
                return (
                  <tr key={key} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-white font-medium">{d.metadata.name}</td>
                    <td className="px-4 py-3 text-slate-300">{d.metadata.namespace || 'default'}</td>
                    <td className="px-4 py-3 text-slate-300">{d.status?.readyReplicas ?? 0}/{d.status?.replicas ?? replicaCurrent}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        value={scale}
                        onChange={(e) => setScaleValue((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                        className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className="px-2 py-1 rounded-md text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-50"
                          disabled={acting !== null}
                          onClick={() => void runAction({
                            action: 'rollout_restart_deployment',
                            name: d.metadata.name,
                            namespace: d.metadata.namespace || 'default',
                          })}
                        >
                          Restart
                        </button>
                        <button
                          className="px-2 py-1 rounded-md text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 disabled:opacity-50"
                          disabled={acting !== null}
                          onClick={() => void runAction({
                            action: 'scale_deployment',
                            name: d.metadata.name,
                            namespace: d.metadata.namespace || 'default',
                            replicas: Math.max(0, Number.isFinite(scale) ? scale : replicaCurrent),
                          })}
                        >
                          Scale
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 space-y-1">
          <h2 className="text-lg font-semibold">KubeVirt VirtualMachines</h2>
          <p className="text-xs text-slate-500">
            Merged with <code className="bg-slate-900/80 px-1 rounded">VirtualMachineInstance</code> for guest IP, launcher <code className="text-xs bg-slate-900/80 px-1 rounded">podIP</code>, and node <code className="text-xs bg-slate-900/80 px-1 rounded">InternalIP</code>.
            <strong className="text-slate-400">Expose / SSH</strong> opens a planner for Service type, ports, <code className="text-xs bg-slate-900/80 px-1 rounded">virtctl expose vm …</code>, and copyable SSH once a matching Service exists.
            In-browser VNC uses machina&apos;s WebSocket proxy or run <code className="text-xs bg-slate-900/80 px-1 rounded">virtctl vnc</code> locally.
            Libvirt VMs stay under <strong className="text-slate-400">VMs</strong>.
          </p>
          {kubevirtListError && (
            <div className="mt-2">
              <K8sConnectionErrorBanner
                title="Could not load KubeVirt VM summary"
                message={kubevirtListError}
              />
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[72rem]">
            <thead>
              <tr className="border-b border-slate-700/50 text-slate-400 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Namespace</th>
                <th className="text-left px-4 py-3">Run / ready</th>
                <th className="text-left px-4 py-3">VM status</th>
                <th className="text-left px-4 py-3">VMI</th>
                <th className="text-left px-4 py-3">Guest IP</th>
                <th className="text-left px-4 py-3">Pod IP</th>
                <th className="text-left px-4 py-3">Node</th>
                <th className="text-left px-4 py-3">Node IP</th>
                <th className="text-center px-4 py-3">Console / VNC / live</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {kubevirtRows.map((v) => {
                const key = `${v.namespace}/${v.name}`
                const rr = `${v.spec_running === true ? 'on' : v.spec_running === false ? 'off' : '—'} / ${v.vm_ready === true ? 'yes' : v.vm_ready === false ? 'no' : '—'}`
                return (
                  <tr key={key} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-white font-medium">{v.name}</td>
                    <td className="px-4 py-3 text-slate-300">{v.namespace}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{rr}</td>
                    <td className="px-4 py-3 text-slate-300">{v.vm_printable_status ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{v.vmi_phase ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{v.guest_ip ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{v.pod_ip ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{v.node_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{v.node_internal_ip ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        <button
                          type="button"
                          title={v.virtctl_console}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-slate-700/80 text-slate-200 border border-slate-600 hover:bg-slate-600"
                          onClick={() => copyText('virtctl console', v.virtctl_console)}
                        >
                          <Terminal className="w-3.5 h-3.5" /> Console
                        </button>
                        <button
                          type="button"
                          title={v.virtctl_vnc}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-violet-500/15 text-violet-200 border border-violet-500/35 hover:bg-violet-500/25"
                          onClick={() => copyText('virtctl vnc', v.virtctl_vnc)}
                        >
                          <Monitor className="w-3.5 h-3.5" /> VNC
                        </button>
                        <button
                          type="button"
                          title={v.virtctl_vnc_socks}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-slate-700/80 text-slate-200 border border-slate-600 hover:bg-slate-600"
                          onClick={() => copyText('virtctl vnc --proxy-only', v.virtctl_vnc_socks)}
                        >
                          <Copy className="w-3.5 h-3.5" /> SOCKS
                        </button>
                        <button
                          type="button"
                          title={v.vnc_subresource_path}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-slate-700/80 text-slate-200 border border-slate-600 hover:bg-slate-600"
                          onClick={() => copyText('VNC API path', v.vnc_subresource_path)}
                        >
                          <Copy className="w-3.5 h-3.5" /> API path
                        </button>
                        <button
                          type="button"
                          title="Open noVNC in this browser (machina proxies to the cluster)"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 hover:bg-emerald-500/30"
                          onClick={() => setLiveKubeVirt({ kind: 'vnc', namespace: v.namespace, name: v.name })}
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Live VNC
                        </button>
                        <button
                          type="button"
                          title="Serial console in this browser"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-sky-500/20 text-sky-200 border border-sky-500/40 hover:bg-sky-500/30"
                          onClick={() => setLiveKubeVirt({ kind: 'console', namespace: v.namespace, name: v.name })}
                        >
                          <Terminal className="w-3.5 h-3.5" /> Live console
                        </button>
                        <button
                          type="button"
                          title="Plan Service / NodePort SSH and copy virtctl expose"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-teal-500/20 text-teal-100 border border-teal-500/35 hover:bg-teal-500/30"
                          onClick={() =>
                            setExposeVm({
                              name: v.name,
                              namespace: v.namespace,
                              nodeInternalIp: v.node_internal_ip,
                            })}
                        >
                          <Network className="w-3.5 h-3.5" /> Expose / SSH
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {kubevirtRows.length === 0 && !kubevirtListError && (
          <div className="p-6 text-center text-slate-500 text-sm">No KubeVirt VirtualMachines in scope (or CRD not installed).</div>
        )}
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold">Pods</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 text-slate-400 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Namespace</th>
                <th className="text-left px-4 py-3">Phase</th>
                <th className="text-left px-4 py-3">Pod IP</th>
                <th className="text-left px-4 py-3">Node</th>
                <th className="text-left px-4 py-3">Node IP</th>
                <th className="text-center px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {pods.map((p) => (
                <tr key={`${p.metadata.namespace || 'default'}/${p.metadata?.name ?? ''}`} className="hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-white font-medium">{p.metadata?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{p.metadata.namespace || 'default'}</td>
                  <td className="px-4 py-3 text-slate-300">{p.status?.phase || 'unknown'}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{p.status?.podIP || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{p.spec?.nodeName ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{p.status?.hostIP ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      className="px-2 py-1 rounded-md text-xs bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50"
                      disabled={acting !== null}
                      onClick={() => void runAction({
                        action: 'delete_pod',
                        name: p.metadata?.name ?? '',
                        namespace: p.metadata.namespace || 'default',
                      })}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {exposeVm && (
        <KubeVirtExposeServiceModal
          vm={exposeVm}
          services={services}
          onClose={() => setExposeVm(null)}
          onCopy={copyText}
        />
      )}

      {liveKubeVirt && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950/95 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-900 shrink-0">
            <span className="text-sm text-slate-200">
              KubeVirt {liveKubeVirt.kind === 'vnc' ? 'VNC' : 'serial console'} — {liveKubeVirt.namespace}/{liveKubeVirt.name}
            </span>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg text-sm bg-slate-700 hover:bg-slate-600 text-slate-100"
              onClick={() => setLiveKubeVirt(null)}
            >
              Close
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden p-2">
            {liveKubeVirt.kind === 'vnc' ? (
              <VNCViewer vmName={liveKubeVirt.name} kubeVirtNamespace={liveKubeVirt.namespace} port={1} />
            ) : (
              <KubeVirtSerialConsole namespace={liveKubeVirt.namespace} vmName={liveKubeVirt.name} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
