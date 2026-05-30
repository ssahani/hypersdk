// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Lock, Shield, Users } from 'lucide-react'
import ErrorBanner from '../../components/ErrorBanner'
import { MacGlassPanel, MacSectionTitle, MacStatWidget } from '../../components/platform/mac/PlatformMacUi'
import {
  getEnterpriseSecurityOverview,
  getFipsMatrix,
  getMfaCompliance,
  getTenantIsolationOverview,
  listVaultProviders,
  syncAllVaultProviders,
  syncVaultProvider,
  type EnterpriseSecurityOverview,
  type FipsMatrix,
  type MfaComplianceReport,
  type TenantIsolationOverview,
  type VaultProvider,
} from '../../api/platform'
import { formatUserError } from '../../utils/apiError'
import { useToastContext } from '../../contexts/ToastContext'

type TabId = 'vault' | 'mfa' | 'fips' | 'tenants'

export default function PlatformEnterprise() {
  const toast = useToastContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as TabId) || 'vault'
  const setTab = (next: TabId) => setSearchParams(next === 'vault' ? {} : { tab: next })

  const [overview, setOverview] = useState<EnterpriseSecurityOverview | null>(null)
  const [vaults, setVaults] = useState<VaultProvider[]>([])
  const [mfa, setMfa] = useState<MfaComplianceReport | null>(null)
  const [fips, setFips] = useState<FipsMatrix | null>(null)
  const [tenants, setTenants] = useState<TenantIsolationOverview | null>(null)
  const [syncBusy, setSyncBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [ov, v, m, f, t] = await Promise.all([
        getEnterpriseSecurityOverview(),
        listVaultProviders(),
        getMfaCompliance(),
        getFipsMatrix(),
        getTenantIsolationOverview(),
      ])
      setOverview(ov)
      setVaults(v)
      setMfa(m)
      setFips(f)
      setTenants(t)
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const syncAll = async () => {
    setSyncBusy(true)
    try {
      const r = await syncAllVaultProviders()
      toast.success(r.summary)
      await load()
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setSyncBusy(false)
    }
  }

  const syncOne = async (id: string) => {
    try {
      const r = await syncVaultProvider(id)
      toast.success(`${r.provider_name}: ${r.message}`)
      await load()
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    }
  }

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'vault', label: 'Vault sync' },
    { id: 'mfa', label: 'MFA compliance' },
    { id: 'fips', label: 'FIPS matrix' },
    { id: 'tenants', label: 'Tenant isolation' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <MacSectionTitle title="Enterprise Security" subtitle="Vault sync probes, MFA compliance, FIPS crypto matrix, and workspace isolation." />
      {error && <ErrorBanner message={error} />}
      {overview && (
        <p className="text-sm text-slate-400">{overview.summary}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <MacStatWidget label="Vault connected" value={overview ? `${overview.vault_connected}/${overview.vault_providers}` : '—'} icon={<Lock className="w-4 h-4" />} />
        <MacStatWidget label="MFA enrolled" value={overview ? String(overview.mfa_enrolled_users) : '—'} icon={<Shield className="w-4 h-4" />} />
        <MacStatWidget label="Tenant policies" value={overview ? String(overview.tenant_policies) : '—'} icon={<Users className="w-4 h-4" />} />
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`text-xs px-3 py-1.5 rounded-lg ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'vault' && (
        <MacGlassPanel title="Vault providers" action={
          <button type="button" className="text-xs text-blue-400" disabled={syncBusy} onClick={() => void syncAll()}>
            {syncBusy ? 'Syncing…' : 'Sync all'}
          </button>
        }>
          <ul className="space-y-2">
            {vaults.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 border border-slate-700/60 rounded-lg p-3">
                <div>
                  <p className="text-sm text-slate-200">{v.name}</p>
                  <p className="text-xs text-slate-500">{v.provider_type} · {v.status}{v.last_sync_at ? ` · synced ${v.last_sync_at}` : ''}</p>
                </div>
                <button type="button" className="text-xs text-blue-400" onClick={() => void syncOne(v.id)}>Sync</button>
              </li>
            ))}
          </ul>
        </MacGlassPanel>
      )}

      {tab === 'mfa' && mfa && (
        <MacGlassPanel title="MFA compliance">
          <p className="text-sm text-slate-400 mb-3">{mfa.summary}</p>
          {mfa.users.length === 0 ? (
            <p className="text-sm text-slate-500">No roles require MFA yet — enable in Settings → Security.</p>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 border-b border-slate-700">
                <tr>
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Method</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {mfa.users.map((u) => (
                  <tr key={u.username} className="border-b border-slate-800/60">
                    <td className="py-2 pr-4 text-slate-200">{u.username}</td>
                    <td className="py-2 pr-4 text-slate-400">{u.role}</td>
                    <td className="py-2 pr-4 text-slate-400">{u.required_method}</td>
                    <td className={`py-2 text-xs ${u.compliant ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {u.compliant ? 'compliant' : 'needs enrollment'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </MacGlassPanel>
      )}

      {tab === 'fips' && fips && (
        <MacGlassPanel title="FIPS crypto matrix">
          <p className="text-sm text-slate-400 mb-2">{fips.summary}</p>
          <p className="text-xs text-slate-500 mb-4">Runtime: {fips.openssl_version}</p>
          <ul className="space-y-3">
            {fips.profiles.map((p) => (
              <li key={p.id} className="rounded-lg border border-slate-700/60 p-3">
                <p className="text-sm font-medium text-slate-200">{p.name}</p>
                <p className="text-xs text-slate-500 mt-1">TLS {p.tls_min_version} · FIPS {p.fips_mode}</p>
                <p className="text-xs text-slate-500">{p.cipher_suites}</p>
                <p className="text-xs text-slate-600 mt-1">{p.notes}</p>
              </li>
            ))}
          </ul>
        </MacGlassPanel>
      )}

      {tab === 'tenants' && tenants && (
        <MacGlassPanel title="Workspace isolation">
          <p className="text-sm text-slate-400 mb-3">{tenants.summary}</p>
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 border-b border-slate-700">
              <tr>
                <th className="py-2 pr-4">Project</th>
                <th className="py-2 pr-4">VMs</th>
                <th className="py-2 pr-4">Network</th>
                <th className="py-2 pr-4">Quotas</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {tenants.projects.map((p) => (
                <tr key={p.project_name} className="border-b border-slate-800/60">
                  <td className="py-2 pr-4 text-slate-200">{p.project_name}</td>
                  <td className="py-2 pr-4 text-slate-400">{p.vm_count}{p.max_vms > 0 ? ` / ${p.max_vms}` : ''}</td>
                  <td className="py-2 pr-4 text-slate-400">{p.network_isolation}</td>
                  <td className="py-2 pr-4 text-slate-400">{p.enforce_quotas ? 'enforced' : 'off'}</td>
                  <td className={`py-2 text-xs ${p.quota_status.includes('exceeded') ? 'text-rose-400' : 'text-emerald-400'}`}>{p.quota_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </MacGlassPanel>
      )}
    </div>
  )
}
