// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Archive, Clock, RotateCcw } from 'lucide-react'
import { MacGlassPanel } from '../../components/platform/mac/PlatformMacUi'
import PlatformStandardView from '../../components/platform/tahoe/PlatformStandardView'
import PlatformEmptyState from '../../components/platform/PlatformEmptyState'
import {
  getFleetBackups,
  listBackupTimeline,
  restoreVmBackup,
  type BackupTimelineEntry,
  type FleetBackupOverview,
} from '../../api/platform'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'

function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = (start.getTime() - day.getTime()) / 86_400_000
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function PlatformBackups() {
  const toast = useToastContext()
  const [timeline, setTimeline] = useState<BackupTimelineEntry[]>([])
  const [fleet, setFleet] = useState<FleetBackupOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [t, f] = await Promise.all([listBackupTimeline(), getFleetBackups()])
      setTimeline(t)
      setFleet(f)
    } catch (e: unknown) {
      setError(formatUserError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const grouped = useMemo(() => {
    const map = new Map<string, BackupTimelineEntry[]>()
    for (const e of timeline) {
      const key = dayLabel(e.created_at)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return [...map.entries()]
  }, [timeline])

  const restore = async (entry: BackupTimelineEntry) => {
    if (entry.kind !== 'backup' || entry.status !== 'completed') return
    setRestoring(entry.id)
    try {
      await restoreVmBackup(entry.vm_id, entry.id)
      toast.success(`Restore queued for ${entry.vm_name}`)
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setRestoring(null)
    }
  }

  return (
    <PlatformStandardView
      className="space-y-6 max-w-3xl"
      title="Time Machine"
      description="Fleet backup timeline — macOS-style restore points for every VM."
      icon={Archive}
      loading={loading}
      error={error}
      stats={
        fleet
          ? [
              { label: 'Today', value: String(fleet.backups_completed_24h), tone: 'emerald' },
              { label: 'Failed 24h', value: String(fleet.backups_failed_24h), tone: fleet.backups_failed_24h ? 'amber' : 'sky' },
              { label: 'Snapshots', value: String(fleet.snapshots_total), tone: 'violet' },
              { label: 'Protected 7d', value: String(fleet.vms_with_backup_7d), tone: 'emerald' },
            ]
          : undefined
      }
    >
      <p className="text-sm text-slate-500">
        Need per-VM legacy jobs? <Link to="/backups" className="text-blue-400">Open classic backups UI →</Link>
      </p>
      {fleet?.summary ? <p className="text-sm text-slate-400">{fleet.summary}</p> : null}
      <div className="space-y-6">
        {grouped.length === 0 && !error && (
          <PlatformEmptyState
            icon={Archive}
            title="No backup events yet"
            subtitle="Create backups from VM detail pages or run fleet backup jobs."
          >
            <Link to="/platform/vms" className="tahoe-btn-ghost text-sm">Browse VMs</Link>
          </PlatformEmptyState>
        )}
        {grouped.map(([day, entries]) => (
          <section key={day}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">{day}</h2>
            <div className="relative pl-4 border-l border-slate-700/60 space-y-3">
              {entries.map((e) => (
                <article key={`${e.kind}-${e.id}`} className="relative tahoe-glass-card p-4 flex gap-4">
                  <span className="absolute -left-[1.35rem] top-5 w-2.5 h-2.5 rounded-full bg-slate-600 border-2 border-slate-900" />
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${e.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                    <Archive className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {new Date(e.created_at).toLocaleTimeString()}
                      <span className="text-slate-600">· {e.kind}</span>
                    </p>
                    <p className="text-sm font-medium text-slate-200 mt-0.5">{e.label}</p>
                    <Link to={`/platform/vms/${e.vm_id}`} className="text-xs text-blue-400 hover:underline">{e.vm_name}</Link>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {e.kind === 'backup' && e.status === 'completed' && (
                      <button
                        type="button"
                        className="tahoe-btn-primary text-xs flex items-center gap-1"
                        disabled={restoring === e.id}
                        onClick={() => void restore(e)}
                      >
                        <RotateCcw className="w-3 h-3" /> {restoring === e.id ? 'Queuing…' : 'Restore'}
                      </button>
                    )}
                    {e.kind === 'snapshot' && (
                      <Link to={`/platform/vms/${e.vm_id}`} className="tahoe-btn-ghost text-xs text-center">Snapshots</Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      <MacGlassPanel title="Per-VM backups" subtitle="Full backup history and restore live on each VM detail page.">
        <Link to="/platform/vms" className="text-sm text-blue-400 hover:underline">Browse VMs →</Link>
      </MacGlassPanel>
    </PlatformStandardView>
  )
}
