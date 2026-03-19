import { useEffect, useState, useCallback } from 'react'
import { listAllSnapshots, deleteSnapshot, revertSnapshot, SnapshotInfo } from '../api/snapshot'
import { useToastContext } from '../contexts/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { Trash2, RotateCcw, RefreshCw, Camera } from 'lucide-react'

export default function SnapshotsPage() {
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<SnapshotInfo | null>(null)
  const toast = useToastContext()

  const load = useCallback(async () => {
    try { setSnapshots(await listAllSnapshots()) } catch (e: unknown) { toast.error(`${e}`) } finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  const handleRevert = async (snap: SnapshotInfo) => {
    try { await revertSnapshot(snap.vm_name, snap.name); toast.success(`Reverted '${snap.vm_name}' to '${snap.name}'`); load() } catch (e: unknown) { toast.error(`${e}`) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try { await deleteSnapshot(deleteTarget.vm_name, deleteTarget.name); toast.success(`Deleted snapshot '${deleteTarget.name}'`); load() } catch (e: unknown) { toast.error(`${e}`) }
    setDeleteTarget(null)
  }

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Camera className="w-6 h-6" /> Snapshots</h1>
        <button onClick={load} className="p-2 hover:bg-gray-700 rounded transition"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {snapshots.length === 0 ? <div className="p-8 text-center text-gray-500">No snapshots across any VM.</div> : (
          <table className="w-full">
            <thead><tr className="border-b border-gray-700 text-left text-sm text-gray-400"><th className="px-6 py-3">Snapshot</th><th className="px-6 py-3">VM</th><th className="px-6 py-3">State</th><th className="px-6 py-3 hidden md:table-cell">Created</th><th className="px-6 py-3">Current</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-700">
              {snapshots.map((s) => (
                <tr key={`${s.vm_name}/${s.name}`} className="hover:bg-gray-700/50">
                  <td className="px-6 py-3 font-medium">{s.name}</td>
                  <td className="px-6 py-3 text-sm text-blue-400">{s.vm_name}</td>
                  <td className="px-6 py-3 text-sm text-gray-400">{s.state}</td>
                  <td className="px-6 py-3 text-sm text-gray-400 hidden md:table-cell">{s.creation_time ? new Date(s.creation_time * 1000).toLocaleString() : '-'}</td>
                  <td className="px-6 py-3">{s.is_current && <span className="text-green-400 text-xs font-medium">● Current</span>}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleRevert(s)} className="p-1.5 hover:bg-blue-600/20 rounded transition" title="Revert"><RotateCcw className="w-4 h-4 text-blue-400" /></button>
                      <button onClick={() => setDeleteTarget(s)} className="p-1.5 hover:bg-red-600/20 rounded transition" title="Delete"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <ConfirmDialog open={!!deleteTarget} title="Delete Snapshot" message={`Delete snapshot '${deleteTarget?.name}' from VM '${deleteTarget?.vm_name}'?`} confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  )
}
