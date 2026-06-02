// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Sparkles } from 'lucide-react'
import AskZeusButton from '../ai/AskZeusButton'
import { MacGlassPanel } from './mac/PlatformMacUi'
import {
  enqueueValidateHost,
  syncHost,
  installGuestTools,
  runVmHealthCheck,
  type HostOsDiagnoseReport,
  type VmOsDiagnoseReport,
  type OsDiagnoseAction,
} from '../../api/platform'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'
import { hubLinkClasses } from '../../utils/semanticColors'

type OsDiagnoseReport = HostOsDiagnoseReport | VmOsDiagnoseReport

interface OsDiagnosePanelProps {
  resourceId: string
  resourceKind: 'host' | 'vm'
  defaultQuery?: string
  loading: boolean
  report: OsDiagnoseReport | null
  onRun: (query?: string) => void
  onAskCopilot?: () => void
}

export default function OsDiagnosePanel({
  resourceId,
  resourceKind,
  defaultQuery,
  loading,
  report,
  onRun,
  onAskCopilot,
}: OsDiagnosePanelProps) {
  const toast = useToastContext()
  const navigate = useNavigate()
  const [query, setQuery] = useState(defaultQuery ?? '')

  const runFix = async (fix: OsDiagnoseAction) => {
    try {
      switch (fix.action) {
        case 'host.sync':
          await syncHost(resourceId)
          toast.success('Host sync queued')
          break
        case 'host.validate':
          await enqueueValidateHost(resourceId)
          toast.success('Validation queued')
          break
        case 'firewall.open':
          navigate(`/platform/zeus/security/firewall/${resourceId}`)
          break
        case 'nav.storage':
          navigate('/platform/storage')
          break
        case 'vm.guest_tools':
          await installGuestTools(resourceId)
          toast.success('Guest tools install queued')
          break
        case 'vm.health_check':
          await runVmHealthCheck(resourceId)
          toast.success('Health check queued')
          break
        default:
          if (fix.detail.startsWith('/')) navigate(fix.detail)
          return
      }
      onRun(query || undefined)
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    }
  }

  return (
    <MacGlassPanel
      title="Machina OS Diagnose"
      subtitle={resourceKind === 'host' ? 'Hypervisor Linux + fleet correlation' : 'Guest health + ports context'}
      action={
        onAskCopilot ? (
          <AskZeusButton variant="secondary" className="text-xs" onClick={onAskCopilot} />
        ) : undefined
      }
    >
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          className="input text-sm flex-1 min-w-[12rem]"
          placeholder={resourceKind === 'host' ? 'Why is this host under pressure?' : 'Guest health and exposed ports'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" className="btn-primary text-sm flex items-center gap-1" disabled={loading} onClick={() => onRun(query || undefined)}>
          <Sparkles className="w-4 h-4" />
          {loading ? 'Diagnosing…' : 'Diagnose'}
        </button>
      </div>
      {report && (
        <div className="space-y-3 text-sm">
          <p className="text-slate-300">{report.summary}</p>
          {report.hypotheses.map((h) => (
            <div key={h.title} className="rounded-xl border border-white/[0.06] bg-slate-950/40 p-3">
              <div className="flex justify-between gap-2 mb-1">
                <span className="font-medium text-slate-100">{h.title}</span>
                <span className="text-xs text-violet-300">{Math.round(h.confidence * 100)}%</span>
              </div>
              <p className="text-xs text-slate-400">{h.evidence}</p>
              <p className="text-xs text-slate-500 mt-1">{h.action}</p>
            </div>
          ))}
          {report.fix_actions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {report.fix_actions.map((fix) => (
                <button key={fix.action} type="button" className="btn-secondary text-xs" onClick={() => void runFix(fix)}>
                  {fix.label}
                </button>
              ))}
            </div>
          )}
          {resourceKind === 'host' && (
            <Link to={`/platform/hosts/${resourceId}`} className={`text-xs ${hubLinkClasses()}`}>Host settings →</Link>
          )}
        </div>
      )}
    </MacGlassPanel>
  )
}
