// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Camera, Plus, Trash2 } from 'lucide-react'
import PlatformPageChrome, { PlatformBackLink } from '../../components/platform/PlatformPageChrome'
import { MacGlassPanel, MacListRow } from '../../components/platform/mac/PlatformMacUi'
import {
  createFleetSnapshotSchedule,
  deleteFleetSnapshotSchedule,
  listFleetSnapshotSchedules,
  type FleetSnapshotSchedule,
} from '../../api/platformFleetSnapshots'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'

export default function PlatformFleetSnapshots() {
  const toast = useToastContext()
  const [rows, setRows] = useState<FleetSnapshotSchedule[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('nightly-fleet')
  const [project, setProject] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [diskOnly, setDiskOnly] = useState(true)
  const [quiesce, setQuiesce] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      setRows(await listFleetSnapshotSchedules())
    } catch (e: unknown) {
      setError(formatUserError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const add = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await createFleetSnapshotSchedule({
        name: name.trim(),
        project: project.trim() || undefined,
        tag_filter: tagFilter.trim() || undefined,
        disk_only: diskOnly,
        quiesce,
      })
      toast.success('Fleet snapshot schedule created')
      await load()
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm('Delete this schedule?')) return
    try {
      await deleteFleetSnapshotSchedule(id)
      toast.success('Schedule deleted')
      await load()
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    }
  }

  return (
    <PlatformPageChrome
      error={error}
      onErrorRetry={() => void load()}
      prepend={<PlatformBackLink to="/platform/operations" label="Operations" />}
      title="Fleet snapshot schedules"
      subtitle="Nightly disk snapshots across managed libvirt VMs (project or tag filter)."
      icon={<Camera className="w-6 h-6 text-slate-400" />}
      loading={loading && rows.length === 0}
      contentClassName="space-y-4"
    >
      <MacGlassPanel title="New schedule">
        <div className="grid gap-3 md:grid-cols-2 max-w-2xl">
          <input className="input text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input text-sm" placeholder="Project (optional)" value={project} onChange={(e) => setProject(e.target.value)} />
          <input className="input text-sm md:col-span-2" placeholder="Tag filter (optional)" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={diskOnly} onChange={(e) => setDiskOnly(e.target.checked)} /> Disk-only snapshot
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={quiesce} onChange={(e) => setQuiesce(e.target.checked)} /> Guest quiesce (app-consistent)
          </label>
        </div>
        <button type="button" className="btn-primary text-sm mt-3 flex items-center gap-1.5" disabled={saving} onClick={() => void add()}>
          <Plus className="w-4 h-4" /> {saving ? 'Saving…' : 'Add schedule'}
        </button>
        <p className="text-xs text-slate-500 mt-2">Runs about once per 23h per schedule. Set MACHINA_TEMPLATES_GIT_DIR for template git sync separately.</p>
      </MacGlassPanel>

      <MacGlassPanel title="Active schedules" subtitle={loading ? 'Loading…' : `${rows.length} schedule(s)`}>
        {rows.length === 0 && !loading ? (
          <p className="text-sm text-slate-500">No fleet schedules yet.</p>
        ) : (
          <ul className="divide-y divide-white/[0.04] -mx-1">
            {rows.map((s) => (
              <MacListRow
                key={s.id}
                title={s.name}
                subtitle={`${s.project || 'all projects'} · tag=${s.tag_filter || '*'} · disk_only=${s.disk_only} · quiesce=${s.quiesce}`}
                badge={
                  <button type="button" className="btn-secondary text-xs p-1.5" aria-label="Delete" onClick={() => void remove(s.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                }
              />
            ))}
          </ul>
        )}
      </MacGlassPanel>
    </PlatformPageChrome>
  )
}
