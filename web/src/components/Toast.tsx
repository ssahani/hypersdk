// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

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

const bgColors = {
  success: 'bg-green-900/80 border-green-700',
  error: 'bg-red-900/80 border-red-700',
  warning: 'bg-yellow-900/80 border-yellow-700',
  info: 'bg-blue-900/80 border-blue-700',
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
          <div
            key={toast.id}
            className={`animate-slide-in flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg min-w-[300px] max-w-lg ${bgColors[toast.type]}`}
          >
            {icons[toast.type]}
            <span
              className="flex-1 text-sm text-white whitespace-pre-wrap break-words max-h-40 overflow-y-auto"
              title={display.length > 220 ? display : undefined}
            >
              {display}
            </span>
            <button onClick={() => onClose(toast.id)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
