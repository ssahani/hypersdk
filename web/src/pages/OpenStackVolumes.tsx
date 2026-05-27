// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import {
  createOpenStackVolume,
  deleteOpenStackVolume,
  listOpenStackCinderVolumes,
  type OpenStackAttachedVolume,
} from '../api/openstack'
import { extendOpenStackVolume, listOpenStackVolumeTypes, snapshotOpenStackVolume } from '../api/openstackExtras'
import OpenStackGate from '../components/OpenStackGate'
import OpenStackSubNav from '../components/OpenStackSubNav'
import OpenStackFooter from '../components/OpenStackFooter'
import { useToastContext } from '../contexts/ToastContext'
import { formatUserError } from '../utils/apiError'
import { HardDrive, Loader2, RefreshCw } from 'lucide-react'

export default function OpenStackVolumesPage() {
  return (
    <OpenStackGate title="Cinder volumes">
      <OpenStackVolumesContent />
    </OpenStackGate>
  )
}

function OpenStackVolumesContent() {
  const toast = useToastContext()
  const [volumes, setVolumes] = useState<OpenStackAttachedVolume[]>([])
  const [loading, setLoading] = useState(true)
  const [sizeGb, setSizeGb] = useState('10')
  const [name, setName] = useState('')
  const [volumeType, setVolumeType] = useState('')
  const [types, setTypes] = useState<{ id: string; name: string }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [v, t] = await Promise.all([
        listOpenStackCinderVolumes(),
        listOpenStackVolumeTypes().catch(() => ({ volume_types: [] })),
      ])
      setVolumes(v.volumes)
      setTypes(t.volume_types.map((x) => ({ id: x.id, name: x.name })))
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async () => {
    const size = Number.parseInt(sizeGb, 10)
    if (!Number.isFinite(size) || size < 1) {
      toast.warning('Enter valid size in GB')
      return
    }
    try {
      await createOpenStackVolume({
        size_gb: size,
        name: name.trim() || undefined,
        volume_type: volumeType || undefined,
      })
      toast.success('Volume created')
      void load()
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <OpenStackSubNav />
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <HardDrive className="w-7 h-7 text-sky-400" />
        Cinder volumes
      </h1>
      <div className="rounded-xl border border-slate-700 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Size (GB)</label>
          <input type="number" min={1} value={sizeGb} onChange={(e) => setSizeGb(e.target.value)}
            className="w-24 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Type</label>
          <select value={volumeType} onChange={(e) => setVolumeType(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm">
            <option value="">Default</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={() => void handleCreate()}
          className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-sm text-white">
          Create volume
        </button>
        <button type="button" onClick={() => void load()}
          className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-600 text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>
      {loading ? (
        <Loader2 className="w-8 h-8 animate-spin text-sky-400 mx-auto" />
      ) : (
        <div className="rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {volumes.map((v) => (
                <tr key={v.id}>
                  <td className="px-3 py-2 font-mono text-slate-200">{v.name || v.id.slice(0, 8)}</td>
                  <td className="px-3 py-2">{v.size_gb} GB</td>
                  <td className="px-3 py-2 flex flex-wrap gap-2">
                    <button type="button" className="text-xs text-sky-400 hover:underline"
                      onClick={async () => {
                        const n = prompt('Snapshot name', `${v.name || 'vol'}-snap`)
                        if (!n) return
                        try {
                          await snapshotOpenStackVolume(v.id, n)
                          toast.success('Snapshot requested')
                        } catch (e: unknown) {
                          toast.error(formatUserError(e))
                        }
                      }}>Snapshot</button>
                    <button type="button" className="text-xs text-amber-400 hover:underline"
                      onClick={async () => {
                        const n = prompt('New size (GB)', String(v.size_gb + 1))
                        if (!n) return
                        try {
                          await extendOpenStackVolume(v.id, Number.parseInt(n, 10))
                          toast.success('Extended')
                          void load()
                        } catch (e: unknown) {
                          toast.error(formatUserError(e))
                        }
                      }}>Extend</button>
                    <button type="button" className="text-xs text-red-400 hover:underline"
                      onClick={async () => {
                        if (!confirm(`Delete volume ${v.name || v.id}?`)) return
                        try {
                          await deleteOpenStackVolume(v.id)
                          toast.success('Deleted')
                          void load()
                        } catch (e: unknown) {
                          toast.error(formatUserError(e))
                        }
                      }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {volumes.length === 0 && (
            <p className="p-6 text-center text-slate-500 text-sm">No volumes in this project.</p>
          )}
        </div>
      )}
      <OpenStackFooter />
    </div>
  )
}
