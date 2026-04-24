import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router'
import { getNodeInfo, getHealth, NodeInfo, HealthStatus } from '../api/node'
import {
  getHostStats,
  HostStats,
  getSystemInfo,
  setHostname,
  setTimezone,
  SystemInfo,
  getHostFilesystems,
  getHostTopProcesses,
  getHostPackageUpdates,
  getHostNetCounters,
  getHostNetRates,
  getHostPasswdUsers,
  getHostGroups,
  getHostSecuritySummary,
  HostFilesystem,
  HostProcess,
  PackageUpdateCheck,
  NetDevCounter,
  NetDevRatesResponse,
  PasswdEntry,
  GroupEntry,
  HostSecuritySummary,
} from '../api/extras'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Cpu, HardDrive, Server, CheckCircle, XCircle, Clock, Gauge, RefreshCw, MemoryStick, Database, Monitor, Pencil, Check, X, FolderTree, ListOrdered, ArrowUpRight, Package, Shield, Network, Users, UserSquare, Activity } from 'lucide-react'
import { formatBytes } from '../utils/vm'
import { useToastContext } from '../contexts/ToastContext'

interface StatsPoint { time: string; cpu: number; mem: number; disk: number; load: number }

export default function NodeInfoPage() {
  const toast = useToastContext()
  const [node, setNode] = useState<NodeInfo | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [stats, setStats] = useState<HostStats | null>(null)
  const [history, setHistory] = useState<StatsPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null)
  const [filesystems, setFilesystems] = useState<HostFilesystem[]>([])
  const [topProcesses, setTopProcesses] = useState<HostProcess[]>([])
  const [pkgUpdates, setPkgUpdates] = useState<PackageUpdateCheck | null>(null)
  const [netCounters, setNetCounters] = useState<NetDevCounter[]>([])
  const [netRates, setNetRates] = useState<NetDevRatesResponse | null>(null)
  const [netRatesLoading, setNetRatesLoading] = useState(false)
  const [rateSampleMs, setRateSampleMs] = useState(1000)
  const [passwdUsers, setPasswdUsers] = useState<PasswdEntry[]>([])
  const [groups, setGroups] = useState<GroupEntry[]>([])
  const [securitySummary, setSecuritySummary] = useState<HostSecuritySummary | null>(null)
  const [showSystemAccounts, setShowSystemAccounts] = useState(false)
  const [editingHostname, setEditingHostname] = useState(false)
  const [editingTimezone, setEditingTimezone] = useState(false)
  const [hostnameInput, setHostnameInput] = useState('')
  const [timezoneInput, setTimezoneInput] = useState('')

  const load = useCallback(() => {
    Promise.allSettled([
      getNodeInfo(),
      getHealth(),
      getHostStats(),
      getSystemInfo(),
      getHostFilesystems(),
      getHostTopProcesses(20),
      getHostPackageUpdates(),
      getHostNetCounters(),
      getHostPasswdUsers(200),
      getHostGroups(200),
      getHostSecuritySummary(),
    ])
      .then(([n, h, s, si, fs, tp, pk, nc, pw, gr, sec]) => {
        if (n.status === 'fulfilled') setNode(n.value)
        if (h.status === 'fulfilled') setHealth(h.value)
        if (si.status === 'fulfilled') setSysInfo(si.value)
        if (fs.status === 'fulfilled') setFilesystems(fs.value)
        else setFilesystems([])
        if (tp.status === 'fulfilled') setTopProcesses(tp.value)
        else setTopProcesses([])
        if (pk.status === 'fulfilled') {
          setPkgUpdates(pk.value)
        } else {
          setPkgUpdates({
            backend: 'unknown',
            probed: false,
            pending_count: null,
            summary: null,
            hint: 'Could not load package probe (non-Linux UI build, or API error).',
            error: pk.status === 'rejected' ? (pk.reason instanceof Error ? pk.reason.message : String(pk.reason)) : null,
          })
        }
        if (nc.status === 'fulfilled') setNetCounters(nc.value)
        else setNetCounters([])
        if (pw.status === 'fulfilled') setPasswdUsers(pw.value)
        else setPasswdUsers([])
        if (gr.status === 'fulfilled') setGroups(gr.value)
        else setGroups([])
        if (sec.status === 'fulfilled') setSecuritySummary(sec.value)
        else setSecuritySummary(null)
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

  const measureNetRates = useCallback(async () => {
    setNetRatesLoading(true)
    try {
      const r = await getHostNetRates(rateSampleMs)
      setNetRates(r)
    } catch (e: unknown) {
      toast.error(`Bandwidth sample failed: ${e instanceof Error ? e.message : e}`)
    } finally {
      setNetRatesLoading(false)
    }
  }, [rateSampleMs, toast])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>
  if (!node) return <div className="text-center text-slate-500 py-12">Failed to load host info</div>

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
          <h1 className="text-2xl font-bold flex items-center gap-2"><Server className="w-6 h-6 text-blue-400" /> Host overview</h1>
          <p className="text-sm text-slate-400 mt-0.5">{node.hostname} — usage, mounts, and top processes (read-only)</p>
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
          {sysInfo.cpu_model && <InfoRow label="CPU Model" value={sysInfo.cpu_model} />}
          {sysInfo.sys_vendor && <InfoRow label="Vendor" value={sysInfo.sys_vendor} />}
          {sysInfo.product_name && <InfoRow label="Product" value={sysInfo.product_name} />}
          {sysInfo.board_name && <InfoRow label="Board" value={sysInfo.board_name} />}
          {sysInfo.bios_version && <InfoRow label="BIOS" value={`${sysInfo.bios_version} (${sysInfo.bios_date})`} />}
          {sysInfo.serial_number && sysInfo.serial_number !== 'None' && <InfoRow label="Serial" value={sysInfo.serial_number} />}
          {sysInfo.virtualization && sysInfo.virtualization !== 'none' && <InfoRow label="Virtualization" value={sysInfo.virtualization} />}

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

      {/* Storage Overview (root aggregate) */}
      {stats && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><Database className="w-5 h-5 text-orange-400" /> Root filesystem</h3>
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
          <div className="text-xs text-slate-500 mt-1 text-right">{stats.disk_percent.toFixed(1)}% used (/) </div>
        </div>
      )}

      {/* All mounts — df */}
      {filesystems.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-lg font-semibold flex items-center gap-2"><FolderTree className="w-5 h-5 text-amber-400" /> Filesystems</h3>
            <span className="text-xs text-slate-500">Per mount from the hypervisor (same idea as Cockpit Storage)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700/50">
                  <th className="px-6 py-3 font-medium">Mounted on</th>
                  <th className="px-6 py-3 font-medium hidden lg:table-cell">Device</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium text-right">Size</th>
                  <th className="px-6 py-3 font-medium text-right hidden md:table-cell">Used</th>
                  <th className="px-6 py-3 font-medium text-right hidden md:table-cell">Avail</th>
                  <th className="px-6 py-3 font-medium text-right">Use</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filesystems.map((row) => (
                  <tr key={`${row.source}-${row.mount_point}`} className="hover:bg-slate-700/30">
                    <td className="px-6 py-3 font-mono text-slate-200">{row.mount_point}</td>
                    <td className="px-6 py-3 font-mono text-slate-400 text-xs max-w-[14rem] truncate hidden lg:table-cell" title={row.source}>{row.source}</td>
                    <td className="px-6 py-3 text-slate-300">{row.fstype}</td>
                    <td className="px-6 py-3 text-right text-slate-200">{formatBytes(row.size_bytes)}</td>
                    <td className="px-6 py-3 text-right text-slate-300 hidden md:table-cell">{formatBytes(row.used_bytes)}</td>
                    <td className="px-6 py-3 text-right text-slate-300 hidden md:table-cell">{formatBytes(row.avail_bytes)}</td>
                    <td className="px-6 py-3 text-right">
                      <span className={row.use_percent > 90 ? 'text-red-400 font-medium' : row.use_percent > 75 ? 'text-amber-400' : 'text-slate-200'}>
                        {row.use_percent.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top processes by RSS */}
      {topProcesses.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-lg font-semibold flex items-center gap-2"><ListOrdered className="w-5 h-5 text-cyan-400" /> Top processes by memory</h3>
            <span className="text-xs text-slate-500">RSS from ps; full argv from /proc (all Linux distros)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700/50">
                  <th className="px-6 py-3 font-medium">PID</th>
                  <th className="px-6 py-3 font-medium">User</th>
                  <th className="px-6 py-3 font-medium text-right">CPU%</th>
                  <th className="px-6 py-3 font-medium text-right">RSS</th>
                  <th className="px-6 py-3 font-medium">Comm</th>
                  <th className="px-6 py-3 font-medium hidden xl:table-cell">Command line</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {topProcesses.map((p) => (
                  <tr key={p.pid} className="hover:bg-slate-700/30">
                    <td className="px-6 py-3 font-mono text-slate-300">{p.pid}</td>
                    <td className="px-6 py-3 text-slate-300">{p.user}</td>
                    <td className="px-6 py-3 text-right text-slate-200">{p.cpu_percent.toFixed(1)}</td>
                    <td className="px-6 py-3 text-right text-slate-200">{formatBytes(p.rss_kb * 1024)}</td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-400 truncate max-w-[10rem]" title={p.command}>{p.command}</td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-500 truncate max-w-xl hidden xl:table-cell" title={p.args || ''}>{p.args || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 px-4 py-3 text-xs text-slate-400 leading-relaxed">
        <span className="font-medium text-slate-300">How this works across distros: </span>
        Updates use apt on Debian/Ubuntu (before dnf so WSL/mixed installs stay correct), then microdnf/dnf, yum, Alpine <code className="text-slate-500">apk</code>, pacman, zypper.
        User and group tables prefer <code className="text-slate-500">getent</code> (honours LDAP/NIS), falling back to <code className="text-slate-500">/etc/passwd</code> / <code className="text-slate-500">/etc/group</code>.
        Network totals are cumulative since boot from <code className="text-slate-500">/proc/net/dev</code>; live throughput uses two samples on demand (blocks the chosen interval on the daemon). Firewall detection matches Host networking (ufw vs firewalld vs iptables).
      </div>

      {!loading && pkgUpdates && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 space-y-2">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Package className="w-5 h-5 text-green-400" /> Package updates (read-only)</h3>
          <div className="text-sm text-slate-300 space-y-1">
            <div><span className="text-slate-500">Backend:</span> <code className="text-amber-300/90">{pkgUpdates.backend}</code></div>
            {pkgUpdates.summary && <div>{pkgUpdates.summary}</div>}
            {pkgUpdates.pending_count != null && <div><span className="text-slate-500">Pending count:</span> {pkgUpdates.pending_count}</div>}
            {pkgUpdates.hint && <div className="text-slate-500 text-xs">{pkgUpdates.hint}</div>}
            {pkgUpdates.error && <div className="text-red-400 text-xs break-words">{pkgUpdates.error}</div>}
          </div>
        </div>
      )}

      {securitySummary && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 space-y-2">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Shield className="w-5 h-5 text-orange-400" /> Firewall &amp; host networking stack</h3>
          <div className="text-sm text-slate-300 grid sm:grid-cols-2 gap-2">
            <div><span className="text-slate-500">Network tooling:</span> <code className="text-cyan-300/90">{securitySummary.network_backend}</code></div>
            <div><span className="text-slate-500">Firewall:</span> <code className="text-cyan-300/90">{securitySummary.firewall_backend}</code></div>
            {securitySummary.ufw_status_line && <div className="sm:col-span-2 text-xs font-mono text-slate-400">{securitySummary.ufw_status_line}</div>}
            {securitySummary.firewalld_default_zone && (
              <div className="sm:col-span-2"><span className="text-slate-500">firewalld default zone:</span> <code className="text-cyan-300/90">{securitySummary.firewalld_default_zone}</code></div>
            )}
          </div>
        </div>
      )}

      {netCounters.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Network className="w-5 h-5 text-sky-400" /> Network I/O (since boot)</h3>
            <span className="text-xs text-slate-500">From /proc/net/dev — same counters on Ubuntu, Fedora, Arch, …</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700/50">
                  <th className="px-6 py-3 font-medium">Interface</th>
                  <th className="px-6 py-3 font-medium text-right">RX</th>
                  <th className="px-6 py-3 font-medium text-right hidden md:table-cell">RX pkt</th>
                  <th className="px-6 py-3 font-medium text-right">TX</th>
                  <th className="px-6 py-3 font-medium text-right hidden md:table-cell">TX pkt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {netCounters.filter((r) => r.iface !== 'lo').map((r) => (
                  <tr key={r.iface} className="hover:bg-slate-700/30">
                    <td className="px-6 py-3 font-mono text-slate-200">{r.iface}</td>
                    <td className="px-6 py-3 text-right text-slate-200">{formatBytes(r.rx_bytes)}</td>
                    <td className="px-6 py-3 text-right text-slate-400 hidden md:table-cell">{r.rx_packets.toLocaleString()}</td>
                    <td className="px-6 py-3 text-right text-slate-200">{formatBytes(r.tx_bytes)}</td>
                    <td className="px-6 py-3 text-right text-slate-400 hidden md:table-cell">{r.tx_packets.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2"><Activity className="w-5 h-5 text-emerald-400" /> Live throughput</h3>
            <p className="text-xs text-slate-500 mt-1">Two reads of <code className="text-slate-600">/proc/net/dev</code>; excludes <code className="text-slate-600">lo</code>. Same on all Linux distros.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={rateSampleMs}
              onChange={(e) => setRateSampleMs(Number(e.target.value))}
              disabled={netRatesLoading}
              className="bg-slate-900 border border-slate-600 rounded-lg text-sm py-1.5 px-2 text-slate-200"
            >
              <option value={250}>250 ms window</option>
              <option value={500}>500 ms</option>
              <option value={1000}>1 s</option>
              <option value={2000}>2 s</option>
              <option value={5000}>5 s</option>
            </select>
            <button
              type="button"
              onClick={() => void measureNetRates()}
              disabled={netRatesLoading}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600/25 text-emerald-300 border border-emerald-600/40 hover:bg-emerald-600/35 disabled:opacity-50 transition"
            >
              {netRatesLoading ? 'Sampling…' : 'Sample now'}
            </button>
          </div>
        </div>
        {netRates && netRates.interfaces.length > 0 && (
          <div className="overflow-x-auto">
            <p className="text-xs text-slate-500 px-6 pt-3">Averaged over {netRates.sample_interval_ms} ms</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700/50">
                  <th className="px-6 py-3 font-medium">Interface</th>
                  <th className="px-6 py-3 font-medium text-right">RX</th>
                  <th className="px-6 py-3 font-medium text-right">TX</th>
                  <th className="px-6 py-3 font-medium text-right hidden md:table-cell">RX pkt/s</th>
                  <th className="px-6 py-3 font-medium text-right hidden md:table-cell">TX pkt/s</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {netRates.interfaces.map((r) => (
                  <tr key={r.iface} className="hover:bg-slate-700/30">
                    <td className="px-6 py-3 font-mono text-slate-200">{r.iface}</td>
                    <td className="px-6 py-3 text-right text-slate-200">{formatBytes(r.rx_bytes_per_sec)}/s</td>
                    <td className="px-6 py-3 text-right text-slate-200">{formatBytes(r.tx_bytes_per_sec)}/s</td>
                    <td className="px-6 py-3 text-right text-slate-400 hidden md:table-cell">{r.rx_packets_per_sec.toFixed(0)}</td>
                    <td className="px-6 py-3 text-right text-slate-400 hidden md:table-cell">{r.tx_packets_per_sec.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {netRates && netRates.interfaces.length === 0 && !netRatesLoading && (
          <p className="text-sm text-slate-500 px-6 py-4">No non-loopback interfaces in sample.</p>
        )}
        {!netRates && !netRatesLoading && (
          <p className="text-sm text-slate-500 px-6 py-4">Choose a window and click Sample now. The API blocks for that duration on the hypervisor (not run on every auto-refresh).</p>
        )}
      </div>

      {passwdUsers.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700/50 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Users className="w-5 h-5 text-violet-400" /> Accounts (passwd)</h3>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={showSystemAccounts} onChange={(e) => setShowSystemAccounts(e.target.checked)} className="rounded border-slate-600 bg-slate-900" />
              Show system accounts (UID {'<'} 1000)
            </label>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-800 z-10">
                <tr className="text-left text-slate-400 border-b border-slate-700/50">
                  <th className="px-6 py-3 font-medium">User</th>
                  <th className="px-6 py-3 font-medium">UID</th>
                  <th className="px-6 py-3 font-medium">GID</th>
                  <th className="px-6 py-3 font-medium hidden lg:table-cell">Home</th>
                  <th className="px-6 py-3 font-medium hidden md:table-cell">Shell</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {passwdUsers.filter((u) => showSystemAccounts || !u.system_account).map((u) => (
                  <tr key={`${u.username}-${u.uid}`} className="hover:bg-slate-700/30">
                    <td className="px-6 py-2 font-mono text-slate-200">{u.username}{u.system_account && <span className="text-slate-500 text-[10px] ml-1">sys</span>}</td>
                    <td className="px-6 py-2 text-slate-300">{u.uid}</td>
                    <td className="px-6 py-2 text-slate-300">{u.gid}</td>
                    <td className="px-6 py-2 text-slate-400 text-xs hidden lg:table-cell truncate max-w-xs" title={u.home}>{u.home}</td>
                    <td className="px-6 py-2 text-slate-400 text-xs hidden md:table-cell truncate max-w-[12rem]" title={u.shell}>{u.shell}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {groups.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700/50">
            <h3 className="text-lg font-semibold flex items-center gap-2"><UserSquare className="w-5 h-5 text-fuchsia-400" /> Groups (first rows)</h3>
            <p className="text-xs text-slate-500 mt-1">Truncated list from getent/file; large LDAP domains may be incomplete.</p>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-800 z-10">
                <tr className="text-left text-slate-400 border-b border-slate-700/50">
                  <th className="px-6 py-3 font-medium">Group</th>
                  <th className="px-6 py-3 font-medium">GID</th>
                  <th className="px-6 py-3 font-medium">Members</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {groups.map((g) => (
                  <tr key={`${g.name}-${g.gid}`} className="hover:bg-slate-700/30">
                    <td className="px-6 py-2 font-mono text-slate-200">{g.name}</td>
                    <td className="px-6 py-2 text-slate-300">{g.gid}</td>
                    <td className="px-6 py-2 text-slate-400 text-xs break-all">{g.members.length ? g.members.join(', ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        <Link to="/services" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700/50 text-slate-200 hover:border-blue-500/40 hover:text-blue-300 transition">
          Systemd services <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
        </Link>
        <Link to="/logs" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700/50 text-slate-200 hover:border-blue-500/40 hover:text-blue-300 transition">
          Journal logs <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
        </Link>
        <Link to="/host-networking" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700/50 text-slate-200 hover:border-blue-500/40 hover:text-blue-300 transition">
          Host networking <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
        </Link>
      </div>
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
