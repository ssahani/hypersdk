import { X } from 'lucide-react'

const shortcuts = [
  { keys: ['Ctrl', 'K'], description: 'Command palette' },
  { keys: ['g', 'd'], description: 'Go to Dashboard' },
  { keys: ['g', 'v'], description: 'Go to Virtual Machines' },
  { keys: ['g', 'n'], description: 'Go to Networks' },
  { keys: ['g', 's'], description: 'Go to Storage' },
  { keys: ['g', 'c'], description: 'Create VM' },
  { keys: ['g', 'e'], description: 'Go to Live Metrics' },
  { keys: ['g', 'b'], description: 'Go to Backups' },
  { keys: ['g', 'i'], description: 'Go to Disk Images' },
  { keys: ['g', 'k'], description: 'Go to KubeVirt Workloads' },
  { keys: ['g', 'o'], description: 'Go to OpenStack overview (when wired)' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
]

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="px-1.5 py-0.5 bg-slate-700 border border-slate-600 rounded text-xs font-mono text-slate-300 min-w-[1.5rem] text-center">
      {children}
    </kbd>
  )
}

export default function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-fade-in flex items-center justify-center" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-lg transition text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {shortcuts.map(s => (
            <div key={s.description} className="flex items-center justify-between">
              <span className="text-sm text-slate-300">{s.description}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-slate-600 text-xs">+</span>}
                    <Kbd>{k}</Kbd>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-slate-700/50 space-y-2 text-xs text-slate-500">
          <p>Shortcuts are disabled when typing in input fields.</p>
          <p className="text-center"></p>
        </div>
      </div>
    </div>
  )
}
