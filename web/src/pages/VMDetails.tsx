import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router'
import { getVM, getVMMetrics, startVM, stopVM, shutdownVM, rebootVM, pauseVM, resumeVM, setAutostart, getInterfaces, getBootConfig, hasManagedSave, managedSave, managedSaveRemove, insertCdrom, ejectCdrom, VmDetails, VmMetrics, GuestInterface, BootConfig } from '../api/vm'
import { listSnapshots, SnapshotInfo } from '../api/snapshot'
import { getStateBadgeClasses, formatBytes } from '../utils/vm'
import { useToastContext } from '../contexts/ToastContext'
import { ArrowLeft, Play, Square, Power, RotateCcw, Pause, RefreshCw, ToggleLeft, ToggleRight, Cpu, HardDrive, Network, Camera, Terminal, Save, Disc, CircleX } from 'lucide-react'

export default function VMDetailsPage() {
  const { name } = useParams<{ name: string }>()
  const [vm, setVM] = useState<VmDetails | null>(null)
  const [metrics, setMetrics] = useState<VmMetrics | null>(null)
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([])
  const [guestIfaces, setGuestIfaces] = useState<GuestInterface[]>([])
  const [bootConfig, setBootConfig] = useState<BootConfig | null>(null)
  const [managedSaveStatus, setManagedSaveStatus] = useState<boolean>(false)
  const [cdromPath, setCdromPath] = useState('')
  const [cdromTarget, setCdromTarget] = useState('hdc')
  const [showCdromDialog, setShowCdromDialog] = useState(false)
  const [tab, setTab] = useState<'overview' | 'disks' | 'network' | 'snapshots'>('overview')
  const [loading, setLoading] = useState(true)
  const toast = useToastContext()

  const load = async () => {
    if (!name) return
    try {
      const [vmData, snapData] = await Promise.all([getVM(name), listSnapshots(name).catch(() => [])])
      setVM(vmData)
      setSnapshots(snapData)
      if (vmData.state === 'running') {
        try { setMetrics(await getVMMetrics(name)) } catch { /* no metrics */ }
        try { setGuestIfaces(await getInterfaces(name)) } catch { /* guest agent may not be running */ }
      }
      try { setBootConfig(await getBootConfig(name)) } catch { /* boot config may not be available */ }
      try { setManagedSaveStatus(await hasManagedSave(name)) } catch { /* managed save status may not be available */ }
    } catch (e: unknown) {
      toast.error(`Failed to load VM: ${e instanceof Error ? e.message : e}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [name])

  const action = async (fn: (n: string) => Promise<void>, label: string) => {
    if (!name) return
    try { await fn(name); toast.success(`${label} OK`); load() } catch (e: unknown) { toast.error(`${label} failed: ${e instanceof Error ? e.message : e}`) }
  }

  const handleInsertCdrom = async () => {
    if (!name) return
    try { await insertCdrom(name, cdromPath, cdromTarget); toast.success('CD-ROM inserted'); setShowCdromDialog(false); setCdromPath('') } catch (e: unknown) { toast.error(`Insert CD-ROM failed: ${e instanceof Error ? e.message : e}`) }
  }

  const handleEjectCdrom = async () => {
    if (!name) return
    try { await ejectCdrom(name, cdromTarget); toast.success('CD-ROM ejected') } catch (e: unknown) { toast.error(`Eject CD-ROM failed: ${e instanceof Error ? e.message : e}`) }
  }

  const toggleAutostart = async () => {
    if (!name || !vm) return
    try { await setAutostart(name, !vm.autostart); toast.success(`Autostart ${!vm.autostart ? 'enabled' : 'disabled'}`); load() } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>
  if (!vm) return <div className="text-center text-gray-500 py-12">VM not found</div>

  const tabs = [
    { key: 'overview', label: 'Overview', icon: <Cpu className="w-4 h-4" /> },
    { key: 'disks', label: `Disks (${vm.disks.length})`, icon: <HardDrive className="w-4 h-4" /> },
    { key: 'network', label: `Network (${vm.interfaces.length})`, icon: <Network className="w-4 h-4" /> },
    { key: 'snapshots', label: `Snapshots (${snapshots.length})`, icon: <Camera className="w-4 h-4" /> },
  ] as const

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/vms" className="p-2 hover:bg-gray-700 rounded transition"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{vm.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStateBadgeClasses(vm.state)}`}>{vm.state}</span>
            <span className="text-sm text-gray-400">{vm.uuid}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/vms/${vm.name}/console`} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition flex items-center gap-1"><Terminal className="w-4 h-4" /> Console</Link>
          {vm.state === 'shutoff' && <button onClick={() => action(startVM, 'Start')} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm transition flex items-center gap-1"><Play className="w-4 h-4" /> Start</button>}
          {vm.state === 'running' && (
            <>
              <button onClick={() => action(shutdownVM, 'Shutdown')} className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 rounded text-sm transition flex items-center gap-1"><Power className="w-4 h-4" /> Shutdown</button>
              <button onClick={() => action(rebootVM, 'Reboot')} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm transition flex items-center gap-1"><RotateCcw className="w-4 h-4" /> Reboot</button>
              <button onClick={() => action(stopVM, 'Force Stop')} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm transition flex items-center gap-1"><Square className="w-4 h-4" /> Stop</button>
              <button onClick={() => action(pauseVM, 'Pause')} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm transition flex items-center gap-1"><Pause className="w-4 h-4" /> Pause</button>
            </>
          )}
          {vm.state === 'paused' && <button onClick={() => action(resumeVM, 'Resume')} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm transition flex items-center gap-1"><RefreshCw className="w-4 h-4" /> Resume</button>}
          {vm.state === 'running' && <button onClick={() => action(managedSave, 'Managed Save')} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm transition flex items-center gap-1"><Save className="w-4 h-4" /> Managed Save</button>}
          {managedSaveStatus && <button onClick={() => action(managedSaveRemove, 'Remove Managed Save')} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 rounded text-sm transition flex items-center gap-1"><Save className="w-4 h-4" /> Remove Save</button>}
          <button onClick={() => setShowCdromDialog(true)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition flex items-center gap-1"><Disc className="w-4 h-4" /> Insert CD</button>
          <button onClick={handleEjectCdrom} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition flex items-center gap-1"><CircleX className="w-4 h-4" /> Eject CD</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-700">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2 text-sm transition border-b-2 ${tab === t.key ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-4">
            <h3 className="text-lg font-semibold">Configuration</h3>
            <InfoRow label="vCPUs" value={vm.vcpus} />
            <InfoRow label="Memory" value={`${vm.memory_mb} MB`} />
            <InfoRow label="OS Type" value={vm.os_type} />
            <InfoRow label="Architecture" value={vm.arch} />
            <InfoRow label="Persistent" value={vm.persistent ? 'Yes' : 'No'} />
            <InfoRow label="Managed Save" value={managedSaveStatus ? 'Yes' : 'No'} />
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-400 text-sm">Autostart</span>
              <button onClick={toggleAutostart} className="flex items-center gap-2 text-sm">
                {vm.autostart ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5 text-gray-500" />}
                <span className={vm.autostart ? 'text-green-400' : 'text-gray-500'}>{vm.autostart ? 'Enabled' : 'Disabled'}</span>
              </button>
            </div>
          </div>

          {bootConfig && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-4">
              <h3 className="text-lg font-semibold">Boot Configuration</h3>
              <InfoRow label="Boot Devices" value={bootConfig.boot_devices.join(', ') || 'None'} />
              {bootConfig.kernel && <InfoRow label="Kernel" value={bootConfig.kernel} />}
              {bootConfig.initrd && <InfoRow label="Initrd" value={bootConfig.initrd} />}
              {bootConfig.cmdline && <InfoRow label="Cmdline" value={bootConfig.cmdline} />}
            </div>
          )}

          {guestIfaces.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-4">
              <h3 className="text-lg font-semibold">Guest IP Addresses</h3>
              {guestIfaces.map((iface, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-400">{iface.name} <span className="text-gray-500 font-mono text-xs">{iface.hwaddr}</span></div>
                  {iface.addrs.map((addr, j) => (
                    <div key={j} className="flex items-center justify-between py-1 pl-4 border-b border-gray-700/50">
                      <span className="text-gray-400 text-sm">{addr.type === 0 ? 'IPv4' : 'IPv6'}</span>
                      <span className="text-sm font-mono">{addr.addr}/{addr.prefix}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {metrics && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-4">
              <h3 className="text-lg font-semibold">Live Metrics</h3>
              <InfoRow label="Memory Used" value={`${metrics.memory_used_mb} / ${metrics.memory_total_mb} MB (${metrics.memory_pct.toFixed(1)}%)`} />
              <InfoRow label="Disk Read" value={formatBytes(metrics.disk_rd_bytes)} />
              <InfoRow label="Disk Write" value={formatBytes(metrics.disk_wr_bytes)} />
              <InfoRow label="Net RX" value={formatBytes(metrics.net_rx_bytes)} />
              <InfoRow label="Net TX" value={formatBytes(metrics.net_tx_bytes)} />
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-400 mb-1"><span>Memory</span><span>{metrics.memory_pct.toFixed(0)}%</span></div>
                <div className="w-full bg-gray-700 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full" style={{ width: `${metrics.memory_pct}%` }} /></div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'disks' && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-gray-700 text-left text-sm text-gray-400"><th className="px-6 py-3">Target</th><th className="px-6 py-3">Device</th><th className="px-6 py-3">Driver</th><th className="px-6 py-3">Source</th></tr></thead>
            <tbody className="divide-y divide-gray-700">
              {vm.disks.map((d, i) => (
                <tr key={i} className="hover:bg-gray-700/50"><td className="px-6 py-3 font-mono text-sm">{d.target}</td><td className="px-6 py-3 text-sm">{d.device}</td><td className="px-6 py-3 text-sm">{d.driver}</td><td className="px-6 py-3 text-sm text-gray-400 truncate max-w-xs">{d.source}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'network' && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-gray-700 text-left text-sm text-gray-400"><th className="px-6 py-3">MAC Address</th><th className="px-6 py-3">Source</th><th className="px-6 py-3">Model</th></tr></thead>
            <tbody className="divide-y divide-gray-700">
              {vm.interfaces.map((iface, i) => (
                <tr key={i} className="hover:bg-gray-700/50"><td className="px-6 py-3 font-mono text-sm">{iface.mac_address}</td><td className="px-6 py-3 text-sm">{iface.source}</td><td className="px-6 py-3 text-sm">{iface.model}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'snapshots' && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          {snapshots.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No snapshots</div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-gray-700 text-left text-sm text-gray-400"><th className="px-6 py-3">Name</th><th className="px-6 py-3">State</th><th className="px-6 py-3">Created</th><th className="px-6 py-3">Current</th></tr></thead>
              <tbody className="divide-y divide-gray-700">
                {snapshots.map((s) => (
                  <tr key={s.name} className="hover:bg-gray-700/50">
                    <td className="px-6 py-3 font-medium">{s.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-400">{s.state}</td>
                    <td className="px-6 py-3 text-sm text-gray-400">{s.creation_time ? new Date(s.creation_time * 1000).toLocaleString() : '-'}</td>
                    <td className="px-6 py-3">{s.is_current && <span className="text-green-400 text-xs font-medium">● Current</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {showCdromDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCdromDialog(false)}>
          <div className="bg-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-700/50">
              <span className="text-lg font-semibold">Insert CD-ROM</span>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">ISO Path</label>
                <input type="text" value={cdromPath} onChange={(e) => setCdromPath(e.target.value)} placeholder="/var/lib/libvirt/images/file.iso" className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Target Device</label>
                <input type="text" value={cdromTarget} onChange={(e) => setCdromTarget(e.target.value)} placeholder="hdc" className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 pb-5">
              <button onClick={() => setShowCdromDialog(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition">Cancel</button>
              <button onClick={handleInsertCdrom} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white font-medium transition">Insert</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | number | boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-700/50">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-sm font-medium">{String(value)}</span>
    </div>
  )
}
