// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Settings, Shield, Users, HardDrive, Network, Archive, RefreshCw, Key, LifeBuoy, Info } from 'lucide-react'
import PlatformSettings from './PlatformSettings'
import {
  MacSettingsPane,
  MacSettingsGroup,
  MacToggle,
  MacListRow,
} from '../../components/platform/mac/PlatformMacUi'
import { getClusterSettings, patchClusterSettings } from '../../api/platform'
import { getAiPolicyExport } from '../../api/ai'
import { getFirewallOverview, type FirewallOverview } from '../../api/zeusFirewall'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'

type SettingsSection = 'general' | 'security' | 'network' | 'storage' | 'users' | 'updates' | 'integrations' | 'support' | 'about'

const SECTIONS: Array<{ id: SettingsSection; label: string; icon: React.ReactNode; href?: string }> = [
  { id: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
  { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
  { id: 'network', label: 'Network', icon: <Network className="w-4 h-4" /> },
  { id: 'storage', label: 'Storage', icon: <HardDrive className="w-4 h-4" />, href: '/platform/storage' },
  { id: 'users', label: 'Users & Access', icon: <Users className="w-4 h-4" />, href: '/platform/users' },
  { id: 'updates', label: 'Updates', icon: <RefreshCw className="w-4 h-4" /> },
  { id: 'integrations', label: 'Integrations', icon: <Key className="w-4 h-4" />, href: '/platform/webhooks' },
  { id: 'support', label: 'Support', icon: <LifeBuoy className="w-4 h-4" />, href: '/platform/support' },
  { id: 'about', label: 'About', icon: <Info className="w-4 h-4" /> },
]

export default function PlatformSettingsHub() {
  const toast = useToastContext()
  const navigate = useNavigate()
  const [section, setSection] = useState<SettingsSection>('general')
  const [deleteApproval, setDeleteApproval] = useState(false)
  const [approvalSlaHours, setApprovalSlaHours] = useState(72)
  const [saving, setSaving] = useState(false)
  const [policyYaml, setPolicyYaml] = useState<string | null>(null)
  const [firewallOverview, setFirewallOverview] = useState<FirewallOverview | null>(null)

  const load = useCallback(async () => {
    try {
      const s = await getClusterSettings()
      setDeleteApproval(Boolean(s.require_vm_delete_approval))
      setApprovalSlaHours(s.firewall_approval_sla_hours ?? 72)
    } catch { /* optional */ }
    try {
      setFirewallOverview(await getFirewallOverview())
    } catch { /* optional */ }
  }, [])

  useEffect(() => { void load() }, [load])

  const selectSection = (id: string) => {
    const match = SECTIONS.find((s) => s.id === id)
    if (match?.href) {
      navigate(match.href)
      return
    }
    setSection(id as SettingsSection)
  }

  const toggleDeleteApproval = async (checked: boolean) => {
    setSaving(true)
    try {
      await patchClusterSettings({ require_vm_delete_approval: checked })
      setDeleteApproval(checked)
      toast.success(checked ? 'VM deletion approval enabled' : 'VM deletion approval disabled')
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setSaving(false)
    }
  }

  const saveApprovalSla = async () => {
    setSaving(true)
    try {
      await patchClusterSettings({ firewall_approval_sla_hours: approvalSlaHours })
      toast.success('Firewall approval SLA saved')
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <MacSettingsPane
      title="Settings"
      sections={SECTIONS.map((s) => ({ id: s.id, label: s.label, icon: s.icon }))}
      active={section}
      onSelect={selectSection}
    >
      {section === 'general' && <PlatformSettings embedded />}

      {section === 'security' && (
        <div className="space-y-6">
          <MacSettingsGroup title="Security">
            <MacToggle
              label="Require confirmation for production VM deletion"
              description="Deletes queue for approval when enabled cluster-wide."
              checked={deleteApproval}
              disabled={saving}
              onChange={(v) => void toggleDeleteApproval(v)}
            />
            <MacToggle
              label="Require MFA for admins"
              description="Enterprise backlog — not yet available."
              checked={false}
              disabled
              onChange={() => {}}
            />
            <p className="text-xs text-slate-500 pt-2">Audit logging is always enabled for platform operations.</p>
          </MacSettingsGroup>

          <MacSettingsGroup title="Zeus Firewall">
            {firewallOverview ? (
              <>
                <MacListRow
                  title="Machine Security"
                  subtitle={`${firewallOverview.summary} · ${firewallOverview.targets.length} targets · ${firewallOverview.critical_count} critical`}
                  href="/platform/zeus/security/firewall"
                />
                {firewallOverview.critical_count > 0 && (
                  <p className="text-xs text-amber-400 px-1">
                    {firewallOverview.critical_count} machine(s) need attention — review open ports and profiles.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">Firewall overview unavailable — agent may be offline.</p>
            )}
            <Link to="/platform/zeus/security/firewall" className="text-sm text-blue-400 inline-block mt-2">
              Open Machine Security →
            </Link>
          </MacSettingsGroup>

          <MacSettingsGroup title="Policy Generator">
            <p className="text-xs text-slate-500 mb-2">Export cluster policy rules and quotas as YAML.</p>
            <button type="button" className="btn-secondary text-xs" onClick={async () => {
              try {
                const r = await getAiPolicyExport()
                setPolicyYaml(r.yaml)
                toast.success(`Exported ${r.rule_count} rules, ${r.quota_count} quotas`)
              } catch (e: unknown) { toast.error(formatUserError(e)) }
            }}>Generate YAML</button>
            {policyYaml && (
              <textarea className="input font-mono text-[10px] min-h-32 w-full mt-2" readOnly value={policyYaml} />
            )}
          </MacSettingsGroup>
        </div>
      )}

      {section === 'network' && (
        <div className="space-y-6">
          <MacSettingsGroup title="Networks">
            <MacListRow title="Virtual networks" subtitle="Bridges, VLANs, and IP pools" href="/platform/networks" />
          </MacSettingsGroup>

          <MacSettingsGroup title="Firewall">
            {firewallOverview && (
              <div className="grid gap-3 sm:grid-cols-3 text-sm mb-3">
                <div className="rounded-xl border border-white/[0.06] bg-slate-900/40 p-3">
                  <p className="text-[10px] uppercase text-slate-500">Targets</p>
                  <p className="text-lg font-semibold text-slate-100">{firewallOverview.targets.length}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-slate-900/40 p-3">
                  <p className="text-[10px] uppercase text-slate-500">Critical</p>
                  <p className="text-lg font-semibold text-red-400">{firewallOverview.critical_count}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-slate-900/40 p-3">
                  <p className="text-[10px] uppercase text-slate-500">Warnings</p>
                  <p className="text-lg font-semibold text-amber-400">{firewallOverview.warning_count}</p>
                </div>
              </div>
            )}
            <label className="block text-sm text-slate-400 mb-2">
              Risky profile change approval SLA (hours)
              <input
                type="number"
                min={1}
                max={720}
                className="input mt-1 block w-32"
                value={approvalSlaHours}
                disabled={saving}
                onChange={(e) => setApprovalSlaHours(Number(e.target.value))}
              />
            </label>
            <button type="button" className="btn-secondary text-xs" disabled={saving} onClick={() => void saveApprovalSla()}>
              Save SLA
            </button>
            <div className="pt-3 space-y-1">
              <Link to="/platform/zeus/security/firewall" className="text-sm text-blue-400 block">Machine Security overview →</Link>
              <Link to="/platform/zeus/security/ports" className="text-sm text-blue-400 block">Open port exposure →</Link>
              <Link to="/platform/zeus/security/compliance" className="text-sm text-blue-400 block">Compliance & approvals →</Link>
            </div>
          </MacSettingsGroup>
        </div>
      )}

      {section === 'updates' && (
        <MacSettingsGroup title="Updates">
          <p className="text-sm text-slate-400">Controller upgrade matrix and rollout planning.</p>
          <Link to="/platform/upgrade" className="text-sm text-blue-400 inline-block mt-2">Open upgrade matrix →</Link>
        </MacSettingsGroup>
      )}

      {section === 'about' && (
        <MacSettingsGroup title="About Zyvor Platform">
          <p className="text-sm text-slate-400">Virtual datacenter control plane — KVM engine, macOS-inspired UX.</p>
          <p className="text-xs text-slate-500 mt-2">UX batches 49–56 · Zeus Firewall macOS Security pane (AI-372–391)</p>
          <Link to="/platform/support" className="text-sm text-blue-400 inline-block mt-3">Support & diagnostics →</Link>
        </MacSettingsGroup>
      )}
    </MacSettingsPane>
  )
}
