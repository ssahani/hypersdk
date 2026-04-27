import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CheckCircle2, RefreshCw, ShieldAlert, Server } from 'lucide-react'
import { getK8sNodes, getK8sOverview, K8sNodeInfo, runK8sAction } from '../api/k8s'
import { useToastContext } from '../contexts/ToastContext'

type NodeAction = 'node_cordon' | 'node_uncordon' | 'node_drain'

export default function K8sOverviewPage() {
  const toast = useToastContext()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getK8sOverview>> | null>(null)
  const [nodes, setNodes] = useState<K8sNodeInfo[]>([])
  const [acting, setActing] = useState<string | null>(null)
  const [lastCommand, setLastCommand] = useState('')

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true)
    try {
      const [ov, n] = await Promise.all([getK8sOverview(), getK8sNodes()])
      setOverview(ov)
      setNodes(n)
    } catch (e: unknown) {
      toast.error(`Failed to load Kubernetes data: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [toast])

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
      toast.error(`Action failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setActing(null)
    }
  }, [load, toast])

  const counts = useMemo(() => {
    return [
      { label: 'Nodes', value: overview?.nodes ?? 0 },
      { label: 'Ready nodes', value: overview?.ready_nodes ?? 0 },
      { label: 'Namespaces', value: overview?.namespaces ?? 0 },
      { label: 'Pods', value: overview?.pods ?? 0 },
      { label: 'Deployments', value: overview?.deployments ?? 0 },
      { label: 'Services', value: overview?.services ?? 0 },
    ]
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
            Control-plane and worker node visibility with one-click safe kubectl actions.
          </p>
        </div>
        <button onClick={() => void load(true)} className="p-2 hover:bg-slate-700 rounded-lg transition" aria-label="Refresh">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {counts.map((c) => (
          <div key={c.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3">
            <div className="text-xs text-slate-400">{c.label}</div>
            <div className="text-2xl font-semibold text-white">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-300">API server version: <span className="font-medium text-emerald-300">{overview?.version || 'unknown'}</span></span>
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
