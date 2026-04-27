import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { summarizeK8sClientError, TLS_K8S_HINTS } from '../utils/k8sErrors'

type Props = {
  title: string
  message: string
  onDismiss?: () => void
}

export default function K8sConnectionErrorBanner({ title, message, onDismiss }: Props) {
  const s = useMemo(() => summarizeK8sClientError(message), [message])

  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 space-y-3"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-sm font-semibold text-amber-100">{title}</h3>
          <p className="text-sm text-amber-50/95 leading-relaxed">{s.headline}</p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-amber-200/80 hover:text-amber-50 shrink-0 px-2 py-1 rounded border border-amber-500/30"
          >
            Dismiss
          </button>
        )}
      </div>

      {s.tlsUnknownAuthority && (
        <div className="pl-7 space-y-1.5">
          <p className="text-xs font-medium text-amber-200/90">What usually fixes it</p>
          <ul className="text-xs text-amber-100/85 list-disc pl-4 space-y-1">
            {TLS_K8S_HINTS.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      <details className="pl-7 group">
        <summary className="text-xs text-amber-200/80 cursor-pointer hover:text-amber-100">
          Technical details (from kubectl)
        </summary>
        <pre className="mt-2 text-[11px] leading-snug text-slate-300 bg-slate-950/80 border border-slate-700/80 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-56 overflow-y-auto">
          {s.dedupedDetail}
        </pre>
      </details>
    </div>
  )
}
