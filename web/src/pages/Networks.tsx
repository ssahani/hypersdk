import { useEffect, useState, useCallback } from 'react'
import { listNetworks, createNetwork, startNetwork, stopNetwork, deleteNetwork, setNetworkAutostart, NetworkInfo } from '../api/network'
import { listDhcpLeases, DhcpLease } from '../api/extras'
import { useToastContext } from '../contexts/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { Play, Square, Trash2, ToggleLeft, ToggleRight, RefreshCw, Plus, Network, Wifi, X } from 'lucide-react'

export default function NetworksPage() {
  const [networks, setNetworks] = useState<NetworkInfo[]>([])
  const [leases, setLeases] = useState<DhcpLease[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSubnet, setNewSubnet] = useState('192.168.100')
  const [newDhcpStart, setNewDhcpStart] = useState('192.168.100.100')
  const [newDhcpEnd, setNewDhcpEnd] = useState('192.168.100.254')
  const toast = useToastContext()

  const load = useCallback(async () => {
    try {
      const [nets, dhcp] = await Promise.allSettled([listNetworks(), listDhcpLeases()])
      if (nets.status === 'fulfilled') setNetworks(nets.value)
      if (dhcp.status === 'fulfilled') setLeases(dhcp.value)
    } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  const action = async (name: string, fn: (n: string) => Promise<void>, label: string) => {
    try { await fn(name); toast.success(`${label} '${name}' OK`); load() } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) }
  }

  const toggleAutostart = async (net: NetworkInfo) => {
    try { await setNetworkAutostart(net.name, !net.autostart); toast.success(`Autostart ${!net.autostart ? 'enabled' : 'disabled'}`); load() } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await action(deleteTarget, deleteNetwork, 'Delete network')
    setDeleteTarget(null)
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await createNetwork({ name: newName.trim(), subnet: newSubnet, dhcp_start: newDhcpStart, dhcp_end: newDhcpEnd })
      toast.success(`Network '${newName}' created`)
      setShowCreate(false); setNewName(''); load()
    } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) }
  }

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Network className="w-6 h-6 text-blue-400" /> Networks</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition flex items-center gap-1"><Plus className="w-4 h-4" /> Create</button>
          <button onClick={load} className="p-2 hover:bg-slate-700 rounded transition" aria-label="Refresh"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-slate-700/50 text-left text-sm text-slate-400"><th className="px-6 py-3">Name</th><th className="px-6 py-3">Active</th><th className="px-6 py-3 hidden md:table-cell">Bridge</th><th className="px-6 py-3 hidden md:table-cell">Autostart</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-700/50">
            {networks.map((net) => (
              <tr key={net.name} className="hover:bg-slate-700/50">
                <td className="px-6 py-3 font-medium"><Wifi className="w-4 h-4 inline -mt-0.5 mr-1 text-green-400" />{net.name}</td>
                <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${net.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{net.active ? 'Active' : 'Inactive'}</span></td>
                <td className="px-6 py-3 hidden md:table-cell text-sm text-slate-400 font-mono">{net.bridge || '-'}</td>
                <td className="px-6 py-3 hidden md:table-cell">
                  <button onClick={() => toggleAutostart(net)} className="flex items-center gap-1">
                    {net.autostart ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5 text-slate-500" />}
                  </button>
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {!net.active && <button onClick={() => action(net.name, startNetwork, 'Start network')} className="p-1.5 hover:bg-green-600/20 rounded transition" title="Start"><Play className="w-4 h-4 text-green-400" /></button>}
                    {net.active && <button onClick={() => action(net.name, stopNetwork, 'Stop network')} className="p-1.5 hover:bg-red-600/20 rounded transition" title="Stop"><Square className="w-4 h-4 text-red-400" /></button>}
                    <button onClick={() => setDeleteTarget(net.name)} className="p-1.5 hover:bg-red-600/20 rounded transition" title="Delete"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {networks.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No networks</td></tr>}
          </tbody>
        </table>
      </div>

      {/* DHCP Leases */}
      {leases.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-6 py-3 border-b border-slate-700/50"><h2 className="text-sm font-semibold text-slate-300">DHCP Leases</h2></div>
          <table className="w-full">
            <thead><tr className="border-b border-slate-700/50 text-left text-xs text-slate-500"><th className="px-6 py-2">Network</th><th className="px-6 py-2">IP Address</th><th className="px-6 py-2">MAC</th><th className="px-6 py-2">Hostname</th><th className="px-6 py-2">Expires</th></tr></thead>
            <tbody className="divide-y divide-slate-700/50 text-sm">
              {leases.map((l, i) => (
                <tr key={i} className="table-row-hover">
                  <td className="px-6 py-2 text-slate-400">{l.network}</td>
                  <td className="px-6 py-2 font-mono text-blue-400">{l.ip}</td>
                  <td className="px-6 py-2 font-mono text-xs text-slate-400">{l.mac}</td>
                  <td className="px-6 py-2">{l.hostname || '-'}</td>
                  <td className="px-6 py-2 text-slate-400">{l.expiry}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Network Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => setShowCreate(false)}>
          <div className="bg-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
              <span className="text-lg font-semibold flex items-center gap-2"><Network className="w-5 h-5 text-blue-400" /> Create Network</span>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-slate-700 rounded"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label htmlFor="net-name" className="block text-sm text-slate-400 mb-1">Name</label><input id="net-name" autoFocus value={newName} onChange={e => setNewName(e.target.value)} className="input-field" placeholder="my-network" /></div>
              <div><label htmlFor="net-subnet" className="block text-sm text-slate-400 mb-1">Subnet Prefix</label><input id="net-subnet" value={newSubnet} onChange={e => setNewSubnet(e.target.value)} className="input-field" placeholder="192.168.100" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label htmlFor="net-dhcp-start" className="block text-sm text-slate-400 mb-1">DHCP Start</label><input id="net-dhcp-start" value={newDhcpStart} onChange={e => setNewDhcpStart(e.target.value)} className="input-field" /></div>
                <div><label htmlFor="net-dhcp-end" className="block text-sm text-slate-400 mb-1">DHCP End</label><input id="net-dhcp-end" value={newDhcpEnd} onChange={e => setNewDhcpEnd(e.target.value)} className="input-field" /></div>
              </div>
              <p className="text-xs text-slate-500">Creates a NAT network with the given subnet and DHCP range.</p>
            </div>
            <div className="flex justify-end gap-3 px-5 pb-5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white font-medium transition">Create</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} title="Delete Network" message={`Delete network '${deleteTarget}'?`} confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  )
}
