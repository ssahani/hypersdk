import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router'
import { listVMs, getMetrics, VmInfo, VmMetrics } from '../api/vm'
import { listNetworks, NetworkInfo } from '../api/network'
import { listPools, StoragePoolInfo } from '../api/storage'
import { getNodeInfo, NodeInfo } from '../api/node'
import { getHostStats, HostStats } from '../api/extras'
import { getStateColor, getStateBadgeClasses } from '../utils/vm'
import { Activity, Cpu, HardDrive, Server, Network, Database, Camera, ArrowRight, MonitorPlay, ChevronRight, Clock, Gauge, Power, RotateCcw } from 'lucide-react'
import { hostShutdown, hostReboot } from '../api/extras'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useWebSocketContext } from '../contexts/WebSocketContext'

interface MetricsPoint { time: string; cpu: number; memory: number }

export default function Dashboard() {
  const [vms, setVMs] = useState<VmInfo[]>([])
  const [networks, setNetworks] = useState<NetworkInfo[]>([])
  const [pools, setPools] = useState<StoragePoolInfo[]>([])
  const [node, setNode] = useState<NodeInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [hostStats, setHostStats] = useState<HostStats | null>(null)
  const [metricsHistory, setMetricsHistory] = useState<MetricsPoint[]>([])
  const { subscribe } = useWebSocketContext()

  const loadData = useCallback(async () => {
    try {
      const [vmData, netData, poolData, nodeData] = await Promise.all([
        listVMs(), listNetworks(), listPools(), getNodeInfo(),
      ])
      setVMs(vmData); setNetworks(netData); setPools(poolData); setNode(nodeData)
      try { setHostStats(await getHostStats()) } catch { /* optional */ }
    } catch (error) { console.error('Failed to load data:', error) } finally { setLoading(false) }
  }, [])

  const loadMetrics = useCallback(async () => {
    try {
      const metrics = await getMetrics()
      const avgMem = metrics.length > 0
        ? metrics.reduce((sum: number, m: VmMetrics) => sum + m.memory_pct, 0) / metrics.length : 0
      setMetricsHistory((prev) => [
        ...prev.slice(-29),
        { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), cpu: 0, memory: parseFloat(avgMem.toFixed(1)) },
      ])
    } catch { /* no metrics */ }
  }, [])

  useEffect(() => {
    loadData(); loadMetrics()
    const interval = setInterval(() => { loadData(); loadMetrics() }, 10000)
    return () => clearInterval(interval)
  }, [loadData, loadMetrics])

  useEffect(() => {
    const unsubscribe = subscribe(() => loadData())
    return () => unsubscribe()
  }, [subscribe, loadData])

  const [showShutdownConfirm, setShowShutdownConfirm] = useState(false)
  const [showRebootConfirm, setShowRebootConfirm] = useState(false)

  const handleHostShutdown = async () => {
    try { await hostShutdown() } catch (e) { console.error('Shutdown failed:', e) }
    setShowShutdownConfirm(false)
  }

  const handleHostReboot = async () => {
    try { await hostReboot() } catch (e) { console.error('Reboot failed:', e) }
    setShowRebootConfirm(false)
  }

  const running = vms.filter((v) => v.state === 'running').length
  const stopped = vms.filter((v) => v.state === 'shutoff').length
  const paused = vms.length - running - stopped
  const totalVcpus = vms.reduce((s, v) => s + v.vcpus, 0)
  const totalMemGB = (vms.reduce((s, v) => s + v.memory_mb, 0) / 1024).toFixed(1)
  const activeNets = networks.filter((n) => n.active).length
  const activePools = pools.filter((p) => p.state === 'running').length

  if (loading) return <DashboardSkeleton />

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {node ? `${node.hostname} — ${node.hypervisor} ${node.hypervisor_version}` : 'Loading host info...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRebootConfirm(true)} className="flex items-center gap-1.5 px-3 py-2 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/30 rounded-lg text-sm font-medium text-yellow-400 transition-all" title="Reboot host">
            <RotateCcw className="w-4 h-4" /> Reboot
          </button>
          <button onClick={() => setShowShutdownConfirm(true)} className="flex items-center gap-1.5 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 rounded-lg text-sm font-medium text-red-400 transition-all" title="Shutdown host">
            <Power className="w-4 h-4" /> Shutdown
          </button>
          <Link to="/create" className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-lg text-sm font-medium shadow-lg shadow-blue-600/20 transition-all">
            <Server className="w-4 h-4" /> New VM
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard gradient="stat-card-blue" icon={<Server className="w-6 h-6" />} iconColor="text-blue-400" title="Virtual Machines" value={vms.length} badge={<span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">{running} running</span>} />
        <StatCard gradient="stat-card-purple" icon={<Cpu className="w-6 h-6" />} iconColor="text-purple-400" title="Total vCPUs" value={totalVcpus} badge={node ? <span className="text-xs text-slate-500">{node.cpu_cores}c / {node.cpu_threads}t host</span> : undefined} />
        <StatCard gradient="stat-card-orange" icon={<HardDrive className="w-6 h-6" />} iconColor="text-orange-400" title="Allocated Memory" value={`${totalMemGB} GB`} badge={node ? <span className="text-xs text-slate-500">{(node.memory_mb / 1024).toFixed(0)} GB host</span> : undefined} />
        <StatCard gradient="stat-card-green" icon={<Network className="w-6 h-6" />} iconColor="text-emerald-400" title="Networks" value={networks.length} badge={<span className="text-xs text-slate-500">{activeNets} active</span>} />
      </div>

      {/* Host Resource Usage */}
      {hostStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <ResourceBar icon={<Gauge className="w-4 h-4 text-blue-400" />} label="Host CPU" value={hostStats.cpu_percent} extra={`Load: ${hostStats.load_1.toFixed(1)}`} />
          <ResourceBar icon={<HardDrive className="w-4 h-4 text-emerald-400" />} label="Host Memory" value={hostStats.memory_percent} extra={`${(hostStats.memory_used_mb / 1024).toFixed(1)} / ${(hostStats.memory_total_mb / 1024).toFixed(1)} GB`} />
          <ResourceBar icon={<Database className="w-4 h-4 text-orange-400" />} label="Host Disk" value={hostStats.disk_percent} extra={`${hostStats.disk_used_gb.toFixed(0)} / ${hostStats.disk_total_gb.toFixed(0)} GB`} />
          <MiniStat icon={<Clock className="w-4 h-4 text-purple-400" />} label="Uptime" value={formatUptime(hostStats.uptime_secs)} extra={`${hostStats.processes} procs`} />
        </div>
      )}

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat icon={<Database className="w-4 h-4 text-cyan-400" />} label="Storage Pools" value={`${activePools}/${pools.length}`} />
        <MiniStat icon={<Camera className="w-4 h-4 text-yellow-400" />} label="Running" value={running} extra={stopped > 0 ? `${stopped} stopped` : undefined} />
        <MiniStat icon={<MonitorPlay className="w-4 h-4 text-pink-400" />} label="Paused" value={paused} />
        <MiniStat icon={<Activity className="w-4 h-4 text-green-400" />} label="Libvirt" value={node ? `v${node.lib_version}` : '-'} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="CPU Usage" icon={<Cpu className="w-4 h-4 text-blue-400" />} current={metricsHistory.length > 0 ? `${metricsHistory[metricsHistory.length - 1].cpu}%` : '-'}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={metricsHistory}>
              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#475569" fontSize={11} tickLine={false} />
              <YAxis stroke="#475569" fontSize={11} domain={[0, 100]} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '0.75rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} labelStyle={{ color: '#94a3b8' }} />
              <Area type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#cpuGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Memory Usage" icon={<HardDrive className="w-4 h-4 text-emerald-400" />} current={metricsHistory.length > 0 ? `${metricsHistory[metricsHistory.length - 1].memory}%` : '-'}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={metricsHistory}>
              <defs>
                <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#475569" fontSize={11} tickLine={false} />
              <YAxis stroke="#475569" fontSize={11} domain={[0, 100]} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '0.75rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} labelStyle={{ color: '#94a3b8' }} />
              <Area type="monotone" dataKey="memory" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#memGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Shutdown Confirmation */}
      {showShutdownConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in" onClick={() => setShowShutdownConfirm(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-2">Confirm Host Shutdown</h3>
            <p className="text-sm text-slate-400 mb-6">Are you sure you want to shut down this host? All running VMs will be stopped and the system will power off.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowShutdownConfirm(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">Cancel</button>
              <button onClick={handleHostShutdown} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition">Shut Down</button>
            </div>
          </div>
        </div>
      )}

      {/* Reboot Confirmation */}
      {showRebootConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in" onClick={() => setShowRebootConfirm(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-2">Confirm Host Reboot</h3>
            <p className="text-sm text-slate-400 mb-6">Are you sure you want to reboot this host? All running VMs will be stopped and the system will restart.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowRebootConfirm(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">Cancel</button>
              <button onClick={handleHostReboot} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-sm font-medium transition">Reboot</button>
            </div>
          </div>
        </div>
      )}

      {/* VM List */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Virtual Machines</h2>
          <Link to="/vms" className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition font-medium">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="divide-y divide-slate-700/30">
          {vms.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Server className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No virtual machines</p>
              <p className="text-sm text-slate-500 mt-1">Create your first VM to get started</p>
              <Link to="/create" className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">
                <Server className="w-4 h-4" /> Create VM
              </Link>
            </div>
          ) : (
            vms.slice(0, 10).map((vm) => (
              <Link to={`/vms/${vm.name}`} key={vm.name} className="flex items-center justify-between px-6 py-3.5 table-row-hover group">
                <div className="flex items-center gap-4">
                  <div className={`w-2.5 h-2.5 rounded-full ${getStateColor(vm.state)} ${vm.state === 'running' ? 'animate-pulse-dot' : ''}`} />
                  <div>
                    <div className="font-medium text-white group-hover:text-blue-400 transition">{vm.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{vm.vcpus} vCPU · {vm.memory_mb} MB</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${getStateBadgeClasses(vm.state)}`}>{vm.state}</span>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition" />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ gradient, icon, iconColor, title, value, badge }: { gradient: string; icon: React.ReactNode; iconColor: string; title: string; value: string | number; badge?: React.ReactNode }) {
  return (
    <div className={`${gradient} rounded-xl p-5 border border-slate-700/30 shadow-lg hover:border-slate-600/50 transition-all duration-300`}>
      <div className="flex items-start justify-between">
        <div className={iconColor}>{icon}</div>
        {badge}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-sm text-slate-400 mt-0.5">{title}</div>
      </div>
    </div>
  )
}

function ResourceBar({ icon, label, value, extra }: { icon: React.ReactNode; label: string; value: number; extra?: string }) {
  const color = value > 90 ? 'bg-red-500' : value > 70 ? 'bg-yellow-500' : 'bg-blue-500'
  return (
    <div className="bg-slate-800/40 rounded-xl px-4 py-3 border border-slate-700/30">
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-xs text-slate-500 flex-1">{label}</span>
        <span className="text-xs font-semibold text-white">{value.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      {extra && <div className="text-[10px] text-slate-500 mt-1">{extra}</div>}
    </div>
  )
}

function formatUptime(secs: number): string {
  const days = Math.floor(secs / 86400)
  const hours = Math.floor((secs % 86400) / 3600)
  if (days > 0) return `${days}d ${hours}h`
  const mins = Math.floor((secs % 3600) / 60)
  return `${hours}h ${mins}m`
}

function MiniStat({ icon, label, value, extra }: { icon: React.ReactNode; label: string; value: string | number; extra?: string }) {
  return (
    <div className="bg-slate-800/40 rounded-xl px-4 py-3 border border-slate-700/30 flex items-center gap-3">
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-sm font-semibold text-white">{value}</div>
      </div>
      {extra && <span className="text-[10px] text-slate-500">{extra}</span>}
    </div>
  )
}

function ChartCard({ title, icon, current, children }: { title: string; icon: React.ReactNode; current: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">{icon} {title}</h3>
        <span className="text-xs text-slate-400 font-mono">{current}</span>
      </div>
      {children}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 skeleton" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 skeleton" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => <div key={i} className="h-72 skeleton" />)}
      </div>
      <div className="h-64 skeleton" />
    </div>
  )
}
