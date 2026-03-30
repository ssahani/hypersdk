import { useEffect, useState, useCallback } from 'react'
import {
  listRoles, setRole, listTokens, createToken, deleteToken,
  listAlertRules, saveAlertRules, listAlerts, acknowledgeAlert,
  listWebhooks, saveWebhooks, listSchedules, saveSchedules,
  UserRole, ApiToken, AlertRule, Alert, WebhookConfig, ScheduledAction,
} from '../api/automation'
import { listVMs, VmInfo } from '../api/vm'
import { useToastContext } from '../contexts/ToastContext'
import {
  Settings, Users, Key, Bell, Webhook, Clock, Plus, Trash2, RefreshCw,
  Check, X, Shield, AlertCircle, Eye,
} from 'lucide-react'

type Tab = 'roles' | 'tokens' | 'alerts' | 'webhooks' | 'schedules'

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

  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      listRoles(), listTokens(), listAlertRules(), listAlerts(),
      listWebhooks(), listSchedules(), listVMs(),
    ])
    if (results[0].status === 'fulfilled') setRoles(results[0].value)
    if (results[1].status === 'fulfilled') setTokens(results[1].value)
    if (results[2].status === 'fulfilled') setAlertRules(results[2].value)
    if (results[3].status === 'fulfilled') setAlerts(results[3].value)
    if (results[4].status === 'fulfilled') setWebhooks(results[4].value)
    if (results[5].status === 'fulfilled') setSchedules(results[5].value)
    if (results[6].status === 'fulfilled') setVMs(results[6].value)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'roles', label: 'Users & Roles', icon: <Users className="w-4 h-4" /> },
    { key: 'tokens', label: 'API Tokens', icon: <Key className="w-4 h-4" /> },
    { key: 'alerts', label: `Alerts (${alerts.filter(a => !a.acknowledged).length})`, icon: <Bell className="w-4 h-4" /> },
    { key: 'webhooks', label: 'Webhooks', icon: <Webhook className="w-4 h-4" /> },
    { key: 'schedules', label: 'Schedules', icon: <Clock className="w-4 h-4" /> },
  ]

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="w-6 h-6 text-blue-400" /> Settings</h1>
        <button onClick={load} className="p-2 hover:bg-slate-700 rounded-lg transition" aria-label="Refresh"><RefreshCw className="w-4 h-4" /></button>
      </div>

      <div className="flex gap-1 border-b border-slate-700/50 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm transition border-b-2 whitespace-nowrap ${tab === t.key ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            {t.icon} {t.label}
          </button>
        ))}
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
          <p className="text-xs text-slate-500">Use tokens with: <code className="bg-slate-800 px-1 rounded">curl -H "Authorization: Bearer vs_xxx..." http://host/api/v1/vms</code></p>
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
    </div>
  )
}
