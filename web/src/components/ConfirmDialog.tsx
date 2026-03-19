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

  const btnColor = variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            {title}
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 text-gray-300 text-sm">{message}</div>
        <div className="flex justify-end gap-3 p-4 border-t border-gray-700">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition">Cancel</button>
          <button onClick={onConfirm} className={`px-4 py-2 ${btnColor} rounded text-sm text-white transition`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
