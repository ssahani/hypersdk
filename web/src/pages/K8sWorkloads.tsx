import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  getK8sDeployments,
  getK8sNamespaces,
  getK8sPods,
  getK8sServices,
  K8sDeployment,
  K8sPod,
  K8sService,
  runK8sAction,
} from '../api/k8s'
import { useToastContext } from '../contexts/ToastContext'

export default function K8sWorkloadsPage() {
  const toast = useToastContext()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [namespace, setNamespace] = useState<string>('all')
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [deployments, setDeployments] = useState<K8sDeployment[]>([])
  const [pods, setPods] = useState<K8sPod[]>([])
  const [services, setServices] = useState<K8sService[]>([])
  const [acting, setActing] = useState<string | null>(null)
  const [scaleValue, setScaleValue] = useState<Record<string, number>>({})

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
      setNamespaces(ns.items.map((n) => n.name).filter(Boolean))
      setDeployments(dep.items ?? [])
      setPods(pod.items ?? [])
      setServices(svc.items ?? [])
    } catch (e: unknown) {
      toast.error(`Failed to load workloads: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [nsValue, toast])

  useEffect(() => {
    void load()
  }, [load])

  const runAction = useCallback(async (payload: Parameters<typeof runK8sAction>[0]) => {
    setActing(`${payload.action}:${payload.name}`)
    try {
      const res = await runK8sAction(payload)
      toast.success(res.stdout.trim() || `Action ${payload.action} succeeded`)
      await load(true)
    } catch (e: unknown) {
      toast.error(`Action failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setActing(null)
    }
  }, [load, toast])

  const byNs = useMemo(() => {
    const m: Record<string, { pods: number; deployments: number; services: number }> = {}
    for (const d of deployments) {
      const ns = d.metadata.namespace || 'default'
      if (!m[ns]) m[ns] = { pods: 0, deployments: 0, services: 0 }
      m[ns].deployments += 1
    }
    for (const p of pods) {
      const ns = p.metadata.namespace || 'default'
      if (!m[ns]) m[ns] = { pods: 0, deployments: 0, services: 0 }
      m[ns].pods += 1
    }
    for (const s of services) {
      const ns = s.metadata.namespace || 'default'
      if (!m[ns]) m[ns] = { pods: 0, deployments: 0, services: 0 }
      m[ns].services += 1
    }
    return m
  }, [deployments, pods, services])

  if (loading) {
    return <div className="flex items-center justify-center h-36"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Kubernetes Workloads</h1>
          <p className="text-sm text-slate-400 mt-0.5">Clickable kubectl operations for deployments and pods.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.entries(byNs).slice(0, 9).map(([ns, counts]) => (
          <div key={ns} className="rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-3">
            <div className="text-sm font-medium text-white">{ns}</div>
            <div className="text-xs text-slate-400 mt-1">
              {counts.deployments} deployments, {counts.pods} pods, {counts.services} services
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
                <th className="text-center px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {pods.map((p) => (
                <tr key={`${p.metadata.namespace || 'default'}/${p.metadata.name}`} className="hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-white font-medium">{p.metadata.name}</td>
                  <td className="px-4 py-3 text-slate-300">{p.metadata.namespace || 'default'}</td>
                  <td className="px-4 py-3 text-slate-300">{p.status?.phase || 'unknown'}</td>
                  <td className="px-4 py-3 text-slate-400">{p.status?.podIP || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      className="px-2 py-1 rounded-md text-xs bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50"
                      disabled={acting !== null}
                      onClick={() => void runAction({
                        action: 'delete_pod',
                        name: p.metadata.name,
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
    </div>
  )
}
