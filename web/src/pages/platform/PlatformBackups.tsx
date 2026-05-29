// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Archive, Clock, RotateCcw } from 'lucide-react'
import { MacGlassPanel, MacSectionTitle } from '../../components/platform/mac/PlatformMacUi'
import ErrorBanner from '../../components/ErrorBanner'
import { listBackupTimeline, restoreVmBackup, type BackupTimelineEntry } from '../../api/platform'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'

export default function PlatformBackups() {
  const toast = useToastContext()
  const [timeline, setTimeline] = useState<BackupTimelineEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setTimeline(await listBackupTimeline())
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [])

  useEffect(() => { void load() }, [load])

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
    <div className="space-y-6 max-w-3xl animate-fade-in">
      <MacSectionTitle title="Backups" subtitle="Time Machine-style timeline — restore with confidence." />
      {error && <ErrorBanner message={error} />}
      <div className="space-y-3">
        {timeline.length === 0 && !error && (
          <p className="text-sm text-slate-500">No backup or snapshot events yet. Create backups from VM detail pages.</p>
        )}
        {timeline.map((e) => (
          <article key={`${e.kind}-${e.id}`} className="platform-mac-stat rounded-2xl border border-white/[0.06] bg-slate-900/50 p-4 flex gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${e.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
              <Archive className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {new Date(e.created_at).toLocaleString()}
                <span className="text-slate-600">· {e.kind}</span>
              </p>
              <p className="text-sm font-medium text-slate-200 mt-0.5">{e.label}</p>
              <Link to={`/platform/vms/${e.vm_id}${e.kind === 'snapshot' ? '' : ''}`} className="text-xs text-blue-400 hover:underline">{e.vm_name}</Link>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              {e.kind === 'backup' && e.status === 'completed' && (
                <button
                  type="button"
                  className="btn-primary text-xs flex items-center gap-1"
                  disabled={restoring === e.id}
                  onClick={() => void restore(e)}
                >
                  <RotateCcw className="w-3 h-3" /> {restoring === e.id ? 'Queuing…' : 'Restore'}
                </button>
              )}
              {e.kind === 'snapshot' && (
                <Link to={`/platform/vms/${e.vm_id}`} className="btn-secondary text-xs text-center">Snapshots</Link>
              )}
            </div>
          </article>
        ))}
      </div>
      <MacGlassPanel title="Per-VM backups" subtitle="Full backup history and restore live on each VM detail page.">
        <Link to="/platform/vms" className="text-sm text-blue-400 hover:underline">Browse VMs →</Link>
      </MacGlassPanel>
    </div>
  )
}
