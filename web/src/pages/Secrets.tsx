import { useEffect, useState, useCallback } from 'react'
import { listSecrets, deleteSecret, getSecretXml, SecretInfo } from '../api/advanced'
import { useToastContext } from '../contexts/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { Shield, Trash2, RefreshCw, Search, Code, X } from 'lucide-react'

export default function SecretsPage() {
  const [secrets, setSecrets] = useState<SecretInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [xmlContent, setXmlContent] = useState<string | null>(null)
  const [xmlUuid, setXmlUuid] = useState('')
  const toast = useToastContext()

  const load = useCallback(async () => {
    try { setSecrets(await listSecrets()) } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) } finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  const handleDelete = async () => {
    if (!deleteTarget) return
    try { await deleteSecret(deleteTarget); toast.success(`Deleted secret '${deleteTarget}'`); load() } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) }
    setDeleteTarget(null)
  }

  const showXml = async (uuid: string) => {
    try { const xml = await getSecretXml(uuid); setXmlContent(xml); setXmlUuid(uuid) } catch (e: unknown) { toast.error(`${e instanceof Error ? e.message : e}`) }
  }

  const filtered = secrets.filter(s =>
    search === '' ||
    s.uuid.toLowerCase().includes(search.toLowerCase()) ||
    s.usage_type.toLowerCase().includes(search.toLowerCase()) ||
    s.usage_id.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="w-6 h-6" /> Secrets ({secrets.length})</h1>
        <button onClick={load} className="p-2 hover:bg-slate-700 rounded-lg transition"><RefreshCw className="w-4 h-4" /></button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Search secrets..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No secrets found.</div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-slate-700/50 text-left text-sm text-slate-400">
              <th className="px-6 py-3">UUID</th><th className="px-6 py-3 hidden md:table-cell">Usage Type</th><th className="px-6 py-3 hidden md:table-cell">Usage ID</th><th className="px-6 py-3 text-right">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-700/30">
              {filtered.map(s => (
                <tr key={s.uuid} className="table-row-hover">
                  <td className="px-6 py-3 font-mono text-sm">{s.uuid}</td>
                  <td className="px-6 py-3 text-sm text-slate-300 hidden md:table-cell">{s.usage_type}</td>
                  <td className="px-6 py-3 text-sm text-slate-400 hidden md:table-cell">{s.usage_id}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => showXml(s.uuid)} className="p-1.5 hover:bg-blue-600/20 rounded transition" title="View XML"><Code className="w-4 h-4 text-blue-400" /></button>
                      <button onClick={() => setDeleteTarget(s.uuid)} className="p-1.5 hover:bg-red-600/20 rounded transition" title="Delete"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} title="Delete Secret" message={`Delete secret '${deleteTarget}'?`} confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      {xmlContent !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setXmlContent(null)}>
          <div className="bg-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
              <span className="text-lg font-semibold font-mono">{xmlUuid}</span>
              <button onClick={() => setXmlContent(null)} className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded-lg transition"><X className="w-4 h-4" /></button>
            </div>
            <pre className="p-5 text-sm text-slate-300 overflow-auto whitespace-pre-wrap font-mono flex-1">{xmlContent}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
