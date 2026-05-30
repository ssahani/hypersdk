// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Clock, HardDrive, Layers, Loader2, Plus, RefreshCw, Shield } from 'lucide-react'
import ErrorBanner from '../../components/ErrorBanner'
import PlatformEmptyState from '../../components/platform/PlatformEmptyState'
import {
  MacGlassPanel,
  MacSectionTitle,
  MacSheet,
  MacStatWidget,
  gradientForName,
} from '../../components/platform/mac/PlatformMacUi'
import {
  bindStoragePoolTier,
  createStoragePool,
  deleteStoragePool,
  discoverStoragePools,
  getStorageBackupSla,
  getStorageTiersOverview,
  listPlatformHosts,
  listStoragePools,
  syncAllHosts,
  type StorageBackupSla,
  type StoragePool,
  type StorageTierOverview,
} from '../../api/platform'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'

type TabId = 'pools' | 'tiers' | 'sla'

function capacityRing(used: number, cap: number) {
  if (cap <= 0) return 0
  return Math.min(100, Math.round((used / cap) * 100))
}

export default function PlatformStorage() {
  const toast = useToastContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as TabId) || 'pools'

  const [rows, setRows] = useState<StoragePool[]>([])
  const [tiers, setTiers] = useState<StorageTierOverview[]>([])
  const [slaPolicies, setSlaPolicies] = useState<StorageBackupSla[]>([])
  const [hostCount, setHostCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [discovering, setDiscovering] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [name, setName] = useState('datastore-01')
  const [path, setPath] = useState('/var/lib/libvirt/images')
  const [creating, setCreating] = useState(false)
  const [bindDraft, setBindDraft] = useState<Record<string, string>>({})
  const [binding, setBinding] = useState<string | null>(null)

  const setTab = (next: TabId) => {
    setSearchParams(next === 'pools' ? {} : { tab: next })
  }

  const tierName = (id?: string | null) => tiers.find((t) => t.id === id)?.name ?? null

  const load = useCallback(async (autoDiscover = false) => {
    setError(null)
    try {
      const [pools, hosts, tierOverview, sla] = await Promise.all([
        listStoragePools(),
        listPlatformHosts(),
        getStorageTiersOverview().catch(() => ({ tiers: [], summary: '' })),
        getStorageBackupSla().catch(() => ({ policies: [], summary: '' })),
      ])
      setTiers(tierOverview.tiers)
      setSlaPolicies(sla.policies)
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
      await load(false)
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setDiscovering(false)
    }
  }

  const bindTier = async (poolId: string, tierId: string) => {
    setBinding(poolId)
    try {
      await bindStoragePoolTier(poolId, tierId)
      toast.success('Pool assigned to tier')
      await load(false)
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setBinding(null)
    }
  }

  const totalCap = rows.reduce((s, p) => s + p.capacity_gib, 0)
  const totalUsed = rows.reduce((s, p) => s + p.used_gib, 0)

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <MacSectionTitle title="Storage" subtitle="vSAN-class tiers, snapshot retention, and backup SLA stubs." />
        <div className="flex flex-wrap gap-2">
          {tab === 'pools' && (
            <>
              <button type="button" className="btn-secondary text-sm" disabled={discovering} onClick={() => void runDiscover()}>
                {discovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Import from hosts
              </button>
              <button type="button" className="btn-secondary text-sm" disabled={discovering} onClick={async () => {
                try { await syncAllHosts(); toast.success('Host sync queued') } catch (e: unknown) { toast.error(formatUserError(e)) }
              }}>Sync hosts</button>
              <button type="button" className="btn-primary flex items-center gap-2" onClick={() => setSheetOpen(true)}><Plus className="w-4 h-4" /> Add pool</button>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-white/[0.06] pb-1">
        {([
          ['pools', 'Pools', HardDrive],
          ['tiers', 'Tiers', Layers],
          ['sla', 'Backup SLA', Shield],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm rounded-t-lg flex items-center gap-2 transition ${
              tab === id ? 'bg-slate-800/80 text-orange-300 border-b-2 border-orange-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <MacStatWidget label="Pools" value={String(rows.length)} icon={<HardDrive className="w-4 h-4" />} />
        <MacStatWidget label="Tiers" value={String(tiers.length)} icon={<Layers className="w-4 h-4" />} />
        <MacStatWidget label="Used / capacity" value={totalCap > 0 ? `${totalUsed}/${totalCap} GiB` : '—'} icon={<Clock className="w-4 h-4" />} />
      </div>

      {tab === 'pools' && (
        <>
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
                        <p className="text-xs text-violet-300/80 mt-0.5">{tierName(p.tier_id) ?? 'No tier'}</p>
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
                    {tiers.length > 0 && (
                      <div className="flex gap-2">
                        <select
                          className="input text-xs flex-1"
                          value={bindDraft[p.id] ?? p.tier_id ?? ''}
                          onChange={(e) => setBindDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                        >
                          <option value="">Select tier…</option>
                          {tiers.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          disabled={binding === p.id || !(bindDraft[p.id] ?? p.tier_id)}
                          onClick={() => {
                            const tid = bindDraft[p.id] ?? p.tier_id
                            if (tid) void bindTier(p.id, tid)
                          }}
                        >
                          Bind
                        </button>
                      </div>
                    )}
                    <button type="button" className="btn-danger text-xs w-full" onClick={async () => {
                      try { await deleteStoragePool(p.id); toast.success('Deleted'); await load(false) } catch (e: unknown) { toast.error(formatUserError(e)) }
                    }}>Remove from inventory</button>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}

      {tab === 'tiers' && (
        <MacGlassPanel title="Storage tiers" subtitle="Gold / silver / bronze taxonomy with IOPS and replication stubs.">
          {tiers.length === 0 ? (
            <p className="text-sm text-slate-400">No tiers — run migration 028 to seed defaults.</p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-white/[0.06]">
                    <th className="py-2 px-2">Name</th>
                    <th className="py-2 px-2">Class</th>
                    <th className="py-2 px-2">IOPS</th>
                    <th className="py-2 px-2">Replication</th>
                    <th className="py-2 px-2">Snapshots</th>
                    <th className="py-2 px-2">RPO</th>
                    <th className="py-2 px-2">Pools</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((t) => (
                    <tr key={t.id} className="border-b border-white/[0.04] text-slate-200">
                      <td className="py-2.5 px-2 font-medium">{t.name}</td>
                      <td className="py-2.5 px-2 capitalize">{t.tier_class}</td>
                      <td className="py-2.5 px-2">{t.iops_tier}</td>
                      <td className="py-2.5 px-2">{t.replication}</td>
                      <td className="py-2.5 px-2">{t.snapshot_retention_days}d</td>
                      <td className="py-2.5 px-2">{t.backup_rpo_hours}h</td>
                      <td className="py-2.5 px-2">{t.pool_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </MacGlassPanel>
      )}

      {tab === 'sla' && (
        <MacGlassPanel title="Backup SLA" subtitle="Per-pool RPO/RTO compliance grades (simulated).">
          {slaPolicies.length === 0 ? (
            <p className="text-sm text-slate-400">No SLA policies — import pools first.</p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-white/[0.06]">
                    <th className="py-2 px-2">Pool</th>
                    <th className="py-2 px-2">Tier</th>
                    <th className="py-2 px-2">RPO</th>
                    <th className="py-2 px-2">RTO</th>
                    <th className="py-2 px-2">Retention</th>
                    <th className="py-2 px-2">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {slaPolicies.map((s) => (
                    <tr key={s.id} className="border-b border-white/[0.04] text-slate-200">
                      <td className="py-2.5 px-2">{s.pool_name}</td>
                      <td className="py-2.5 px-2">{s.tier_name ?? '—'}</td>
                      <td className="py-2.5 px-2">{s.rpo_hours}h</td>
                      <td className="py-2.5 px-2">{s.rto_hours}h</td>
                      <td className="py-2.5 px-2">{s.retention_days}d</td>
                      <td className="py-2.5 px-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          s.compliance_grade === 'A' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'
                        }`}>{s.compliance_grade}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </MacGlassPanel>
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
              await load(false)
            } catch (e: unknown) { toast.error(formatUserError(e)) }
            finally { setCreating(false) }
          }}>{creating ? 'Adding…' : 'Add pool'}</button>
        </div>
      </MacSheet>
    </div>
  )
}
