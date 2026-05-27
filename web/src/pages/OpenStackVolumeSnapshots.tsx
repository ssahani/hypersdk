// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  createOpenStackVolumeFromSnapshot,
  deleteOpenStackVolumeSnapshot,
  getOpenStackVolumeSnapshot,
  listOpenStackVolumeSnapshots,
  type OpenStackVolumeSnapshot,
} from '../api/openstackExtras'
import OpenStackGate from '../components/OpenStackGate'
import OpenStackSubNav from '../components/OpenStackSubNav'
import OpenStackFooter from '../components/OpenStackFooter'
import { useToastContext } from '../contexts/ToastContext'
import { formatUserError } from '../utils/apiError'
import { Camera, Loader2, RefreshCw } from 'lucide-react'

export default function OpenStackVolumeSnapshotsPage() {
  return (
    <OpenStackGate title="Volume snapshots">
      <OpenStackVolumeSnapshotsContent />
    </OpenStackGate>
  )
}

function OpenStackVolumeSnapshotsContent() {
  const toast = useToastContext()
  const [snapshots, setSnapshots] = useState<OpenStackVolumeSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<OpenStackVolumeSnapshot | null>(null)
  const [restoreName, setRestoreName] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { snapshots: list } = await listOpenStackVolumeSnapshots()
      setSnapshots(list)
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-6 max-w-4xl">
      <OpenStackSubNav />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Camera className="w-7 h-7 text-sky-400" />
          Cinder volume snapshots
        </h1>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-600 text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>
      {loading ? (
        <Loader2 className="w-8 h-8 animate-spin text-sky-400 mx-auto" />
      ) : (
        <div className="rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 text-slate-400 text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Volume</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-xs">
              {snapshots.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 text-slate-200">{s.name || s.id.slice(0, 8)}</td>
                  <td className="px-3 py-2">
                    <Link to={`/openstack/volumes/${s.volume_id}`} className="text-sky-400 hover:underline">{s.volume_id.slice(0, 8)}</Link>
                  </td>
                  <td className="px-3 py-2">{s.size_gb} GB</td>
                  <td className="px-3 py-2 text-slate-400">{s.status}</td>
                  <td className="px-3 py-2 flex flex-wrap gap-2">
                    <button type="button" className="text-violet-400 hover:underline" onClick={async () => {
                      try {
                        const { snapshot } = await getOpenStackVolumeSnapshot(s.id)
                        setDetail(snapshot)
                        setRestoreName(`${snapshot.name || 'vol'}-restored`)
                      } catch (e: unknown) { toast.error(formatUserError(e)) }
                    }}>Detail</button>
                    <button type="button" className="text-sky-400 hover:underline" onClick={async () => {
                      const n = prompt('New volume name', `${s.name || 'vol'}-restored`)
                      if (!n) return
                      try {
                        await createOpenStackVolumeFromSnapshot({ snapshot_id: s.id, name: n })
                        toast.success('Volume created from snapshot')
                      } catch (e: unknown) { toast.error(formatUserError(e)) }
                    }}>Restore</button>
                    <button type="button" className="text-red-400 hover:underline" onClick={async () => {
                      if (!confirm(`Delete snapshot ${s.name || s.id}?`)) return
                      try {
                        await deleteOpenStackVolumeSnapshot(s.id)
                        toast.success('Deleted')
                        void load()
                      } catch (e: unknown) { toast.error(formatUserError(e)) }
                    }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {snapshots.length === 0 && <p className="p-6 text-center text-slate-500">No snapshots.</p>}
        </div>
      )}
      {detail && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-4 text-sm space-y-3">
          <p className="font-mono text-slate-200">{detail.name} · {detail.status}</p>
          <p className="text-xs text-slate-400">id {detail.id} · volume {detail.volume_id}</p>
          <div className="flex gap-2 items-end">
            <input value={restoreName} onChange={(e) => setRestoreName(e.target.value)} placeholder="Volume name"
              className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm" />
            <button type="button" className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-sm"
              onClick={async () => {
                try {
                  await createOpenStackVolumeFromSnapshot({ snapshot_id: detail.id, name: restoreName.trim() || undefined })
                  toast.success('Volume created')
                  setDetail(null)
                } catch (e: unknown) { toast.error(formatUserError(e)) }
              }}>Create volume</button>
          </div>
          <button type="button" className="text-xs text-slate-400 hover:underline" onClick={() => setDetail(null)}>Dismiss</button>
        </div>
      )}
      <OpenStackFooter />
    </div>
  )
}
