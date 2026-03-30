import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router'
import { listVMs, startVM, stopVM, shutdownVM, pauseVM, resumeVM, deleteVM, VmInfo } from '../api/vm'
import { getStateBadgeClasses } from '../utils/vm'
import { useToastContext } from '../contexts/ToastContext'
import { useWebSocketContext } from '../contexts/WebSocketContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { getAllTags, getVmTags } from '../api/extras'
import { Play, Square, Power, Pause, RotateCcw, Trash2, Search, RefreshCw, Terminal, Tag } from 'lucide-react'

export default function VMList() {
  const [vms, setVMs] = useState<VmInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [vmTagsMap, setVmTagsMap] = useState<Record<string, string[]>>({})
  const [allTagNames, setAllTagNames] = useState<string[]>([])
  const [tagFilter, setTagFilter] = useState('')
  const toast = useToastContext()
  const { subscribe } = useWebSocketContext()

  const load = useCallback(async () => {
    try {
      const vmList = await listVMs()
      setVMs(vmList)
      // Load tags for all VMs
      const tagMap: Record<string, string[]> = {}
      await Promise.all(vmList.map(async (vm) => {
        try { const t = await getVmTags(vm.name); tagMap[vm.name] = t.tags } catch { /* optional */ }
      }))
      setVmTagsMap(tagMap)
      // Load all unique tag names
      try { const counts = await getAllTags(); setAllTagNames(Object.keys(counts).sort()) } catch { /* optional */ }
    } catch (e: unknown) {
      toast.error(`Failed to load VMs: ${e instanceof Error ? e.message : e}`)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const unsubscribe = subscribe(() => load())
    return () => unsubscribe()
  }, [subscribe, load])

  const action = async (name: string, fn: (n: string) => Promise<void>, label: string) => {
    try {
      await fn(name)
      toast.success(`${label} '${name}' OK`)
      load()
    } catch (e: unknown) {
      toast.error(`${label} '${name}' failed: ${e instanceof Error ? e.message : e}`)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await action(deleteTarget, deleteVM, 'Delete')
    setDeleteTarget(null)
  }

  const filtered = vms.filter((v) => {
    const matchesSearch = v.name.toLowerCase().includes(search.toLowerCase()) || v.state.includes(search.toLowerCase())
    const matchesTag = !tagFilter || (vmTagsMap[v.name] || []).includes(tagFilter)
    return matchesSearch && matchesTag
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Virtual Machines</h1>
        <div className="flex items-center gap-3">
          <button onClick={load} className="p-2 hover:bg-gray-700 rounded transition" title="Refresh" aria-label="Refresh VM list">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link to="/create" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition">+ Create VM</Link>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search VMs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        {allTagNames.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-gray-400" />
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg text-sm py-2 px-3 focus:outline-none focus:border-blue-500 text-gray-300"
            >
              <option value="">All tags</option>
              {allTagNames.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center text-gray-500">
          {search ? 'No VMs match your search.' : 'No VMs found. Create one to get started.'}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700 text-left text-sm text-gray-400">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">State</th>
                <th className="px-6 py-3 hidden md:table-cell">vCPUs</th>
                <th className="px-6 py-3 hidden md:table-cell">Memory</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filtered.map((vm) => (
                <tr key={vm.name} className="hover:bg-gray-700/50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={`/vms/${vm.name}`} className="font-medium text-blue-400 hover:text-blue-300">{vm.name}</Link>
                      {(vmTagsMap[vm.name] || []).map(t => (
                        <span key={t} className="px-1.5 py-0.5 bg-blue-600/20 text-blue-400 rounded-full text-[10px] font-medium">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStateBadgeClasses(vm.state)}`}>{vm.state}</span>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell text-gray-300">{vm.vcpus}</td>
                  <td className="px-6 py-4 hidden md:table-cell text-gray-300">{vm.memory_mb} MB</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {vm.state === 'running' && (
                        <Link to={`/vms/${vm.name}/console`} className="p-1.5 hover:bg-gray-600/30 rounded transition" title="Console">
                          <Terminal className="w-4 h-4 text-gray-300" />
                        </Link>
                      )}
                      {vm.state === 'shutoff' && (
                        <button onClick={() => action(vm.name, startVM, 'Start')} className="p-1.5 hover:bg-green-600/20 rounded transition" title="Start">
                          <Play className="w-4 h-4 text-green-400" />
                        </button>
                      )}
                      {vm.state === 'running' && (
                        <>
                          <button onClick={() => action(vm.name, shutdownVM, 'Shutdown')} className="p-1.5 hover:bg-yellow-600/20 rounded transition" title="Shutdown">
                            <Power className="w-4 h-4 text-yellow-400" />
                          </button>
                          <button onClick={() => action(vm.name, stopVM, 'Stop')} className="p-1.5 hover:bg-red-600/20 rounded transition" title="Force Stop">
                            <Square className="w-4 h-4 text-red-400" />
                          </button>
                          <button onClick={() => action(vm.name, pauseVM, 'Pause')} className="p-1.5 hover:bg-blue-600/20 rounded transition" title="Pause">
                            <Pause className="w-4 h-4 text-blue-400" />
                          </button>
                        </>
                      )}
                      {vm.state === 'paused' && (
                        <button onClick={() => action(vm.name, resumeVM, 'Resume')} className="p-1.5 hover:bg-green-600/20 rounded transition" title="Resume">
                          <RotateCcw className="w-4 h-4 text-green-400" />
                        </button>
                      )}
                      <button onClick={() => setDeleteTarget(vm.name)} className="p-1.5 hover:bg-red-600/20 rounded transition" title="Delete">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete VM"
        message={`This will permanently delete VM '${deleteTarget}' and stop it if running.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
