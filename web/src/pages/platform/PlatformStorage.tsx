// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { HardDrive, Loader2, Plus, RefreshCw } from 'lucide-react'
import ErrorBanner from '../../components/ErrorBanner'
import PlatformEmptyState from '../../components/platform/PlatformEmptyState'
import {
  MacSectionTitle,
  MacSheet,
  MacStatWidget,
  gradientForName,
} from '../../components/platform/mac/PlatformMacUi'
import {
  createStoragePool,
  deleteStoragePool,
  discoverStoragePools,
  listPlatformHosts,
  listStoragePools,
  syncAllHosts,
  type StoragePool,
} from '../../api/platform'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'

function capacityRing(used: number, cap: number) {
  if (cap <= 0) return 0
  return Math.min(100, Math.round((used / cap) * 100))
}

export default function PlatformStorage() {
  const toast = useToastContext()
  const [rows, setRows] = useState<StoragePool[]>([])
  const [hostCount, setHostCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [discovering, setDiscovering] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [name, setName] = useState('datastore-01')
  const [path, setPath] = useState('/var/lib/libvirt/images')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async (autoDiscover = false) => {
    setError(null)
    try {
      const [pools, hosts] = await Promise.all([listStoragePools(), listPlatformHosts()])
      setHostCount(hosts.filter((h) => h.state === 'online').length)
      if (pools.length === 0 && autoDiscover && hosts.some((h) => h.state === 'online')) {
        setDiscovering(true)
        try {
          const r = await discoverStoragePools()
          setRows(r.pools)
          if (r.pools.length > 0) {
            toast.success(`Imported ${r.pools.length} storage pool(s) from libvirt`)
          }
        } catch (e: unknown) {
          setError(formatUserError(e))
        } finally {
          setDiscovering(false)
        }
      } else {
        setRows(pools)
      }
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [toast])

  useEffect(() => { void load(true) }, [load])

  const runDiscover = async () => {
    setDiscovering(true)
    setError(null)
    try {
      const r = await discoverStoragePools()
      setRows(r.pools)
      toast.success(r.pools.length ? `Found ${r.pools.length} pool(s)` : 'No libvirt pools on online hosts')
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setDiscovering(false)
    }
  }

  const totalCap = rows.reduce((s, p) => s + p.capacity_gib, 0)
  const totalUsed = rows.reduce((s, p) => s + p.used_gib, 0)

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <MacSectionTitle title="Storage" subtitle="Disk pools from libvirt — capacity at a glance." />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-sm" disabled={discovering} onClick={() => void runDiscover()}>
            {discovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Import from hosts
          </button>
          <button type="button" className="btn-secondary text-sm" disabled={discovering} onClick={async () => {
            try { await syncAllHosts(); toast.success('Host sync queued') } catch (e: unknown) { toast.error(formatUserError(e)) }
          }}>Sync hosts</button>
          <button type="button" className="btn-primary flex items-center gap-2" onClick={() => setSheetOpen(true)}><Plus className="w-4 h-4" /> Add pool</button>
        </div>
      </header>

      {error && <ErrorBanner message={error} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <MacStatWidget label="Pools" value={String(rows.length)} icon={<HardDrive className="w-4 h-4" />} />
        <MacStatWidget label="Online hosts" value={String(hostCount)} tone={hostCount > 0 ? 'ok' : 'warn'} icon={<HardDrive className="w-4 h-4" />} />
        <MacStatWidget label="Used / capacity" value={totalCap > 0 ? `${totalUsed}/${totalCap} GiB` : '—'} icon={<HardDrive className="w-4 h-4" />} />
      </div>

      {rows.length === 0 && !error ? (
        <PlatformEmptyState title="No storage pools" subtitle="Import libvirt pools from your KVM hosts, or add one manually.">
          <button type="button" className="btn-primary mt-3" disabled={discovering} onClick={() => void runDiscover()}>
            {discovering ? 'Importing…' : 'Import from hosts'}
          </button>
        </PlatformEmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => {
            const pct = capacityRing(p.used_gib, p.capacity_gib)
            return (
              <article key={p.id} className="platform-mac-stat rounded-2xl border border-white/[0.06] bg-slate-900/50 p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientForName(p.name)} flex items-center justify-center text-white`}>
                    <HardDrive className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{p.storage_class} · {p.backend}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative w-14 h-14 shrink-0">
                    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-800" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${pct} 100`} className={pct > 85 ? 'text-amber-400' : 'text-blue-400'} />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">{pct}%</span>
                  </div>
                  <dl className="text-xs space-y-1 flex-1">
                    <div><dt className="text-slate-500 inline">Used </dt><dd className="inline text-slate-200">{p.used_gib} GiB</dd></div>
                    <div><dt className="text-slate-500 inline">Capacity </dt><dd className="inline text-slate-200">{p.capacity_gib || '—'} GiB</dd></div>
                    {p.path && <div className="text-slate-500 truncate" title={p.path}>{p.path}</div>}
                  </dl>
                </div>
                <button type="button" className="btn-danger text-xs w-full" onClick={async () => {
                  try { await deleteStoragePool(p.id); toast.success('Deleted'); await load() } catch (e: unknown) { toast.error(formatUserError(e)) }
                }}>Remove from inventory</button>
              </article>
            )
          })}
        </div>
      )}

      <MacSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Add storage pool">
        <div className="space-y-4">
          <label className="block text-sm"><span className="text-slate-400">Name</span><input className="input mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="block text-sm"><span className="text-slate-400">Path on host</span><input className="input mt-1 w-full" value={path} onChange={(e) => setPath(e.target.value)} /></label>
          <button type="button" className="btn-primary w-full" disabled={creating} onClick={async () => {
            setCreating(true)
            try {
              await createStoragePool({ name, path, storage_class: 'silver' })
              toast.success('Pool added')
              setSheetOpen(false)
              await load()
            } catch (e: unknown) { toast.error(formatUserError(e)) }
            finally { setCreating(false) }
          }}>{creating ? 'Adding…' : 'Add pool'}</button>
        </div>
      </MacSheet>
    </div>
  )
}
