// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useNavigate } from 'react-router'
import {
  adoptPlatformVm,
  createVmBackup,
  installGuestTools,
  setVmHa,
  vmPower,
  type HealthIssue,
  type VmHealthReport,
} from '../../api/platform'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'

interface HealthCheckPanelProps {
  vmId: string
  report: VmHealthReport | null
  loading: boolean
  onRefresh: () => void
  onTab?: (tab: string) => void
}

export default function HealthCheckPanel({ vmId, report, loading, onRefresh, onTab }: HealthCheckPanelProps) {
  const toast = useToastContext()
  const navigate = useNavigate()

  const fix = async (issue: HealthIssue) => {
    try {
      switch (issue.fix_action) {
        case 'start_vm':
          await vmPower(vmId, 'start')
          toast.success('Start queued')
          break
        case 'adopt_vm':
          await adoptPlatformVm(vmId)
          toast.success('VM adopted')
          break
        case 'enable_ha':
          await setVmHa(vmId, { enabled: true })
          toast.success('HA enabled')
          break
        case 'create_backup':
          await createVmBackup(vmId)
          toast.success('Backup queued')
          break
        case 'open_snapshots':
          onTab?.('snapshots')
          break
        case 'install_guest_tools':
          await installGuestTools(vmId)
          toast.success('Guest tools install queued')
          break
        default:
          return
      }
      onRefresh()
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    }
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Health check</h3>
        <button type="button" className="btn-secondary text-xs" disabled={loading} onClick={onRefresh}>
          {loading ? 'Checking…' : 'Run health check'}
        </button>
      </div>
      {report && (
        <>
          <p className={`text-sm font-medium capitalize ${report.healthy ? 'text-emerald-400' : 'text-amber-400'}`}>
            VM health: {report.score} · {report.checks_passed}/{report.checks_total} checks passed
          </p>
          {report.issues.length === 0 ? (
            <p className="text-sm text-slate-400">All checks passed.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {report.issues.map((issue, i) => (
                <li key={`${issue.id}-${i}`} className="border border-slate-800 rounded-lg p-3">
                  <p className={issue.severity === 'warning' ? 'text-amber-300' : 'text-red-300'}>{issue.message}</p>
                  {issue.remediation && <p className="text-xs text-slate-500 mt-1">{issue.remediation}</p>}
                  {issue.fix_label && issue.fix_action && (
                    <button type="button" className="btn-primary text-xs mt-2" onClick={() => void fix(issue)}>
                      {issue.fix_label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {!report && !loading && (
        <button type="button" className="btn-secondary text-sm" onClick={() => navigate('/platform/tasks')}>View tasks</button>
      )}
    </div>
  )
}
