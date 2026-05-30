// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import { motion } from 'framer-motion'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import type { Toast } from '../hooks/useToast'
import { formatUserError } from '../utils/apiError'
import { summarizeK8sClientError } from '../utils/k8sErrors'

const icons = {
  success: <CheckCircle className="w-5 h-5 text-green-400" />,
  error: <AlertCircle className="w-5 h-5 text-red-400" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
  info: <Info className="w-5 h-5 text-blue-400" />,
}

const toneBorder = {
  success: 'border-emerald-500/30',
  error: 'border-red-500/30',
  warning: 'border-amber-500/30',
  info: 'border-blue-500/30',
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
            initial={{ opacity: 0, x: 24, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className={`liquid-glass-toast glass-strong flex items-start gap-3 px-4 py-3 min-w-[300px] max-w-lg border ${toneBorder[toast.type]}`}
          >
            {icons[toast.type]}
            <span
              className="flex-1 text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words max-h-40 overflow-y-auto"
              title={display.length > 220 ? display : undefined}
            >
              {display}
            </span>
            <button onClick={() => onClose(toast.id)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </motion.div>
        )
      })}
    </div>
  )
}
