// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Settings, Shield, Users, HardDrive, Network, Archive, RefreshCw, Key, LifeBuoy, Info } from 'lucide-react'
import PlatformSettings from './PlatformSettings'
import {
  MacSettingsPane,
  MacSettingsGroup,
  MacToggle,
  MacListRow,
} from '../../components/platform/mac/PlatformMacUi'
import { getClusterSettings, patchClusterSettings, getEnterpriseSecurityOverview, getFleetNetwork, listVaultProviders, listMfaPolicies, upsertMfaPolicy, listAirGapBundles, createAirGapBundle, type EnterpriseSecurityOverview, type FleetNetworkOverview, type VaultProvider, type MfaPolicy, type AirGapBundle } from '../../api/platform'
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
  const [searchParams] = useSearchParams()
  const initialSection = searchParams.get('section')
  const [section, setSection] = useState<SettingsSection>(
    initialSection === 'network' || initialSection === 'security' || initialSection === 'general'
      || initialSection === 'updates' || initialSection === 'about'
      ? (initialSection as SettingsSection)
      : 'general',
  )
  const [deleteApproval, setDeleteApproval] = useState(false)
  const [approvalSlaHours, setApprovalSlaHours] = useState(72)
  const [saving, setSaving] = useState(false)
  const [policyYaml, setPolicyYaml] = useState<string | null>(null)
  const [firewallOverview, setFirewallOverview] = useState<FirewallOverview | null>(null)
  const [enterprise, setEnterprise] = useState<EnterpriseSecurityOverview | null>(null)
  const [vaultProviders, setVaultProviders] = useState<VaultProvider[]>([])
  const [mfaPolicies, setMfaPolicies] = useState<MfaPolicy[]>([])
  const [airGapBundles, setAirGapBundles] = useState<AirGapBundle[]>([])
  const [bundleName, setBundleName] = useState('sovereign-export')
  const [bundleCreating, setBundleCreating] = useState(false)
  const [fleetNetwork, setFleetNetwork] = useState<FleetNetworkOverview | null>(null)

  const load = useCallback(async () => {
    try {
      const s = await getClusterSettings()
      setDeleteApproval(Boolean(s.require_vm_delete_approval))
      setApprovalSlaHours(s.firewall_approval_sla_hours ?? 72)
    } catch { /* optional */ }
    try {
      setFirewallOverview(await getFirewallOverview())
    } catch { /* optional */ }
    try {
      const [ov, vaults, mfa, bundles] = await Promise.all([
        getEnterpriseSecurityOverview(),
        listVaultProviders(),
        listMfaPolicies(),
        listAirGapBundles(),
      ])
      setEnterprise(ov)
      setVaultProviders(vaults)
      setMfaPolicies(mfa)
      setAirGapBundles(bundles)
    } catch { /* optional */ }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (section !== 'network') return
    void getFleetNetwork().then(setFleetNetwork).catch(() => setFleetNetwork(null))
  }, [section])

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

  const toggleAdminMfa = async (checked: boolean) => {
    setSaving(true)
    try {
      await upsertMfaPolicy('admin', { method: 'webauthn', required: checked, grace_days: 7 })
      setMfaPolicies((prev) =>
        prev.map((p) => (p.role_name === 'admin' ? { ...p, required: checked } : p)),
      )
      toast.success(checked ? 'Admin MFA policy enabled (stub)' : 'Admin MFA policy disabled')
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setSaving(false)
    }
  }

  const exportAirGapBundle = async () => {
    setBundleCreating(true)
    try {
      const bundle = await createAirGapBundle({ name: bundleName.trim() || 'sovereign-export' })
      setAirGapBundles((prev) => [bundle, ...prev])
      toast.success(`Air-gap bundle "${bundle.name}" manifest created`)
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setBundleCreating(false)
    }
  }

  const adminMfaRequired = mfaPolicies.find((p) => p.role_name === 'admin')?.required ?? false

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
              description="Policy stub — WebAuthn/TOTP enrollment inventory only (no live IdP)."
              checked={adminMfaRequired}
              disabled={saving}
              onChange={(v) => void toggleAdminMfa(v)}
            />
            <p className="text-xs text-slate-500 pt-2">Audit logging is always enabled for platform operations.</p>
          </MacSettingsGroup>

          {enterprise && (
            <MacSettingsGroup title="Keychain">
              <p className="text-xs text-slate-500 mb-2">Fleet secrets inventory — vault, MFA, API keys, air-gap bundles.</p>
              <Link to="/platform/enterprise?tab=keychain" className="text-sm text-blue-400">Open Keychain →</Link>
            </MacSettingsGroup>
          )}

          {enterprise && (
            <MacSettingsGroup title="Enterprise security">
              <p className="text-xs text-slate-500 mb-2">{enterprise.summary}</p>
              <div className="grid gap-3 sm:grid-cols-3 text-sm mb-3">
                <div className="rounded-xl border border-white/[0.06] bg-slate-900/40 p-3">
                  <p className="text-[10px] uppercase text-slate-500">Vault</p>
                  <p className="text-lg font-semibold text-slate-100">{enterprise.vault_connected}/{enterprise.vault_providers}</p>
                  <p className="text-[10px] text-slate-500">connected</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-slate-900/40 p-3">
                  <p className="text-[10px] uppercase text-slate-500">MFA roles</p>
                  <p className="text-lg font-semibold text-slate-100">{enterprise.mfa_required_roles}/{enterprise.mfa_policies}</p>
                  <p className="text-[10px] text-slate-500">required</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-slate-900/40 p-3">
                  <p className="text-[10px] uppercase text-slate-500">Air-gap</p>
                  <p className="text-lg font-semibold text-slate-100">{enterprise.air_gap_bundles}</p>
                  <p className="text-[10px] text-slate-500">bundles</p>
                </div>
              </div>
            </MacSettingsGroup>
          )}

          <MacSettingsGroup title="Vault providers">
            {vaultProviders.length === 0 ? (
              <p className="text-sm text-slate-500">No vault providers — run migration 029.</p>
            ) : (
              <div className="space-y-2">
                {vaultProviders.map((v) => (
                  <MacListRow
                    key={v.id}
                    title={v.name}
                    subtitle={`${v.provider_type} · ${v.status}${v.address ? ` · ${v.address}` : ''}`}
                  />
                ))}
              </div>
            )}
          </MacSettingsGroup>

          <MacSettingsGroup title="Air-gap bundles">
            <p className="text-xs text-slate-500 mb-2">Simulated sovereign export manifests — no live bundle runner.</p>
            <div className="flex gap-2 mb-3">
              <input
                className="input flex-1 text-sm"
                value={bundleName}
                disabled={bundleCreating}
                onChange={(e) => setBundleName(e.target.value)}
                placeholder="Bundle name"
              />
              <button type="button" className="btn-secondary text-xs shrink-0" disabled={bundleCreating} onClick={() => void exportAirGapBundle()}>
                {bundleCreating ? 'Creating…' : 'Create manifest'}
              </button>
            </div>
            {airGapBundles.slice(0, 5).map((b) => (
              <MacListRow
                key={b.id}
                title={b.name}
                subtitle={`${b.checksum.slice(0, 24)}… · ${Math.round(b.size_bytes / 1024)} KB`}
              />
            ))}
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
          {fleetNetwork && (
            <>
              <p className="text-sm text-slate-400">{fleetNetwork.summary}</p>
              <div className="grid gap-3 sm:grid-cols-4 text-sm">
                <div className="rounded-xl border border-white/[0.06] bg-slate-900/40 p-3">
                  <p className="text-[10px] uppercase text-slate-500">Networks</p>
                  <p className="text-lg font-semibold">{fleetNetwork.network_count}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-slate-900/40 p-3">
                  <p className="text-[10px] uppercase text-slate-500">Segments</p>
                  <p className="text-lg font-semibold">{fleetNetwork.segment_count}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-slate-900/40 p-3">
                  <p className="text-[10px] uppercase text-slate-500">IPAM pools</p>
                  <p className="text-lg font-semibold">{fleetNetwork.ipam_pool_count}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-slate-900/40 p-3">
                  <p className="text-[10px] uppercase text-slate-500">Deny east-west</p>
                  <p className="text-lg font-semibold text-amber-400">{fleetNetwork.deny_east_west_count}</p>
                </div>
              </div>
            </>
          )}

          <MacSettingsGroup title="Network Lens">
            <p className="text-sm text-slate-400 mb-2">macOS-style reachability explain — why can&apos;t VM A reach VM B?</p>
            <Link to="/platform/networks?tab=lens" className="text-sm text-blue-400 block">Open Network Lens →</Link>
            <Link to="/platform/topology" className="text-sm text-blue-400 block mt-1">Topology & digital twin →</Link>
          </MacSettingsGroup>

          <MacSettingsGroup title="Overlay segments">
            {(fleetNetwork?.segments ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No overlay segments yet.</p>
            ) : (
              fleetNetwork!.segments.slice(0, 8).map((s) => (
                <MacListRow
                  key={s.id}
                  title={s.name}
                  subtitle={`${s.cidr} · ${s.vm_count} VM(s) · east-west ${s.east_west_default}`}
                  badge={<span className="text-[10px] text-violet-300">{s.micro_seg_grade}</span>}
                  href={`/platform/networks?tab=segments`}
                />
              ))
            )}
            <Link to="/platform/networks" className="text-sm text-blue-400 inline-block mt-2">Manage networks →</Link>
          </MacSettingsGroup>

          <MacSettingsGroup title="Hypervisor networking">
            <MacListRow title="Host systemd network" subtitle="networkd + resolved per hypervisor" href="/platform/hosts" />
          </MacSettingsGroup>

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
