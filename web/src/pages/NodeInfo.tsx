import { useEffect, useState } from 'react'
import { getNodeInfo, getHealth, NodeInfo, HealthStatus } from '../api/node'
import { Cpu, HardDrive, Server, Activity, CheckCircle, XCircle } from 'lucide-react'

export default function NodeInfoPage() {
  const [node, setNode] = useState<NodeInfo | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getNodeInfo(), getHealth()])
      .then(([n, h]) => { setNode(n); setHealth(h) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>
  if (!node) return <div className="text-center text-gray-500 py-12">Failed to load host info</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Host Information</h1>

      {health && (
        <div className={`flex items-center gap-3 p-4 rounded-lg border ${health.libvirt ? 'bg-green-900/20 border-green-700' : 'bg-red-900/20 border-red-700'}`}>
          {health.libvirt ? <CheckCircle className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
          <span className="text-sm">Libvirt connection: <strong>{health.status}</strong></span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Server className="w-5 h-5 text-blue-500" /> System</h3>
          <InfoRow label="Hostname" value={node.hostname} />
          <InfoRow label="Hypervisor" value={node.hypervisor} />
          <InfoRow label="Hypervisor Version" value={node.hypervisor_version} />
          <InfoRow label="Libvirt Version" value={node.lib_version} />
          <InfoRow label="Active VMs" value={node.active_vms} />
          <InfoRow label="Defined VMs" value={node.defined_vms} />
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Cpu className="w-5 h-5 text-purple-500" /> CPU</h3>
          <InfoRow label="Model" value={node.cpu_model} />
          <InfoRow label="Cores" value={node.cpu_cores} />
          <InfoRow label="Threads" value={node.cpu_threads} />
          <InfoRow label="Sockets" value={node.cpu_sockets} />
          <InfoRow label="NUMA Nodes" value={node.numa_nodes} />
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2"><HardDrive className="w-5 h-5 text-green-500" /> Memory</h3>
          <InfoRow label="Total" value={`${(node.memory_mb / 1024).toFixed(1)} GB (${node.memory_mb} MB)`} />
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Activity className="w-5 h-5 text-orange-500" /> Summary</h3>
          <InfoRow label="Total vCPUs available" value={node.cpu_cores * node.cpu_threads * node.cpu_sockets} />
          <InfoRow label="VMs (active/defined)" value={`${node.active_vms} / ${node.defined_vms}`} />
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-700/50">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}
