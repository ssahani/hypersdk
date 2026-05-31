// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { MacGlassPanel, MacSectionTitle } from '../../../components/platform/mac/PlatformMacUi'
import ErrorBanner from '../../../components/ErrorBanner'
import {
  getFirewallCompliance,
  exportFirewallSiem,
  getPacketwolfAnomalies,
  listFirewallApprovals,
  approveFirewallChange,
  rejectFirewallChange,
  exportFirewallGitOps,
  syncFirewallGitOps,
  firewallCompliancePdfUrl,
  type FirewallApproval,
  type FirewallApprovalApplyResult,
} from '../../../api/zeusFirewall'
import JsonInspector, { asRecord } from '../../../components/platform/JsonInspector'
import { ComplianceReportSummary, PacketwolfAnomalySummary } from '../../../components/platform/FirewallComplianceViews'
import { formatUserError } from '../../../utils/apiError'
import { useToastContext } from '../../../contexts/ToastContext'

const REPORTS = [
  'production',
  'public-exposure',
  'ssh-exposure',
  'database-exposure',
  'drift',
  'temporary-access',
]

export default function PlatformFirewallCompliance() {
  const toast = useToastContext()
  const [report, setReport] = useState<Record<string, unknown> | null>(null)
  const [kind, setKind] = useState('production')
  const [error, setError] = useState<string | null>(null)
  const [approvals, setApprovals] = useState<FirewallApproval[]>([])
  const [approvalsLoading, setApprovalsLoading] = useState(false)
  const [packetwolf, setPacketwolf] = useState<Record<string, unknown> | null>(null)
  const [packetwolfLoading, setPacketwolfLoading] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const r = await getFirewallCompliance(kind)
      setReport(r)
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [kind])

  const loadApprovals = useCallback(async () => {
    setApprovalsLoading(true)
    try {
      const rows = await listFirewallApprovals('pending')
      setApprovals(rows)
    } catch (e: unknown) {
      setError(formatUserError(e))
    } finally {
      setApprovalsLoading(false)
    }
  }, [])

  const loadPacketwolf = useCallback(async () => {
    setPacketwolfLoading(true)
    try {
      setPacketwolf(await getPacketwolfAnomalies())
    } catch (e: unknown) {
      setError(formatUserError(e))
    } finally {
      setPacketwolfLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => { void loadApprovals() }, [loadApprovals])
  useEffect(() => { void loadPacketwolf() }, [loadPacketwolf])

  return (
    <div className="space-y-6">
      <MacSectionTitle title="Firewall Compliance" subtitle="Production exposure, approvals, Packetwolf anomalies, and GitOps policy sync" />
      <div className="flex flex-wrap gap-3 text-sm">
        <Link to="/platform/zeus/security/firewall" className="text-blue-400">← Firewall overview</Link>
        <Link to="/platform/placement" className="text-blue-400">HA & fence events →</Link>
      </div>
      {error && <ErrorBanner message={error} />}
      <MacGlassPanel title="Pending approvals" action={
        <button type="button" className="text-xs text-blue-400" onClick={() => void loadApprovals()}>
          Refresh
        </button>
      }>
        {approvalsLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : approvals.length === 0 ? (
          <p className="text-sm text-slate-400">No pending firewall change approvals.</p>
        ) : (
          <ul className="space-y-3">
            {approvals.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border border-slate-700/60 rounded-lg p-3">
                <div>
                  <p className="text-sm text-slate-200">{a.profile ?? 'custom'} on host {a.target_id.slice(0, 8)}…</p>
                  <p className="text-xs text-slate-500">Requested by {a.requested_by} · {a.created_at}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded bg-emerald-700 text-white"
                    onClick={() => void approveFirewallChange(a.id).then((r: FirewallApprovalApplyResult) => {
                      toast.success(r.message)
                      return loadApprovals()
                    })}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-200"
                    onClick={() => void rejectFirewallChange(a.id).then(() => loadApprovals())}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </MacGlassPanel>
      <MacGlassPanel title="Packetwolf anomalies" action={
        <button type="button" className="text-xs text-blue-400" onClick={() => void loadPacketwolf()}>
          Refresh
        </button>
      }>
        {packetwolfLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : packetwolf ? (
          <JsonInspector data={packetwolf} emptyMessage="No Packetwolf data.">
            {asRecord(packetwolf) && <PacketwolfAnomalySummary data={asRecord(packetwolf)!} />}
          </JsonInspector>
        ) : (
          <p className="text-sm text-slate-400">No Packetwolf anomaly feed — enable Zeus Firewall deep inspection.</p>
        )}
      </MacGlassPanel>
      <div className="flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setKind(r)}
            className={`text-xs px-3 py-1.5 rounded-lg ${kind === r ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}
          >
            {r}
          </button>
        ))}
      </div>
      {report && (
        <MacGlassPanel title={`Report: ${kind}`} action={
          <div className="flex gap-3">
            <button type="button" className="text-xs text-blue-400" onClick={() => void exportFirewallGitOps().then((r) => {
              const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'machine-firewall-policies.json'
              a.click()
              URL.revokeObjectURL(url)
            })}>
              Export GitOps
            </button>
            <button type="button" className="text-xs text-emerald-400" onClick={() => void exportFirewallGitOps().then((r) =>
              syncFirewallGitOps(r.policies ?? [], false).then((s) => toast.success(`Synced ${s.upserted} policies`))
            ).catch((e: unknown) => toast.error(formatUserError(e)))}>
              Sync GitOps
            </button>
            <a href={firewallCompliancePdfUrl(kind)} className="text-xs text-blue-400" target="_blank" rel="noreferrer">
              Export PDF
            </a>
            <button type="button" className="text-xs text-blue-400" onClick={() => void exportFirewallSiem(168).then((r) => {
              const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'zeus-firewall-siem-export.json'
              a.click()
              URL.revokeObjectURL(url)
            })}>
              Export SIEM JSON
            </button>
          </div>
        }>
          <JsonInspector data={report}>
            {asRecord(report) && <ComplianceReportSummary report={asRecord(report)!} />}
          </JsonInspector>
        </MacGlassPanel>
      )}
    </div>
  )
}
