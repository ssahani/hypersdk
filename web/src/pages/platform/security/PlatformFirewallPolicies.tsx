// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import ErrorBanner from '../../../components/ErrorBanner'
import { MacGlassPanel, MacListRow, MacSectionTitle, MacSheet } from '../../../components/platform/mac/PlatformMacUi'
import {
  createFirewallPolicy,
  listFirewallPolicies,
  simulateFirewallPolicy,
  type FirewallPolicyRow,
} from '../../../api/zeusFirewall'
import { useToastContext } from '../../../contexts/ToastContext'
import { formatUserError } from '../../../utils/apiError'

export default function PlatformFirewallPolicies() {
  const toast = useToastContext()
  const [rows, setRows] = useState<FirewallPolicyRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('production-default')
  const [profile, setProfile] = useState('ProductionServer')
  const [specYaml, setSpecYaml] = useState('profile: ProductionServer\n')
  const [simResult, setSimResult] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      setRows(await listFirewallPolicies())
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const create = async () => {
    try {
      await createFirewallPolicy({ name, profile, spec_yaml: specYaml, enabled: true })
      toast.success('Policy created')
      await load()
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    }
  }

  const simulate = async () => {
    try {
      const r = await simulateFirewallPolicy({ name, profile, spec_yaml: specYaml })
      setSimResult(JSON.stringify(r, null, 2))
      setSheetOpen(true)
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    }
  }

  return (
    <div className="space-y-6">
      <MacSectionTitle title="Policy Studio" subtitle="Create, simulate, and manage Zeus firewall policies." />
      <Link to="/platform/zeus/security/firewall" className="text-sm text-blue-400">← Firewall overview</Link>
      {error && <ErrorBanner message={error} />}
      <MacGlassPanel title="New policy">
        <div className="grid gap-3 max-w-lg">
          <input className="input text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input text-sm" placeholder="Profile" value={profile} onChange={(e) => setProfile(e.target.value)} />
          <textarea className="input text-sm font-mono min-h-[8rem]" value={specYaml} onChange={(e) => setSpecYaml(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => void simulate()}>Simulate</button>
            <button type="button" className="btn-primary text-sm" onClick={() => void create()}>Create</button>
          </div>
        </div>
      </MacGlassPanel>
      <MacGlassPanel title="Policies">
        <ul className="divide-y divide-white/[0.04] -mx-1">
          {rows.map((p) => (
            <MacListRow key={p.id} title={p.name} subtitle={`${p.profile} · ${p.enabled ? 'enabled' : 'disabled'}`} />
          ))}
          {rows.length === 0 && <p className="text-sm text-slate-400 px-1">No policies yet.</p>}
        </ul>
      </MacGlassPanel>
      <MacSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Simulation result" wide>
        <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">{simResult ?? '—'}</pre>
      </MacSheet>
    </div>
  )
}
