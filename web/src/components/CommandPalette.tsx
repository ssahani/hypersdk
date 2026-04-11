import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Search, Plus, Camera, Server, Play, Square, Power, Terminal, ArrowRight } from 'lucide-react'
import { listVMs, startVM, stopVM, shutdownVM, VmInfo } from '../api/vm'
import { useToastContext } from '../contexts/ToastContext'
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut'
import { navGroups } from '../utils/routes'
import { getStateBadgeClasses } from '../utils/vm'

interface PaletteItem {
  id: string
  icon: React.ReactNode
  label: string
  sublabel?: string
  badge?: React.ReactNode
  action: () => void
  category: string
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [vms, setVMs] = useState<VmInfo[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const toast = useToastContext()

  const toggle = useCallback(() => setOpen(o => !o), [])

  useKeyboardShortcut({ key: 'k', ctrl: true, handler: toggle })

  // Fetch VMs when palette opens
  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelectedIndex(0)
    setLoading(true)
    listVMs()
      .then(setVMs)
      .catch(() => setVMs([]))
      .finally(() => setLoading(false))
  }, [open])

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const close = useCallback(() => { setOpen(false); setQuery('') }, [])

  const go = useCallback((path: string) => { close(); navigate(path) }, [close, navigate])

  const vmAction = useCallback(async (name: string, fn: (n: string) => Promise<void>, label: string) => {
    close()
    try {
      await fn(name)
      toast.success(`${label} '${name}' OK`)
    } catch (e: unknown) {
      toast.error(`${label} '${name}' failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, [close, toast])

  // Build items list
  const items: PaletteItem[] = []

  // Quick actions
  items.push(
    { id: 'qa-create', icon: <Plus className="w-4 h-4" />, label: 'Create VM', action: () => go('/create'), category: 'Quick Actions' },
    { id: 'qa-snap', icon: <Camera className="w-4 h-4" />, label: 'Snapshots', action: () => go('/snapshots'), category: 'Quick Actions' },
  )

  // Navigation pages
  for (const group of navGroups) {
    for (const item of group.items) {
      items.push({
        id: `nav-${item.to}`,
        icon: item.icon,
        label: item.label,
        sublabel: group.label,
        action: () => go(item.to),
        category: 'Pages',
      })
    }
  }

  // VMs
  for (const vm of vms) {
    items.push({
      id: `vm-${vm.name}`,
      icon: <Server className="w-4 h-4" />,
      label: vm.name,
      badge: <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getStateBadgeClasses(vm.state)}`}>{vm.state}</span>,
      action: () => go(`/vms/${vm.name}`),
      category: 'Virtual Machines',
    })
    if (vm.state === 'running') {
      items.push(
        { id: `vm-console-${vm.name}`, icon: <Terminal className="w-4 h-4" />, label: `${vm.name} — Console`, action: () => go(`/vms/${vm.name}/console`), category: 'Virtual Machines' },
        { id: `vm-shutdown-${vm.name}`, icon: <Power className="w-4 h-4" />, label: `${vm.name} — Shutdown`, action: () => vmAction(vm.name, shutdownVM, 'Shutdown'), category: 'Virtual Machines' },
        { id: `vm-stop-${vm.name}`, icon: <Square className="w-4 h-4" />, label: `${vm.name} — Force Stop`, action: () => vmAction(vm.name, stopVM, 'Stop'), category: 'Virtual Machines' },
      )
    }
    if (vm.state === 'shutoff') {
      items.push(
        { id: `vm-start-${vm.name}`, icon: <Play className="w-4 h-4" />, label: `${vm.name} — Start`, action: () => vmAction(vm.name, startVM, 'Start'), category: 'Virtual Machines' },
      )
    }
  }

  // Filter
  const q = query.toLowerCase()
  const filtered = q ? items.filter(i => i.label.toLowerCase().includes(q) || (i.sublabel || '').toLowerCase().includes(q)) : items

  // Group by category
  const categories = ['Quick Actions', 'Pages', 'Virtual Machines']
  const grouped = categories
    .map(cat => ({ cat, items: filtered.filter(i => i.category === cat) }))
    .filter(g => g.items.length > 0)

  const flatFiltered = grouped.flatMap(g => g.items)
  const clampedIndex = Math.min(selectedIndex, Math.max(0, flatFiltered.length - 1))

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { close(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, flatFiltered.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter' && flatFiltered.length > 0) {
      e.preventDefault()
      flatFiltered[clampedIndex]?.action()
    }
  }

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${clampedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [clampedIndex])

  // Reset index on query change
  useEffect(() => setSelectedIndex(0), [query])

  if (!open) return null

  let runningIdx = 0

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-fade-in" onClick={close}>
      <div className="fixed inset-x-0 top-[15%] mx-auto max-w-lg px-4" onClick={e => e.stopPropagation()}>
        <div className="bg-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden" onKeyDown={handleKeyDown}>
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-slate-700/50">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search commands, VMs, pages..."
              className="flex-1 py-3.5 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
            />
            <kbd className="px-1.5 py-0.5 bg-slate-700 border border-slate-600 rounded text-[10px] font-mono text-slate-400">Esc</kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="overflow-y-auto max-h-[60vh] py-1">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">Loading...</div>
            ) : flatFiltered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">No results for "{query}"</div>
            ) : (
              grouped.map(({ cat, items: groupItems }) => (
                <div key={cat}>
                  <div className="px-4 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{cat}</div>
                  {groupItems.map(item => {
                    const idx = runningIdx++
                    const selected = idx === clampedIndex
                    return (
                      <button
                        key={item.id}
                        data-index={idx}
                        onClick={() => item.action()}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                          selected ? 'bg-slate-700/60 text-white' : 'text-slate-300 hover:bg-slate-700/40'
                        }`}
                      >
                        <span className="text-slate-400">{item.icon}</span>
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        {item.badge}
                        {item.sublabel && <span className="text-[10px] text-slate-500">{item.sublabel}</span>}
                        {selected && <ArrowRight className="w-3 h-3 text-slate-500" />}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-slate-700/50 flex items-center gap-4 text-[10px] text-slate-500">
            <span><kbd className="px-1 py-0.5 bg-slate-700 border border-slate-600 rounded font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="px-1 py-0.5 bg-slate-700 border border-slate-600 rounded font-mono">↵</kbd> select</span>
            <span><kbd className="px-1 py-0.5 bg-slate-700 border border-slate-600 rounded font-mono">esc</kbd> close</span>
          </div>
        </div>
      </div>
    </div>
  )
}
