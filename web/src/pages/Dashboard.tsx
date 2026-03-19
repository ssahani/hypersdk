import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router'
import { listVMs, getMetrics, VmInfo, VmMetrics } from '../api/vm'
import { listNetworks, NetworkInfo } from '../api/network'
import { listPools, StoragePoolInfo } from '../api/storage'
import { getNodeInfo, NodeInfo } from '../api/node'
import { getStateColor } from '../utils/vm'
import { Activity, Cpu, HardDrive, Server, Network, Database, Camera } from 'lucide-react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useWebSocketContext } from '../contexts/WebSocketContext'

interface MetricsPoint {
  time: string
  cpu: number
  memory: number
}

export default function Dashboard() {
  const [vms, setVMs] = useState<VmInfo[]>([])
  const [networks, setNetworks] = useState<NetworkInfo[]>([])
  const [pools, setPools] = useState<StoragePoolInfo[]>([])
  const [node, setNode] = useState<NodeInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [metricsHistory, setMetricsHistory] = useState<MetricsPoint[]>([])
  const { subscribe } = useWebSocketContext()

  const loadData = useCallback(async () => {
    try {
      const [vmData, netData, poolData, nodeData] = await Promise.all([
        listVMs(), listNetworks(), listPools(), getNodeInfo(),
      ])
      setVMs(vmData)
      setNetworks(netData)
      setPools(poolData)
      setNode(nodeData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMetrics = useCallback(async () => {
    try {
      const metrics = await getMetrics()
      const avgMem = metrics.length > 0
        ? metrics.reduce((sum: number, m: VmMetrics) => sum + m.memory_pct, 0) / metrics.length
        : 0
      setMetricsHistory((prev) => [
        ...prev.slice(-19),
        { time: new Date().toLocaleTimeString(), cpu: 0, memory: parseFloat(avgMem.toFixed(1)) },
      ])
    } catch { /* metrics not available */ }
  }, [])

  useEffect(() => {
    loadData()
    loadMetrics()
    const interval = setInterval(() => { loadData(); loadMetrics() }, 10000)
    return () => clearInterval(interval)
  }, [loadData, loadMetrics])

  useEffect(() => {
    return subscribe(() => loadData())
  }, [subscribe, loadData])

  const running = vms.filter((v) => v.state === 'running').length
  const stopped = vms.length - running
  const totalVcpus = vms.reduce((s, v) => s + v.vcpus, 0)
  const totalMemGB = (vms.reduce((s, v) => s + v.memory_mb, 0) / 1024).toFixed(1)
  const activeNets = networks.filter((n) => n.active).length
  const activePools = pools.filter((p) => p.state === 'running').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Server className="w-8 h-8" />} title="Virtual Machines" value={`${running} / ${vms.length}`} subtitle={`${running} running, ${stopped} stopped`} color="blue" />
        <StatCard icon={<Cpu className="w-8 h-8" />} title="Total vCPUs" value={totalVcpus} subtitle={node ? `Host: ${node.cpu_model}` : ''} color="purple" />
        <StatCard icon={<HardDrive className="w-8 h-8" />} title="Total Memory" value={`${totalMemGB} GB`} subtitle={node ? `Host: ${(node.memory_mb / 1024).toFixed(0)} GB` : ''} color="orange" />
        <StatCard icon={<Network className="w-8 h-8" />} title="Networks" value={`${activeNets} / ${networks.length}`} subtitle={`${activeNets} active`} color="green" />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <Database className="w-5 h-5 text-cyan-500" />
            <span className="text-gray-400 text-sm">Storage Pools</span>
          </div>
          <div className="text-2xl font-bold">{activePools} / {pools.length}</div>
          <div className="text-xs text-gray-500 mt-1">{activePools} active</div>
        </div>
        {node && (
          <>
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <Activity className="w-5 h-5 text-green-500" />
                <span className="text-gray-400 text-sm">Hypervisor</span>
              </div>
              <div className="text-2xl font-bold">{node.hypervisor}</div>
              <div className="text-xs text-gray-500 mt-1">v{node.hypervisor_version} &middot; libvirt v{node.lib_version}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <Camera className="w-5 h-5 text-yellow-500" />
                <span className="text-gray-400 text-sm">Host</span>
              </div>
              <div className="text-2xl font-bold">{node.hostname}</div>
              <div className="text-xs text-gray-500 mt-1">{node.cpu_cores} cores &middot; {node.cpu_threads} threads &middot; {node.cpu_sockets} sockets</div>
            </div>
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Cpu className="w-5 h-5 text-blue-500" />
            CPU Usage Trend
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={metricsHistory}>
              <defs>
                <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }} />
              <Area type="monotone" dataKey="cpu" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCpu)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <HardDrive className="w-5 h-5 text-green-500" />
            Memory Usage Trend
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={metricsHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }} />
              <Line type="monotone" dataKey="memory" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* VM List */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Virtual Machines</h2>
          <Link to="/vms" className="text-sm text-blue-400 hover:text-blue-300">View all →</Link>
        </div>
        <div className="divide-y divide-gray-700">
          {vms.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No VMs found. <Link to="/create" className="text-blue-400 hover:underline">Create one</Link>.</div>
          ) : (
            vms.slice(0, 8).map((vm) => (
              <Link to={`/vms/${vm.name}`} key={vm.name} className="block p-4 hover:bg-gray-700 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${getStateColor(vm.state)}`} />
                    <div>
                      <div className="font-medium">{vm.name}</div>
                      <div className="text-sm text-gray-400">{vm.vcpus} vCPUs &middot; {vm.memory_mb} MB</div>
                    </div>
                  </div>
                  <span className="text-sm text-gray-400 capitalize">{vm.state}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, title, value, subtitle, color }: { icon: React.ReactNode; title: string; value: string | number; subtitle?: string; color: string }) {
  const colors: Record<string, string> = { blue: 'text-blue-500', green: 'text-green-500', purple: 'text-purple-500', orange: 'text-orange-500' }
  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className={colors[color]}>{icon}</div>
      <div className="mt-4">
        <div className="text-3xl font-bold">{value}</div>
        <div className="text-gray-400 text-sm mt-1">{title}</div>
        {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
      </div>
    </div>
  )
}
