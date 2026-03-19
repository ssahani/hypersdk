import { useEffect, useState, useCallback } from 'react'
import { listPools, listVolumes, startPool, stopPool, refreshPool, deleteVolume, StoragePoolInfo, StorageVolumeInfo } from '../api/storage'
import { createPool, deletePool, getPoolXml, resizeVolume, cloneVolume } from '../api/advanced'
import { useToastContext } from '../contexts/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { Play, Square, RefreshCw, Trash2, ArrowLeft, HardDrive, Plus, Code, X, Copy, Maximize } from 'lucide-react'

export default function StoragePage() {
  const [pools, setPools] = useState<StoragePoolInfo[]>([])
  const [volumes, setVolumes] = useState<StorageVolumeInfo[]>([])
  const [selectedPool, setSelectedPool] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<{ pool: string; vol: string } | null>(null)
  const [deletePoolTarget, setDeletePoolTarget] = useState<string | null>(null)
  const [showCreatePool, setShowCreatePool] = useState(false)
  const [newPoolName, setNewPoolName] = useState('')
  const [newPoolType, setNewPoolType] = useState('dir')
  const [newPoolPath, setNewPoolPath] = useState('')
  const [xmlContent, setXmlContent] = useState<string | null>(null)
  const [xmlName, setXmlName] = useState('')
  const [resizeTarget, setResizeTarget] = useState<{ pool: string; vol: string } | null>(null)
  const [resizeGb, setResizeGb] = useState('')
  const [cloneTarget, setCloneTarget] = useState<{ pool: string; vol: string } | null>(null)
  const [cloneName, setCloneName] = useState('')
  const toast = useToastContext()

  const loadPools = useCallback(async () => {
    try { setPools(await listPools()) } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) } finally { setLoading(false) }
  }, [toast])

  const loadVolumes = async (pool: string) => {
    try { setVolumes(await listVolumes(pool)); setSelectedPool(pool) } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) }
  }

  useEffect(() => { loadPools() }, [loadPools])

  const poolAction = async (name: string, fn: (n: string) => Promise<void>, label: string) => {
    try { await fn(name); toast.success(`${label} '${name}' OK`); loadPools() } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) }
  }

  const handleDeleteVol = async () => {
    if (!deleteTarget) return
    try { await deleteVolume(deleteTarget.pool, deleteTarget.vol); toast.success(`Deleted volume '${deleteTarget.vol}'`); loadVolumes(deleteTarget.pool) } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) }
    setDeleteTarget(null)
  }

  const handleDeletePool = async () => {
    if (!deletePoolTarget) return
    try { await deletePool(deletePoolTarget); toast.success(`Deleted pool '${deletePoolTarget}'`); loadPools() } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) }
    setDeletePoolTarget(null)
  }

  const handleCreatePool = async () => {
    try { await createPool({ name: newPoolName, pool_type: newPoolType, target_path: newPoolPath }); toast.success(`Created pool '${newPoolName}'`); setShowCreatePool(false); setNewPoolName(''); setNewPoolPath(''); loadPools() } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) }
  }

  const showPoolXml = async (name: string) => {
    try { const xml = await getPoolXml(name); setXmlContent(xml); setXmlName(name) } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) }
  }

  const handleResize = async () => {
    if (!resizeTarget) return
    try { await resizeVolume(resizeTarget.pool, resizeTarget.vol, parseFloat(resizeGb)); toast.success(`Resized volume '${resizeTarget.vol}'`); loadVolumes(resizeTarget.pool) } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) }
    setResizeTarget(null); setResizeGb('')
  }

  const handleClone = async () => {
    if (!cloneTarget) return
    try { await cloneVolume(cloneTarget.pool, cloneTarget.vol, cloneName); toast.success(`Cloned volume '${cloneTarget.vol}' to '${cloneName}'`); loadVolumes(cloneTarget.pool) } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) }
    setCloneTarget(null); setCloneName('')
  }

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>

  if (selectedPool) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => { setSelectedPool(null); setVolumes([]) }} className="p-2 hover:bg-gray-700 rounded transition"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-bold">Volumes in '{selectedPool}'</h1>
          <button onClick={() => loadVolumes(selectedPool)} className="p-2 hover:bg-gray-700 rounded transition"><RefreshCw className="w-4 h-4" /></button>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          {volumes.length === 0 ? <div className="p-8 text-center text-gray-500">No volumes</div> : (
            <table className="w-full">
              <thead><tr className="border-b border-gray-700 text-left text-sm text-gray-400"><th className="px-6 py-3">Name</th><th className="px-6 py-3">Type</th><th className="px-6 py-3">Capacity</th><th className="px-6 py-3">Used</th><th className="px-6 py-3 hidden lg:table-cell">Path</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-700">
                {volumes.map((v) => (
                  <tr key={v.name} className="hover:bg-gray-700/50">
                    <td className="px-6 py-3 font-medium">{v.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-400">{v.vol_type}</td>
                    <td className="px-6 py-3 text-sm">{v.capacity_gb.toFixed(2)} GB</td>
                    <td className="px-6 py-3 text-sm">{v.allocation_gb.toFixed(2)} GB</td>
                    <td className="px-6 py-3 text-sm text-gray-400 truncate max-w-xs hidden lg:table-cell">{v.path}</td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setResizeTarget({ pool: selectedPool, vol: v.name }); setResizeGb(v.capacity_gb.toFixed(2)) }} className="p-1.5 hover:bg-blue-600/20 rounded transition" title="Resize"><Maximize className="w-4 h-4 text-blue-400" /></button>
                        <button onClick={() => { setCloneTarget({ pool: selectedPool, vol: v.name }); setCloneName(`${v.name}-clone`) }} className="p-1.5 hover:bg-green-600/20 rounded transition" title="Clone"><Copy className="w-4 h-4 text-green-400" /></button>
                        <button onClick={() => setDeleteTarget({ pool: selectedPool, vol: v.name })} className="p-1.5 hover:bg-red-600/20 rounded transition" title="Delete"><Trash2 className="w-4 h-4 text-red-400" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <ConfirmDialog open={!!deleteTarget} title="Delete Volume" message={`Delete volume '${deleteTarget?.vol}'?`} confirmLabel="Delete" onConfirm={handleDeleteVol} onCancel={() => setDeleteTarget(null)} />

        {resizeTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setResizeTarget(null)}>
            <div className="bg-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-700/50"><span className="text-lg font-semibold">Resize Volume</span></div>
              <div className="p-5 space-y-4">
                <div className="text-sm text-gray-400">Volume: <span className="text-white font-medium">{resizeTarget.vol}</span></div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">New Size (GB)</label>
                  <input type="number" step="0.01" value={resizeGb} onChange={(e) => setResizeGb(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-5 pb-5">
                <button onClick={() => setResizeTarget(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition">Cancel</button>
                <button onClick={handleResize} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white font-medium transition">Resize</button>
              </div>
            </div>
          </div>
        )}

        {cloneTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setCloneTarget(null)}>
            <div className="bg-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-700/50"><span className="text-lg font-semibold">Clone Volume</span></div>
              <div className="p-5 space-y-4">
                <div className="text-sm text-gray-400">Source: <span className="text-white font-medium">{cloneTarget.vol}</span></div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">New Volume Name</label>
                  <input type="text" value={cloneName} onChange={(e) => setCloneName(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-5 pb-5">
                <button onClick={() => setCloneTarget(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition">Cancel</button>
                <button onClick={handleClone} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm text-white font-medium transition">Clone</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Storage Pools</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreatePool(true)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm transition flex items-center gap-1"><Plus className="w-4 h-4" /> Create Pool</button>
          <button onClick={loadPools} className="p-2 hover:bg-gray-700 rounded transition"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pools.map((pool) => (
          <div key={pool.name} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-cyan-500" />
                <span className="font-semibold">{pool.name}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${pool.state === 'running' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>{pool.state}</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Capacity</span><span>{pool.capacity_gb.toFixed(1)} GB</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Used</span><span>{pool.allocation_gb.toFixed(1)} GB</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Available</span><span>{pool.available_gb.toFixed(1)} GB</span></div>
              {pool.capacity_gb > 0 && (
                <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                  <div className="bg-cyan-500 h-2 rounded-full" style={{ width: `${(pool.allocation_gb / pool.capacity_gb * 100).toFixed(0)}%` }} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-700">
              <button onClick={() => loadVolumes(pool.name)} className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition text-center">Browse</button>
              {pool.state !== 'running' && <button onClick={() => poolAction(pool.name, startPool, 'Start pool')} className="p-1.5 hover:bg-green-600/20 rounded transition"><Play className="w-4 h-4 text-green-400" /></button>}
              {pool.state === 'running' && (
                <>
                  <button onClick={() => poolAction(pool.name, refreshPool, 'Refresh pool')} className="p-1.5 hover:bg-blue-600/20 rounded transition"><RefreshCw className="w-4 h-4 text-blue-400" /></button>
                  <button onClick={() => poolAction(pool.name, stopPool, 'Stop pool')} className="p-1.5 hover:bg-red-600/20 rounded transition"><Square className="w-4 h-4 text-red-400" /></button>
                </>
              )}
              <button onClick={() => showPoolXml(pool.name)} className="p-1.5 hover:bg-blue-600/20 rounded transition" title="View XML"><Code className="w-4 h-4 text-blue-400" /></button>
              <button onClick={() => setDeletePoolTarget(pool.name)} className="p-1.5 hover:bg-red-600/20 rounded transition" title="Delete Pool"><Trash2 className="w-4 h-4 text-red-400" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
