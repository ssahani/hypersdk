import { useEffect, useState, useCallback, useRef } from 'react'
import { getJournalLogs, JournalEntry } from '../api/extras'
import { RefreshCw, Search } from 'lucide-react'

const PRIORITIES = ['emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info', 'debug'] as const
const LINE_COUNTS = [50, 100, 500, 1000] as const

function priorityColor(p: string): string {
  switch (p) {
    case 'emerg': case 'alert': case 'crit': case 'err':
      return 'text-red-400'
    case 'warning':
      return 'text-yellow-400'
    case 'notice':
      return 'text-blue-300'
    case 'debug':
      return 'text-slate-500'
    default:
      return 'text-slate-300'
  }
}

function priorityBg(p: string): string {
  switch (p) {
    case 'emerg': case 'alert': case 'crit': case 'err':
      return 'bg-red-500/10 border-l-2 border-red-500/50'
    case 'warning':
      return 'bg-yellow-500/5 border-l-2 border-yellow-500/40'
    default:
      return ''
  }
}

export default function LogsPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [priority, setPriority] = useState('')
  const [unit, setUnit] = useState('')
  const [lineCount, setLineCount] = useState(100)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await getJournalLogs(lineCount, priority || undefined, unit || undefined)
      setEntries(data)
    } catch (e) {
      console.error('Failed to load logs:', e)
    } finally {
      setLoading(false)
    }
  }, [lineCount, priority, unit])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(load, 5000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoRefresh, load])

  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">System Logs</h1>
          <p className="text-sm text-slate-400 mt-0.5">journald log viewer</p>
        </div>
        <button onClick={load} className="p-2 hover:bg-slate-700 rounded-lg transition" aria-label="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={priority}
          onChange={e => setPriority(e.target.value)}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          <option value="">All priorities</option>
          {PRIORITIES.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Filter by unit (e.g. sshd, virtspawn-daemon)"
            value={unit}
            onChange={e => setUnit(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>

        <select
          value={lineCount}
          onChange={e => setLineCount(Number(e.target.value))}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          {LINE_COUNTS.map(n => (
            <option key={n} value={n}>{n} lines</option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={e => setAutoRefresh(e.target.checked)}
            className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/50"
          />
          Auto-refresh
        </label>
      </div>

      {/* Log entries */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto font-mono text-xs">
          {entries.length === 0 ? (
            <div className="text-center text-slate-500 py-12">No log entries found.</div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-800 z-10">
                <tr className="border-b border-slate-700/50 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-3 py-2 whitespace-nowrap">Timestamp</th>
                  <th className="text-left px-3 py-2">Priority</th>
                  <th className="text-left px-3 py-2">Unit</th>
                  <th className="text-left px-3 py-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <tr key={i} className={`border-b border-slate-700/10 ${priorityBg(entry.priority)}`}>
                    <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{entry.timestamp}</td>
                    <td className={`px-3 py-1.5 font-semibold ${priorityColor(entry.priority)}`}>{entry.priority}</td>
                    <td className="px-3 py-1.5 text-blue-400 whitespace-nowrap">{entry.unit}</td>
                    <td className={`px-3 py-1.5 ${priorityColor(entry.priority)} break-all`}>{entry.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
