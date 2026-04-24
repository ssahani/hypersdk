import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router'
import {
  listRoles, setRole, listTokens, createToken, deleteToken,
  listAlertRules, saveAlertRules, listAlerts, acknowledgeAlert,
  listWebhooks, saveWebhooks, listSchedules, saveSchedules,
  listNotificationChannels, saveNotificationChannels, testNotification,
  listSnapshotSchedules, saveSnapshotSchedules,
  UserRole, ApiToken, AlertRule, Alert, WebhookConfig, ScheduledAction,
  NotificationChannel, SnapshotSchedule,
} from '../api/automation'
import { getOsUserCapability, createOsUser, OsUserCapability } from '../api/system'
import { listVMs, VmInfo } from '../api/vm'
import { useToastContext } from '../contexts/ToastContext'
import {
  Settings, Users, Key, Bell, Webhook, Clock, Plus, Trash2, RefreshCw,
  Check, X, Shield, AlertCircle, Eye, Send, Camera, MessageSquare,
} from 'lucide-react'
import { ChoiceCard, ChoiceCardDenseGrid } from '../components/ChoiceCards'

type Tab = 'roles' | 'tokens' | 'alerts' | 'webhooks' | 'schedules' | 'notifications' | 'snapshots'

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('roles')
  const [loading, setLoading] = useState(true)
  const toast = useToastContext()

  // Data
  const [roles, setRoles] = useState<UserRole[]>([])
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [alertRules, setAlertRules] = useState<AlertRule[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([])
  const [schedules, setSchedules] = useState<ScheduledAction[]>([])
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>([])
  const [snapshotSchedules, setSnapshotSchedules] = useState<SnapshotSchedule[]>([])
  const [vms, setVMs] = useState<VmInfo[]>([])

  // Forms
  const [newRoleUser, setNewRoleUser] = useState('')
  const [newRoleVal, setNewRoleVal] = useState('operator')
  const [newTokenName, setNewTokenName] = useState('')
  const [newTokenUser, setNewTokenUser] = useState('')
  const [newTokenRole, setNewTokenRole] = useState('readonly')
  const [createdToken, setCreatedToken] = useState('')
  const [newWebhookUrl, setNewWebhookUrl] = useState('')
  const [newSchedVm, setNewSchedVm] = useState('')
  const [newSchedAction, setNewSchedAction] = useState('shutdown')
  const [newSchedTime, setNewSchedTime] = useState('22:00')
  const [newNotifType, setNewNotifType] = useState('slack')
  const [newNotifConfig, setNewNotifConfig] = useState('')
  const [newSnapVm, setNewSnapVm] = useState('')
  const [newSnapInterval, setNewSnapInterval] = useState('24')
  const [newSnapRetain, setNewSnapRetain] = useState('5')

  const [osUserCap, setOsUserCap] = useState<OsUserCapability | null>(null)
  const [newOsUsername, setNewOsUsername] = useState('')
  const [newOsPassword, setNewOsPassword] = useState('')
  const [addOsUserToLibvirt, setAddOsUserToLibvirt] = useState(true)

  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      listRoles(), listTokens(), listAlertRules(), listAlerts(),
      listWebhooks(), listSchedules(), listVMs(),
      listNotificationChannels(), listSnapshotSchedules(),
      getOsUserCapability(),
    ])
    if (results[0].status === 'fulfilled') setRoles(results[0].value)
    if (results[1].status === 'fulfilled') setTokens(results[1].value)
    if (results[2].status === 'fulfilled') setAlertRules(results[2].value)
    if (results[3].status === 'fulfilled') setAlerts(results[3].value)
    if (results[4].status === 'fulfilled') setWebhooks(results[4].value)
    if (results[5].status === 'fulfilled') setSchedules(results[5].value)
    if (results[6].status === 'fulfilled') setVMs(results[6].value)
    if (results[7].status === 'fulfilled') setNotificationChannels(results[7].value)
    if (results[8].status === 'fulfilled') setSnapshotSchedules(results[8].value)
    if (results[9].status === 'fulfilled') setOsUserCap(results[9].value)
    else setOsUserCap(null)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (osUserCap?.libvirtGroupAvailable === false) {
      setAddOsUserToLibvirt(false)
    }
  }, [osUserCap?.libvirtGroupAvailable])

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'roles', label: 'Users & Roles', icon: <Users className="w-4 h-4" /> },
    { key: 'tokens', label: 'API Tokens', icon: <Key className="w-4 h-4" /> },
    { key: 'alerts', label: `Alerts (${alerts.filter(a => !a.acknowledged).length})`, icon: <Bell className="w-4 h-4" /> },
    { key: 'webhooks', label: 'Webhooks', icon: <Webhook className="w-4 h-4" /> },
    { key: 'schedules', label: 'Schedules', icon: <Clock className="w-4 h-4" /> },
    { key: 'notifications', label: 'Notifications', icon: <MessageSquare className="w-4 h-4" /> },
    { key: 'snapshots', label: 'Snapshot Schedules', icon: <Camera className="w-4 h-4" /> },
  ]

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="w-6 h-6 text-blue-400" /> Settings</h1>
          <p className="text-sm text-slate-400 mt-0.5 max-w-2xl">RBAC, tokens, alerts, and schedules for the hypervisor control plane on this host.</p>
        </div>
        <button onClick={load} className="p-2 hover:bg-slate-700 rounded-lg transition" aria-label="Refresh"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <p className="text-xs text-slate-500">
        Libvirt secrets (Ceph, iSCSI, TLS, …) are managed on the{' '}
        <Link to="/secrets" className="text-blue-400 hover:text-blue-300 underline">Secrets</Link> page (define XML + optional base64 value).
      </p>

      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Section</h2>
        <ChoiceCardDenseGrid>
          {tabs.map((t) => (
            <ChoiceCard
              key={t.key}
              compact
              tone="blue"
              selected={tab === t.key}
              onClick={() => setTab(t.key)}
              icon={t.icon}
              title={t.label}
            />
          ))}
        </ChoiceCardDenseGrid>
      </div>

      {/* ── Roles ──────────────────────────────────────────── */}
      {tab === 'roles' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input value={newRoleUser} onChange={e => setNewRoleUser(e.target.value)} className="input-field flex-1" placeholder="Username" />
            <select value={newRoleVal} onChange={e => setNewRoleVal(e.target.value)} className="input-field w-40">
              <option value="admin">Admin</option>
              <option value="operator">Operator</option>
              <option value="readonly">Read-only</option>
            </select>
            <button onClick={async () => { if (!newRoleUser) return; try { await setRole(newRoleUser, newRoleVal); toast.success('Role set'); setNewRoleUser(''); load() } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) } }} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-slate-700/50 text-left text-sm text-slate-400"><th className="px-6 py-3">User</th><th className="px-6 py-3">Role</th><th className="px-6 py-3">Permissions</th></tr></thead>
              <tbody className="divide-y divide-slate-700/30">
                {roles.map(r => (
                  <tr key={r.username} className="table-row-hover">
                    <td className="px-6 py-3 font-medium">{r.username}</td>
                    <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${r.role === 'admin' ? 'bg-red-500/20 text-red-400' : r.role === 'operator' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-400'}`}>{r.role}</span></td>
                    <td className="px-6 py-3 text-xs text-slate-500">{r.role === 'admin' ? 'Full access' : r.role === 'operator' ? 'Create/modify VMs' : 'View only'}</td>
                  </tr>
                ))}
                {roles.length === 0 && <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500">No custom roles set. All users default to admin.</td></tr>}
              </tbody>
            </table>
          </div>

          {osUserCap && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Shield className="w-4 h-4 text-blue-400" /> Create system user (PAM)</h3>
              <p className="text-xs text-slate-500">
                Adds a UNIX account on the machina host (<code className="bg-slate-900/80 px-1 rounded">useradd</code> + password). Optionally append the <strong className="text-slate-400">libvirt</strong> group so the account can use <code className="bg-slate-900/80 px-1 rounded">qemu:///system</code> after next login (or <code className="bg-slate-900/80 px-1 rounded">newgrp libvirt</code>). The signed-in user must be in <strong className="text-slate-400">wheel</strong>, <strong className="text-slate-400">sudo</strong>, or <strong className="text-slate-400">admin</strong>. Not available when using an API token.
              </p>
              {osUserCap.libvirtGroupAvailable === false && (
                <p className="text-xs text-amber-400/90">Host has no <code className="bg-slate-900/80 px-1 rounded">libvirt</code> UNIX group — install libvirt or create the group before enabling libvirt access for new users.</p>
              )}
              {osUserCap.canCreateOsUsers ? (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="rounded border-slate-600"
                      checked={addOsUserToLibvirt}
                      disabled={osUserCap.libvirtGroupAvailable === false}
                      onChange={e => setAddOsUserToLibvirt(e.target.checked)}
                    />
                    Add to <code className="text-xs bg-slate-900/80 px-1 rounded">{osUserCap.libvirtGroupName ?? 'libvirt'}</code> group (libvirt / qemu system URI)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input value={newOsUsername} onChange={e => setNewOsUsername(e.target.value)} className="input-field flex-1" placeholder="New username" autoComplete="off" />
                    <input value={newOsPassword} onChange={e => setNewOsPassword(e.target.value)} type="password" className="input-field flex-1" placeholder="Initial password" autoComplete="new-password" />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!newOsUsername.trim() || !newOsPassword) { toast.error('Username and password required'); return }
                        try {
                          const r = await createOsUser(newOsUsername.trim(), newOsPassword, addOsUserToLibvirt)
                          const extra = r.libvirt_group_attached ? ' (added to libvirt group)' : ''
                          toast.success(`System user '${newOsUsername.trim()}' created${extra}`)
                          setNewOsUsername('')
                          setNewOsPassword('')
                        } catch (e: unknown) {
                          toast.error(e instanceof Error ? e.message : String(e))
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition whitespace-nowrap"
                    >
                      Create UNIX user
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-amber-400/90">{typeof osUserCap.reason === 'string' ? osUserCap.reason : 'You cannot create system users with the current sign-in method.'}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tokens ─────────────────────────────────────────── */}
      {tab === 'tokens' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input value={newTokenName} onChange={e => setNewTokenName(e.target.value)} className="input-field flex-1" placeholder="Token name" />
            <input value={newTokenUser} onChange={e => setNewTokenUser(e.target.value)} className="input-field w-32" placeholder="User" />
            <select value={newTokenRole} onChange={e => setNewTokenRole(e.target.value)} className="input-field w-32">
              <option value="admin">Admin</option>
              <option value="operator">Operator</option>
              <option value="readonly">Read-only</option>
            </select>
            <button onClick={async () => { if (!newTokenName || !newTokenUser) return; try { const t = await createToken(newTokenName, newTokenUser, newTokenRole); setCreatedToken(t.token); toast.success('Token created'); setNewTokenName(''); load() } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) } }} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition"><Plus className="w-4 h-4" /></button>
          </div>
          {createdToken && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <span className="text-xs text-green-400">New token (copy now, won't be shown again):</span>
              <div className="font-mono text-sm text-green-300 mt-1 break-all">{createdToken}</div>
            </div>
          )}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-slate-700/50 text-left text-sm text-slate-400"><th className="px-6 py-3">Name</th><th className="px-6 py-3">Token</th><th className="px-6 py-3">User</th><th className="px-6 py-3">Role</th><th className="px-6 py-3">Created</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-700/30">
                {tokens.map(t => (
                  <tr key={t.name} className="table-row-hover">
                    <td className="px-6 py-3 font-medium">{t.name}</td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-400">{t.token}</td>
                    <td className="px-6 py-3 text-sm">{t.username}</td>
                    <td className="px-6 py-3 text-xs"><span className="px-2 py-0.5 bg-slate-700 rounded">{t.role}</span></td>
                    <td className="px-6 py-3 text-xs text-slate-500">{t.created}</td>
                    <td className="px-6 py-3 text-right"><button onClick={async () => { try { await deleteToken(t.token); toast.success('Deleted'); load() } catch {} }} className="p-1 hover:bg-red-600/20 rounded"><Trash2 className="w-4 h-4 text-red-400" /></button></td>
                  </tr>
                ))}
                {tokens.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No API tokens. Create one to authenticate scripts and automation.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">Use tokens with: <code className="bg-slate-800 px-1 rounded">curl -k -H "Authorization: Bearer mach_xxx..." https://host:5092/api/v1/vms</code> (older installs may still have <code className="bg-slate-800 px-1 rounded">vs_</code> tokens until rotated)</p>
        </div>
      )}

      {/* ── Alerts ─────────────────────────────────────────── */}
      {tab === 'alerts' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-300">Alert Rules</h3>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-slate-700/50 text-left text-sm text-slate-400"><th className="px-6 py-3">Rule</th><th className="px-6 py-3">Condition</th><th className="px-6 py-3">Threshold</th><th className="px-6 py-3">Enabled</th></tr></thead>
              <tbody className="divide-y divide-slate-700/30">
                {alertRules.map((r, i) => (
                  <tr key={r.id} className="table-row-hover">
                    <td className="px-6 py-3 font-medium">{r.name}</td>
                    <td className="px-6 py-3 text-sm font-mono text-slate-400">{r.condition}</td>
                    <td className="px-6 py-3"><input type="number" value={r.threshold} onChange={e => { const next = [...alertRules]; next[i].threshold = parseFloat(e.target.value) || 0; setAlertRules(next) }} className="input-field w-20" /></td>
                    <td className="px-6 py-3"><input type="checkbox" checked={r.enabled} onChange={e => { const next = [...alertRules]; next[i].enabled = e.target.checked; setAlertRules(next) }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={async () => { try { await saveAlertRules(alertRules); toast.success('Rules saved') } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) } }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition">Save Rules</button>

          <h3 className="text-sm font-semibold text-slate-300 mt-6">Active Alerts</h3>
          <div className="space-y-2">
            {alerts.filter(a => !a.acknowledged).map(a => (
              <div key={a.id} className={`flex items-center gap-3 p-3 rounded-lg border ${a.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
                <AlertCircle className={`w-4 h-4 ${a.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'}`} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{a.rule_name}</div>
                  <div className="text-xs text-slate-400">{a.message} — {a.timestamp}</div>
                </div>
                <button onClick={async () => { try { await acknowledgeAlert(a.id); load() } catch {} }} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs"><Check className="w-3 h-3 inline" /> Ack</button>
              </div>
            ))}
            {alerts.filter(a => !a.acknowledged).length === 0 && <p className="text-sm text-slate-500">No active alerts</p>}
          </div>
        </div>
      )}

      {/* ── Webhooks ───────────────────────────────────────── */}
      {tab === 'webhooks' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input value={newWebhookUrl} onChange={e => setNewWebhookUrl(e.target.value)} className="input-field flex-1" placeholder="https://example.com/webhook" />
            <button onClick={() => { if (!newWebhookUrl) return; const next = [...webhooks, { id: `wh-${Date.now()}`, url: newWebhookUrl, events: ['*'], enabled: true }]; setWebhooks(next); setNewWebhookUrl(''); saveWebhooks(next).then(() => toast.success('Webhook added')).catch(() => {}) }} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-slate-700/50 text-left text-sm text-slate-400"><th className="px-6 py-3">URL</th><th className="px-6 py-3">Events</th><th className="px-6 py-3">Enabled</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-700/30">
                {webhooks.map((h, i) => (
                  <tr key={h.id} className="table-row-hover">
                    <td className="px-6 py-3 text-sm font-mono text-blue-400 truncate max-w-xs">{h.url}</td>
                    <td className="px-6 py-3 text-xs text-slate-400">{h.events.join(', ')}</td>
                    <td className="px-6 py-3"><input type="checkbox" checked={h.enabled} onChange={e => { const next = [...webhooks]; next[i].enabled = e.target.checked; setWebhooks(next); saveWebhooks(next) }} /></td>
                    <td className="px-6 py-3 text-right"><button onClick={() => { const next = webhooks.filter((_, j) => j !== i); setWebhooks(next); saveWebhooks(next) }} className="p-1 hover:bg-red-600/20 rounded"><Trash2 className="w-4 h-4 text-red-400" /></button></td>
                  </tr>
                ))}
                {webhooks.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No webhooks configured. Add one to receive VM event notifications.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">Events: vm_started, vm_stopped, alert_fired, backup_completed, * (all)</p>
        </div>
      )}

      {/* ── Schedules ──────────────────────────────────────── */}
      {tab === 'schedules' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <select value={newSchedVm} onChange={e => setNewSchedVm(e.target.value)} className="input-field flex-1">
              <option value="">Select VM...</option>
              {vms.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
            </select>
            <select value={newSchedAction} onChange={e => setNewSchedAction(e.target.value)} className="input-field w-32">
              <option value="start">Start</option>
              <option value="shutdown">Shutdown</option>
              <option value="stop">Force Stop</option>
              <option value="reboot">Reboot</option>
              <option value="snapshot">Snapshot</option>
            </select>
            <input type="time" value={newSchedTime} onChange={e => setNewSchedTime(e.target.value)} className="input-field w-28" />
            <button onClick={() => { if (!newSchedVm) return; const next = [...schedules, { id: `sched-${Date.now()}`, vm_name: newSchedVm, action: newSchedAction, schedule: `daily ${newSchedTime}`, enabled: true, last_run: '' }]; setSchedules(next); saveSchedules(next).then(() => toast.success('Schedule added')).catch(() => {}) }} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-slate-700/50 text-left text-sm text-slate-400"><th className="px-6 py-3">VM</th><th className="px-6 py-3">Action</th><th className="px-6 py-3">Schedule</th><th className="px-6 py-3">Enabled</th><th className="px-6 py-3">Last Run</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-700/30">
                {schedules.map((s, i) => (
                  <tr key={s.id} className="table-row-hover">
                    <td className="px-6 py-3 font-medium">{s.vm_name}</td>
                    <td className="px-6 py-3 text-sm"><span className="px-2 py-0.5 bg-slate-700 rounded text-xs">{s.action}</span></td>
                    <td className="px-6 py-3 text-sm font-mono text-slate-400">{s.schedule}</td>
                    <td className="px-6 py-3"><input type="checkbox" checked={s.enabled} onChange={e => { const next = [...schedules]; next[i].enabled = e.target.checked; setSchedules(next); saveSchedules(next) }} /></td>
                    <td className="px-6 py-3 text-xs text-slate-500">{s.last_run || 'never'}</td>
                    <td className="px-6 py-3 text-right"><button onClick={() => { const next = schedules.filter((_, j) => j !== i); setSchedules(next); saveSchedules(next) }} className="p-1 hover:bg-red-600/20 rounded"><Trash2 className="w-4 h-4 text-red-400" /></button></td>
                  </tr>
                ))}
                {schedules.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No scheduled actions. Add one to auto start/stop VMs at specific times.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Notifications ─────────────────────────────────── */}
      {tab === 'notifications' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <select value={newNotifType} onChange={e => setNewNotifType(e.target.value)} className="input-field w-36">
              <option value="slack">Slack</option>
              <option value="email">Email</option>
              <option value="telegram">Telegram</option>
              <option value="webhook">Webhook</option>
            </select>
            <input value={newNotifConfig} onChange={e => setNewNotifConfig(e.target.value)} className="input-field flex-1" placeholder={newNotifType === 'slack' ? 'Slack webhook URL' : newNotifType === 'email' ? 'recipient@example.com' : newNotifType === 'telegram' ? 'bot_token:chat_id' : 'https://example.com/hook'} />
            <button onClick={() => { if (!newNotifConfig) return; const next = [...notificationChannels, { id: `notif-${Date.now()}`, channel_type: newNotifType, config: newNotifConfig, enabled: true }]; setNotificationChannels(next); setNewNotifConfig(''); saveNotificationChannels(next).then(() => toast.success('Channel added')).catch(() => {}) }} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-slate-700/50 text-left text-sm text-slate-400"><th className="px-6 py-3">Type</th><th className="px-6 py-3">Config</th><th className="px-6 py-3">Enabled</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-700/30">
                {notificationChannels.map((ch, i) => (
                  <tr key={ch.id} className="table-row-hover">
                    <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${ch.channel_type === 'slack' ? 'bg-purple-500/20 text-purple-400' : ch.channel_type === 'email' ? 'bg-blue-500/20 text-blue-400' : ch.channel_type === 'telegram' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700 text-slate-400'}`}>{ch.channel_type}</span></td>
                    <td className="px-6 py-3 text-sm font-mono text-slate-400 truncate max-w-xs">{ch.config}</td>
                    <td className="px-6 py-3"><input type="checkbox" checked={ch.enabled} onChange={e => { const next = [...notificationChannels]; next[i].enabled = e.target.checked; setNotificationChannels(next); saveNotificationChannels(next) }} /></td>
                    <td className="px-6 py-3 text-right flex items-center justify-end gap-1">
                      <button onClick={async () => { try { await testNotification(ch); toast.success('Test sent') } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) } }} className="p-1 hover:bg-blue-600/20 rounded" title="Send test"><Send className="w-4 h-4 text-blue-400" /></button>
                      <button onClick={() => { const next = notificationChannels.filter((_, j) => j !== i); setNotificationChannels(next); saveNotificationChannels(next) }} className="p-1 hover:bg-red-600/20 rounded"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </td>
                  </tr>
                ))}
                {notificationChannels.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No notification channels. Add Slack, Email, Telegram, or Webhook to receive alerts.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">Slack: paste incoming webhook URL. Email: recipient address (requires sendmail). Telegram: bot_token:chat_id format.</p>
        </div>
      )}

      {/* ── Snapshot Schedules ─────────────────────────────── */}
      {tab === 'snapshots' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <select value={newSnapVm} onChange={e => setNewSnapVm(e.target.value)} className="input-field flex-1">
              <option value="">Select VM...</option>
              {vms.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
            </select>
            <select value={newSnapInterval} onChange={e => setNewSnapInterval(e.target.value)} className="input-field w-28">
              <option value="1">Every 1h</option>
              <option value="4">Every 4h</option>
              <option value="12">Every 12h</option>
              <option value="24">Every 24h</option>
            </select>
            <input type="number" value={newSnapRetain} onChange={e => setNewSnapRetain(e.target.value)} className="input-field w-24" placeholder="Retain" min="1" max="100" />
            <button onClick={() => { if (!newSnapVm) return; const next = [...snapshotSchedules, { id: `snap-${Date.now()}`, vm_name: newSnapVm, interval_hours: parseInt(newSnapInterval) || 24, retain_count: parseInt(newSnapRetain) || 5, enabled: true, last_run: '' }]; setSnapshotSchedules(next); setNewSnapVm(''); saveSnapshotSchedules(next).then(() => toast.success('Snapshot schedule added')).catch(() => {}) }} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-slate-700/50 text-left text-sm text-slate-400"><th className="px-6 py-3">VM</th><th className="px-6 py-3">Interval</th><th className="px-6 py-3">Retain</th><th className="px-6 py-3">Last Run</th><th className="px-6 py-3">Enabled</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-700/30">
                {snapshotSchedules.map((s, i) => (
                  <tr key={s.id} className="table-row-hover">
                    <td className="px-6 py-3 font-medium">{s.vm_name}</td>
                    <td className="px-6 py-3 text-sm">{s.interval_hours}h</td>
                    <td className="px-6 py-3 text-sm">{s.retain_count}</td>
                    <td className="px-6 py-3 text-xs text-slate-500">{s.last_run || 'never'}</td>
                    <td className="px-6 py-3"><input type="checkbox" checked={s.enabled} onChange={e => { const next = [...snapshotSchedules]; next[i].enabled = e.target.checked; setSnapshotSchedules(next); saveSnapshotSchedules(next) }} /></td>
                    <td className="px-6 py-3 text-right"><button onClick={() => { const next = snapshotSchedules.filter((_, j) => j !== i); setSnapshotSchedules(next); saveSnapshotSchedules(next) }} className="p-1 hover:bg-red-600/20 rounded"><Trash2 className="w-4 h-4 text-red-400" /></button></td>
                  </tr>
                ))}
                {snapshotSchedules.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No snapshot schedules. Add one to automatically snapshot VMs at regular intervals.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">Snapshots are taken automatically at the configured interval. Old snapshots beyond the retain count are pruned.</p>
        </div>
      )}
    </div>
  )
}
