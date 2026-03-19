import { AlertTriangle, X } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  variant?: 'danger' | 'warning'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', variant = 'danger', onConfirm, onCancel }: Props) {
  if (!open) return null

  const btnColor = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/20'
    : 'bg-yellow-600 hover:bg-yellow-500 shadow-lg shadow-yellow-600/20'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onCancel}>
      <div className="bg-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
            </div>
            <span className="text-lg font-semibold">{title}</span>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded-lg transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 text-slate-300 text-sm leading-relaxed">{message}</div>
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onCancel} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition">Cancel</button>
          <button onClick={onConfirm} className={`px-4 py-2 ${btnColor} rounded-lg text-sm text-white font-medium transition`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
