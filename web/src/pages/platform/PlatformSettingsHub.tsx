// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { NavLink } from 'react-router'
import { Settings, Shield, Users, HardDrive, Network, Archive, RefreshCw, Key, LifeBuoy } from 'lucide-react'
import PlatformSettings from './PlatformSettings'
import { getClusterSettings, patchClusterSettings } from '../../api/platform'
import { getAiPolicyExport } from '../../api/ai'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'

const SECTIONS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'users', label: 'Users & Access', icon: Users, href: '/platform/users' },
  { id: 'storage', label: 'Storage', icon: HardDrive, href: '/platform/storage' },
  { id: 'networks', label: 'Networks', icon: Network, href: '/platform/networks' },
  { id: 'backup', label: 'Backup', icon: Archive, href: '/platform/backups' },
  { id: 'updates', label: 'Updates', icon: RefreshCw },
  { id: 'integrations', label: 'Integrations', icon: Key, href: '/platform/webhooks' },
  { id: 'support', label: 'Support', icon: LifeBuoy, href: '/platform/support' },
]

export default function PlatformSettingsHub() {
  const toast = useToastContext()
  const [deleteApproval, setDeleteApproval] = useState(false)
  const [saving, setSaving] = useState(false)
  const [policyYaml, setPolicyYaml] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const s = await getClusterSettings()
      setDeleteApproval(Boolean(s.require_vm_delete_approval))
    } catch { /* optional */ }
  }, [])

  useEffect(() => { void load() }, [load])

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

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[32rem]">
      <aside className="lg:w-52 shrink-0">
        <h1 className="text-2xl font-bold mb-4">Settings</h1>
        <nav className="space-y-0.5">
          {SECTIONS.map((s) => {
            const Icon = s.icon
            if (s.href) {
              return (
                <NavLink key={s.id} to={s.href} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800/60 hover:text-slate-200">
                  <Icon className="w-4 h-4" /> {s.label}
                </NavLink>
              )
            }
            return (
              <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800/60 hover:text-slate-200">
                <Icon className="w-4 h-4" /> {s.label}
              </a>
            )
          })}
        </nav>
      </aside>
      <div className="flex-1 min-w-0 space-y-6">
        <section id="security" className="card p-5 space-y-3">
          <h2 className="font-semibold">Security</h2>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input type="checkbox" disabled /> Require MFA for admins (enterprise backlog)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" defaultChecked disabled /> Enable audit logging
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={deleteApproval}
              disabled={saving}
              onChange={(e) => void toggleDeleteApproval(e.target.checked)}
            />
            Require confirmation for production VM deletion
          </label>
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <p className="text-sm font-medium">Policy Generator</p>
            <p className="text-xs text-slate-500">Export cluster policy rules and quotas as YAML.</p>
            <button type="button" className="btn-secondary text-xs" onClick={async () => {
              try {
                const r = await getAiPolicyExport()
                setPolicyYaml(r.yaml)
                toast.success(`Exported ${r.rule_count} rules, ${r.quota_count} quotas`)
              } catch (e: unknown) { toast.error(formatUserError(e)) }
            }}>Generate YAML</button>
            {policyYaml && (
              <textarea className="input font-mono text-[10px] min-h-32 w-full" readOnly value={policyYaml} />
            )}
          </div>
        </section>
        <PlatformSettings embedded />
      </div>
    </div>
  )
}
