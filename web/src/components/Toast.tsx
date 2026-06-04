// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import type { Toast } from '../hooks/useToast'
import { formatUserError } from '../utils/apiError'
import { summarizeK8sClientError } from '../utils/k8sErrors'
import { statusBorderClass, statusToneClass, toastSemanticTone } from '../utils/semanticColors'

const icons = {
  success: <CheckCircle className={`w-5 h-5 ${statusToneClass('ok')}`} />,
  error: <AlertCircle className={`w-5 h-5 ${statusToneClass('error')}`} />,
  warning: <AlertTriangle className={`w-5 h-5 ${statusToneClass('warn')}`} />,
  info: <Info className={`w-5 h-5 ${statusToneClass('info')}`} />,
}

function displayErrorMessage(raw: string): string {
  const sanitized = formatUserError(new Error(raw))
  const lower = sanitized.toLowerCase()
  const looksK8s =
    lower.includes('kubectl') ||
    lower.includes('kubeconfig') ||
    lower.includes('certificate signed by unknown authority') ||
    lower.includes('memcache.go')
  if (looksK8s && sanitized.length > 200) {
    return summarizeK8sClientError(sanitized).headline
  }
  if (sanitized.length > 320) {
    return `${sanitized.slice(0, 317)}…`
  }
  return sanitized
}

export function ToastContainer({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => {
        const display =
          toast.type === 'error' ? displayErrorMessage(toast.message) : toast.message
        return (
          <motion.div
            key={toast.id}
            initial={{ opacity: 1, x: 12, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className={`liquid-glass-toast glass-strong flex items-start gap-3 px-4 py-3 min-w-[300px] max-w-lg border ${statusBorderClass(toastSemanticTone(toast.type))}`}
          >
            {icons[toast.type]}
            <div className="flex-1 min-w-0">
              <span
                className="block text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words max-h-40 overflow-y-auto"
                title={display.length > 220 ? display : undefined}
              >
                {display}
              </span>
              {toast.action && (
                <Link
                  to={toast.action.href}
                  data-testid="toast-action-link"
                  className="inline-block mt-2 text-xs font-medium text-sky-400 hover:text-sky-300"
                  onClick={() => onClose(toast.id)}
                >
                  {toast.action.label} →
                </Link>
              )}
            </div>
            <button onClick={() => onClose(toast.id)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </motion.div>
        )
      })}
    </div>
  )
}
