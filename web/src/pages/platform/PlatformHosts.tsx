// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Server, RefreshCw, Wrench } from 'lucide-react'
import ErrorBanner from '../../components/ErrorBanner'
import PlatformEmptyState from '../../components/platform/PlatformEmptyState'
import { MacSectionTitle, MacStatWidget, gradientForName } from '../../components/platform/mac/PlatformMacUi'
import {
  enqueueValidateHost,
  hostMaintenance,
  listPlatformHosts,
  syncAllHosts,
  syncHost,
  type PlatformHost,
} from '../../api/platform'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'

function hostTone(h: PlatformHost): 'ok' | 'warn' | 'default' {
  if (h.state === 'online' && !h.fenced && !h.maintenance_mode) return 'ok'
  if (h.state === 'offline' || h.fenced) return 'warn'
  return 'default'
}

export default function PlatformHosts() {
  const toast = useToastContext()
  const [searchParams] = useSearchParams()
  const filterOffline = searchParams.get('filter') === 'offline'
  const [hosts, setHosts] = useState<PlatformHost[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setHosts(await listPlatformHosts())
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const act = async (id: string, fn: () => Promise<unknown>, label: string) => {
    setBusy(id + label)
    try {
      await fn()
      toast.success(label)
      await load()
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setBusy(null)
    }
  }

  const online = hosts.filter((h) => h.state === 'online').length
  const visibleHosts = filterOffline ? hosts.filter((h) => h.state === 'offline') : hosts

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <MacSectionTitle title="Hosts" subtitle={filterOffline ? 'Showing offline hypervisors only.' : 'KVM hypervisors — like System Information for your cluster.'} />
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={async () => {
            try { await syncAllHosts(); toast.success('Sync all queued') } catch (e: unknown) { toast.error(formatUserError(e)) }
          }}>Sync all</button>
          <button type="button" onClick={() => void load()} className="btn-secondary"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </header>

      {error && <ErrorBanner message={error} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <MacStatWidget label="Hosts" value={String(hosts.length)} icon={<Server className="w-4 h-4" />} tone="default" />
        <MacStatWidget label="Online" value={String(online)} icon={<Server className="w-4 h-4" />} tone={online === hosts.length ? 'ok' : 'warn'} />
        <MacStatWidget label="Total VMs" value={String(hosts.reduce((s, h) => s + h.vm_count, 0))} icon={<Server className="w-4 h-4" />} />
      </div>

      {visibleHosts.length === 0 && !error ? (
        <PlatformEmptyState title={filterOffline ? 'No offline hosts' : 'No hosts enrolled'} subtitle={filterOffline ? 'All hypervisors are reporting heartbeats.' : 'Add a hypervisor to start managing VMs.'}>
          <Link to="/platform/enroll" className="btn-primary inline-block mt-3">Add Host</Link>
        </PlatformEmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleHosts.map((h) => (
            <article key={h.id} className="platform-mac-stat rounded-2xl border border-white/[0.06] bg-slate-900/50 p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientForName(h.hostname)} flex items-center justify-center text-white`}>
                  <Server className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link to={`/platform/hosts/${h.id}`} className="font-semibold text-blue-400 hover:underline truncate block">{h.hostname}</Link>
                  <p className={`text-xs capitalize mt-0.5 ${hostTone(h) === 'ok' ? 'text-emerald-400' : hostTone(h) === 'warn' ? 'text-amber-400' : 'text-slate-500'}`}>
                    {h.maintenance_mode ? 'maintenance' : h.state}{h.fenced ? ' · fenced' : ''}
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div><dt className="text-slate-500">VMs</dt><dd className="text-slate-200 mt-0.5">{h.vm_count}</dd></div>
                <div><dt className="text-slate-500">CPU</dt><dd className="text-slate-200 mt-0.5">{h.cpu_percent != null ? `${h.cpu_percent.toFixed(0)}%` : '—'}</dd></div>
                <div className="col-span-2"><dt className="text-slate-500">Validation</dt><dd className={`mt-0.5 capitalize ${h.validation_status === 'passed' ? 'text-emerald-400' : h.validation_status === 'failed' ? 'text-red-400' : 'text-amber-400'}`}>{h.validation_status || 'pending'}</dd></div>
              </dl>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary text-xs" disabled={busy !== null} onClick={() => void act(h.id, () => enqueueValidateHost(h.id), 'Validation queued')}>Validate</button>
                <button type="button" className="btn-secondary text-xs" disabled={busy !== null} onClick={() => void act(h.id, () => syncHost(h.id), 'Sync queued')}>Sync</button>
                <button type="button" className="btn-secondary text-xs" disabled={busy !== null} onClick={() => void act(h.id, () => hostMaintenance(h.id, 'enter'), 'Maintenance entered')}>
                  <Wrench className="w-3 h-3 inline" /> Maint.
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
