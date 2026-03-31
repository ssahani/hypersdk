import { useEffect, useState, useCallback } from 'react'
import { getNodeInfo, getHealth, NodeInfo, HealthStatus } from '../api/node'
import { getHostStats, HostStats, getSystemInfo, setHostname, setTimezone, SystemInfo } from '../api/extras'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Cpu, HardDrive, Server, Activity, CheckCircle, XCircle, Clock, Gauge, RefreshCw, MemoryStick, Database, Monitor, Pencil, Check, X } from 'lucide-react'

interface StatsPoint { time: string; cpu: number; mem: number; disk: number; load: number }

export default function NodeInfoPage() {
  const [node, setNode] = useState<NodeInfo | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [stats, setStats] = useState<HostStats | null>(null)
  const [history, setHistory] = useState<StatsPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null)
  const [editingHostname, setEditingHostname] = useState(false)
  const [editingTimezone, setEditingTimezone] = useState(false)
  const [hostnameInput, setHostnameInput] = useState('')
  const [timezoneInput, setTimezoneInput] = useState('')

  const load = useCallback(() => {
    Promise.allSettled([getNodeInfo(), getHealth(), getHostStats(), getSystemInfo()])
      .then(([n, h, s, si]) => {
        if (n.status === 'fulfilled') setNode(n.value)
        if (h.status === 'fulfilled') setHealth(h.value)
        if (si.status === 'fulfilled') setSysInfo(si.value)
        if (s.status === 'fulfilled') {
          setStats(s.value)
          const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          setHistory(prev => [...prev.slice(-59), {
            time, cpu: parseFloat(s.value.cpu_percent.toFixed(1)),
            mem: parseFloat(s.value.memory_percent.toFixed(1)),
            disk: parseFloat(s.value.disk_percent.toFixed(1)),
            load: s.value.load_1,
          }])
        }
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>
  if (!node) return <div className="text-center text-gray-500 py-12">Failed to load host info</div>

  const formatUptime = (secs: number) => {
    const d = Math.floor(secs / 86400)
    const h = Math.floor((secs % 86400) / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Server className="w-6 h-6 text-blue-400" /> Host Information</h1>
          <p className="text-sm text-slate-400 mt-0.5">{node.hostname}</p>
        </div>
        <button onClick={load} className="p-2 hover:bg-slate-700 rounded-lg transition" aria-label="Refresh"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {/* Health Status */}
      {health && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${health.libvirt ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          {health.libvirt ? <CheckCircle className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
          <span className="text-sm">Libvirt: <strong className={health.libvirt ? 'text-green-400' : 'text-red-400'}>{health.status}</strong></span>
          <span className="text-xs text-slate-500 ml-auto">{node.hypervisor} {node.hypervisor_version} / libvirt {node.lib_version}</span>
        </div>
      )}

      {/* System Info */}
      {sysInfo && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Monitor className="w-5 h-5 text-cyan-400" /> System Configuration</h3>
          <InfoRow label="OS" value={sysInfo.os_pretty_name || `${sysInfo.os_name} ${sysInfo.os_version}`} />
          <InfoRow label="Kernel" value={sysInfo.kernel_version} />

          {/* Editable Hostname */}
          <div className="flex items-center justify-between py-2 border-b border-slate-700/30">
            <span className="text-slate-400 text-sm">Hostname</span>
            {editingHostname ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={hostnameInput}
                  onChange={e => setHostnameInput(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                <button onClick={async () => {
                  try { await setHostname(hostnameInput); load() } catch (e) { console.error(e) }
                  setEditingHostname(false)
                }} className="p-1 hover:bg-green-500/20 rounded text-green-400"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditingHostname(false)} className="p-1 hover:bg-red-500/20 rounded text-red-400"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{sysInfo.hostname}</span>
                <button onClick={() => { setHostnameInput(sysInfo.hostname); setEditingHostname(true) }} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition"><Pencil className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>

          {/* Editable Timezone */}
          <div className="flex items-center justify-between py-2 border-b border-slate-700/30">
            <span className="text-slate-400 text-sm">Timezone</span>
            {editingTimezone ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={timezoneInput}
                  onChange={e => setTimezoneInput(e.target.value)}
                  placeholder="e.g. America/New_York"
                  className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                <button onClick={async () => {
                  try { await setTimezone(timezoneInput); load() } catch (e) { console.error(e) }
                  setEditingTimezone(false)
                }} className="p-1 hover:bg-green-500/20 rounded text-green-400"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditingTimezone(false)} className="p-1 hover:bg-red-500/20 rounded text-red-400"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{sysInfo.timezone}</span>
                <button onClick={() => { setTimezoneInput(sysInfo.timezone); setEditingTimezone(true) }} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition"><Pencil className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resource Gauges */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <ResourceGauge icon={<Gauge className="w-5 h-5 text-blue-400" />} label="CPU" value={stats.cpu_percent} subtitle={`Load: ${stats.load_1.toFixed(2)} / ${stats.load_5.toFixed(2)} / ${stats.load_15.toFixed(2)}`} />
          <ResourceGauge icon={<MemoryStick className="w-5 h-5 text-emerald-400" />} label="Memory" value={stats.memory_percent} subtitle={`${(stats.memory_used_mb / 1024).toFixed(1)} / ${(stats.memory_total_mb / 1024).toFixed(1)} GB`} />
          <ResourceGauge icon={<Database className="w-5 h-5 text-orange-400" />} label="Disk" value={stats.disk_percent} subtitle={`${stats.disk_used_gb.toFixed(0)} / ${stats.disk_total_gb.toFixed(0)} GB`} />
          <ResourceGauge icon={<HardDrive className="w-5 h-5 text-purple-400" />} label="Swap" value={stats.swap_total_mb > 0 ? (stats.swap_used_mb / stats.swap_total_mb * 100) : 0} subtitle={`${(stats.swap_used_mb / 1024).toFixed(1)} / ${(stats.swap_total_mb / 1024).toFixed(1)} GB`} />
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-cyan-400" /><span className="text-xs text-slate-500">Uptime</span></div>
            <div className="text-lg font-bold">{formatUptime(stats.uptime_secs)}</div>
            <div className="text-xs text-slate-500">{stats.processes} processes</div>
          </div>
        </div>
      )}

      {/* Metrics History Charts */}
      {history.length > 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="CPU Usage History" color="#3b82f6" dataKey="cpu" data={history} unit="%" />
          <ChartCard title="Memory Usage History" color="#10b981" dataKey="mem" data={history} unit="%" />
          <ChartCard title="Disk Usage History" color="#f59e0b" dataKey="disk" data={history} unit="%" />
          <ChartCard title="Load Average History" color="#a855f7" dataKey="load" data={history} unit="" domain={undefined} />
        </div>
      )}

      {/* Hardware Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Server className="w-5 h-5 text-blue-400" /> System</h3>
          <InfoRow label="Hostname" value={node.hostname} />
          <InfoRow label="Hypervisor" value={`${node.hypervisor} ${node.hypervisor_version}`} />
          <InfoRow label="Libvirt" value={node.lib_version} />
          <InfoRow label="Active VMs" value={node.active_vms} />
          <InfoRow label="Defined VMs" value={node.defined_vms} />
          {stats && <InfoRow label="Processes" value={stats.processes} />}
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Cpu className="w-5 h-5 text-purple-400" /> CPU</h3>
          <InfoRow label="Architecture" value={node.cpu_model} />
          <InfoRow label="Cores" value={node.cpu_cores} />
          <InfoRow label="Threads per Core" value={node.cpu_threads} />
          <InfoRow label="Sockets" value={node.cpu_sockets} />
          <InfoRow label="Total vCPUs" value={node.cpu_cores * node.cpu_threads * node.cpu_sockets} />
          <InfoRow label="NUMA Nodes" value={node.numa_nodes} />
          {stats && <InfoRow label="Current Load" value={`${stats.load_1.toFixed(2)} / ${stats.load_5.toFixed(2)} / ${stats.load_15.toFixed(2)}`} />}
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2"><MemoryStick className="w-5 h-5 text-emerald-400" /> Memory</h3>
          <InfoRow label="Total RAM" value={`${(node.memory_mb / 1024).toFixed(1)} GB`} />
          {stats && (
            <>
              <InfoRow label="Used" value={`${(stats.memory_used_mb / 1024).toFixed(1)} GB (${stats.memory_percent.toFixed(1)}%)`} />
              <InfoRow label="Available" value={`${((stats.memory_total_mb - stats.memory_used_mb) / 1024).toFixed(1)} GB`} />
              <InfoRow label="Swap Total" value={`${(stats.swap_total_mb / 1024).toFixed(1)} GB`} />
              <InfoRow label="Swap Used" value={`${(stats.swap_used_mb / 1024).toFixed(1)} GB`} />
            </>
          )}
        </div>
      </div>

      {/* Storage Overview */}
      {stats && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><Database className="w-5 h-5 text-orange-400" /> Storage</h3>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-xs text-slate-500 mb-1">Total</div>
              <div className="text-2xl font-bold">{stats.disk_total_gb.toFixed(0)} GB</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Used</div>
              <div className="text-2xl font-bold text-orange-400">{stats.disk_used_gb.toFixed(0)} GB</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Free</div>
              <div className="text-2xl font-bold text-green-400">{(stats.disk_total_gb - stats.disk_used_gb).toFixed(0)} GB</div>
            </div>
          </div>
          <div className="mt-4 w-full bg-slate-700 rounded-full h-3">
            <div className={`h-3 rounded-full transition-all ${stats.disk_percent > 90 ? 'bg-red-500' : stats.disk_percent > 70 ? 'bg-yellow-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(stats.disk_percent, 100)}%` }} />
          </div>
          <div className="text-xs text-slate-500 mt-1 text-right">{stats.disk_percent.toFixed(1)}% used</div>
        </div>
      )}
    </div>
  )
}

function ResourceGauge({ icon, label, value, subtitle }: { icon: React.ReactNode; label: string; value: number; subtitle: string }) {
  const color = value > 90 ? 'text-red-400' : value > 70 ? 'text-yellow-400' : 'text-green-400'
  const barColor = value > 90 ? 'bg-red-500' : value > 70 ? 'bg-yellow-500' : 'bg-blue-500'
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium flex-1">{label}</span>
        <span className={`text-lg font-bold ${color}`}>{value.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2 mb-1.5">
        <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <div className="text-xs text-slate-500">{subtitle}</div>
    </div>
  )
}

function ChartCard({ title, color, dataKey, data, unit, domain }: { title: string; color: string; dataKey: string; data: StatsPoint[]; unit: string; domain?: [number, number] }) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
      <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} />
          <YAxis stroke="#475569" fontSize={10} tickLine={false} domain={domain || [0, 100]} />
          <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '0.5rem' }} labelStyle={{ color: '#94a3b8' }} formatter={(v: number) => `${v.toFixed(1)}${unit}`} />
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fillOpacity={1} fill={`url(#grad-${dataKey})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700/30">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="text-sm font-medium">{String(value)}</span>
    </div>
  )
}
