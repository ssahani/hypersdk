import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Search, Plus, Camera, Server, Play, Square, Power, Terminal, ArrowRight, Network, HardDrive, Clock, Star, Boxes, Upload } from 'lucide-react'
import { listVMs, startVM, stopVM, shutdownVM, VmInfo } from '../api/vm'
import { listNetworks, NetworkInfo } from '../api/network'
import { listPools, StoragePoolInfo } from '../api/storage'
import { listAllSnapshots, SnapshotInfo } from '../api/snapshot'
import { useToastContext } from '../contexts/ToastContext'
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut'
import { navGroups, isOpenStackConfigured, navItemVisible } from '../utils/routes'
import { usePlatformInfo } from '../contexts/PlatformInfoContext'
import { useOpenStackConnection } from '../hooks/useOpenStackConnection'
import { useAuth } from '../contexts/AuthContext'
import { getStateBadgeClasses } from '../utils/vm'
import { getRecentVMs } from '../utils/recentVMs'
import { getPinnedVMs } from '../utils/pinnedVMs'

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
  const [networks, setNetworks] = useState<NetworkInfo[]>([])
  const [pools, setPools] = useState<StoragePoolInfo[]>([])
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const toast = useToastContext()
  const { info } = usePlatformInfo()
  const { username } = useAuth()
  const openstackConfigured = isOpenStackConfigured(info?.openstack)
  const { phase: osPhase } = useOpenStackConnection()
  const osLive = osPhase === 'live'
  const hypersdkEnabled = Boolean(info?.hypersdk?.enabled)

  const toggle = useCallback(() => setOpen(o => !o), [])

  useKeyboardShortcut({ key: 'k', ctrl: true, handler: toggle })

  // Fetch VMs when palette opens
  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelectedIndex(0)
    setLoading(true)
    Promise.allSettled([listVMs(), listNetworks(), listPools(), listAllSnapshots()])
      .then(([vmR, netR, poolR, snapR]) => {
        setVMs(vmR.status === 'fulfilled' ? vmR.value : [])
        setNetworks(netR.status === 'fulfilled' ? netR.value : [])
        setPools(poolR.status === 'fulfilled' ? poolR.value : [])
        setSnapshots(snapR.status === 'fulfilled' ? snapR.value : [])
      })
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

  // Recent VMs
  const recentNames = getRecentVMs()
  for (const rName of recentNames) {
    items.push({
      id: `recent-${rName}`,
      icon: <Clock className="w-4 h-4" />,
      label: rName,
      action: () => go(`/vms/${rName}`),
      category: 'Recent',
    })
  }

  // Pinned VMs
  const pinnedNames = getPinnedVMs()
  for (const pName of pinnedNames) {
    if (recentNames.includes(pName)) continue // avoid duplicates with Recent
    items.push({
      id: `pinned-${pName}`,
      icon: <Star className="w-4 h-4" />,
      label: pName,
      action: () => go(`/vms/${pName}`),
      category: 'Pinned',
    })
  }

  // Quick actions
  items.push(
    { id: 'qa-create', icon: <Plus className="w-4 h-4" />, label: 'Create VM', action: () => go('/create'), category: 'Quick Actions' },
    { id: 'qa-host-ssh', icon: <Terminal className="w-4 h-4" />, label: 'Host SSH (hypervisor)', action: () => go('/host-ssh'), category: 'Quick Actions' },
    { id: 'qa-snap', icon: <Camera className="w-4 h-4" />, label: 'Snapshots', action: () => go('/snapshots'), category: 'Quick Actions' },
    { id: 'qa-disk-images', icon: <HardDrive className="w-4 h-4" />, label: 'Disk Images', sublabel: 'g i', action: () => go('/disk-images'), category: 'Quick Actions' },
    {
      id: 'qa-kubevirt-upload',
      icon: <Upload className="w-4 h-4" />,
      label: 'Upload qcow2 to KubeVirt',
      sublabel: 'last picked qcow2',
      action: () => go('/disk-images?kv=open'),
      category: 'Quick Actions',
    },
    { id: 'qa-kubevirt-workloads', icon: <Boxes className="w-4 h-4" />, label: 'KubeVirt Workloads', sublabel: 'g k', action: () => go('/k8s/workloads'), category: 'Quick Actions' },
  )
  const osHint = osLive ? 'g o' : osPhase === 'unreachable' ? 'unreachable' : 'wire cloud first'
  items.push(
    { id: 'qa-openstack', icon: <Server className="w-4 h-4" />, label: 'OpenStack overview', sublabel: osHint, action: () => go('/openstack'), category: 'Quick Actions' },
    { id: 'qa-openstack-instances', icon: <Server className="w-4 h-4" />, label: 'OpenStack instances', sublabel: osHint, action: () => go('/openstack/instances'), category: 'Quick Actions' },
    { id: 'qa-openstack-create', icon: <Plus className="w-4 h-4" />, label: 'Create OpenStack instance', sublabel: osHint, action: () => go('/openstack/create'), category: 'Quick Actions' },
    { id: 'qa-openstack-images', icon: <HardDrive className="w-4 h-4" />, label: 'OpenStack Glance images', sublabel: osHint, action: () => go('/openstack/images'), category: 'Quick Actions' },
  )
  if (hypersdkEnabled) {
    items.push(
      { id: 'qa-openstack-migrations', icon: <Server className="w-4 h-4" />, label: 'OpenStack migrations', sublabel: osHint, action: () => go('/openstack/migrations'), category: 'Quick Actions' },
    )
  }
  if (!openstackConfigured) {
    items.push({
      id: 'qa-openstack-setup',
      icon: <Server className="w-4 h-4" />,
      label: 'Wire OpenStack on this host',
      sublabel: 'Settings',
      action: () => go('/settings?openstack=1'),
      category: 'Setup',
    })
  }

  // Navigation pages
  for (const group of navGroups) {
    for (const item of group.items) {
      if (!navItemVisible(item, username, openstackConfigured, hypersdkEnabled)) continue
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

  // Networks
  for (const net of networks) {
    items.push({
      id: `net-${net.name}`, icon: <Network className="w-4 h-4" />, label: net.name,
      badge: <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${net.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{net.active ? 'active' : 'inactive'}</span>,
      action: () => go('/networks'), category: 'Networks',
    })
  }

  // Storage Pools
  for (const pool of pools) {
    items.push({
      id: `pool-${pool.name}`, icon: <HardDrive className="w-4 h-4" />, label: pool.name,
      badge: <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${pool.state === 'running' ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>{pool.state}</span>,
      action: () => go('/storage'), category: 'Storage Pools',
    })
  }

  // Snapshots
  for (const snap of snapshots) {
    items.push({
      id: `snap-${snap.vm_name}-${snap.name}`, icon: <Camera className="w-4 h-4" />,
      label: `${snap.vm_name} / ${snap.name}`,
      action: () => go(`/vms/${snap.vm_name}`), category: 'Snapshots',
    })
  }

  // Filter
  const q = query.toLowerCase()
  const filtered = q ? items.filter(i => i.label.toLowerCase().includes(q) || (i.sublabel || '').toLowerCase().includes(q)) : items

  // Group by category
  const categories = ['Recent', 'Pinned', 'Quick Actions', 'Pages', 'Virtual Machines', 'Networks', 'Storage Pools', 'Snapshots']
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
