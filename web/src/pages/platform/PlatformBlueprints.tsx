// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Workflow, Play, Trash2, Plus } from 'lucide-react'
import { MacSectionTitle } from '../../components/platform/mac/PlatformMacUi'
import ErrorBanner from '../../components/ErrorBanner'
import { createBlueprint, deleteBlueprint, listBlueprints, listPlatformVms, runBlueprint, type Blueprint } from '../../api/platform'
import { aiGenerateBlueprint } from '../../api/ai'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'

export default function PlatformBlueprints() {
  const toast = useToastContext()
  const [rows, setRows] = useState<Blueprint[]>([])
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('Nightly backup')
  const [actions, setActions] = useState('backup')
  const [nlPrompt, setNlPrompt] = useState('Nightly backup for all production VMs')
  const [preview, setPreview] = useState<{ name: string; description: string; actions: string[] } | null>(null)
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      setRows(await listBlueprints())
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const createFromVms = async () => {
    try {
      const vms = await listPlatformVms()
      const actionList = actions.split(',').map((a) => a.trim()).filter(Boolean)
      await createBlueprint({
        name,
        description: 'Automation blueprint',
        actions: actionList,
        vm_ids: vms.slice(0, 5).map((v) => v.id),
      })
      toast.success('Blueprint created')
      await load()
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    }
  }

  return (
    <div className="space-y-6">
      <MacSectionTitle title="Blueprint Studio" subtitle="NL → blueprint preview → deploy automation across VM sets." />
      {error && <ErrorBanner message={error} />}
      <div className="card p-4 space-y-3">
        <h3 className="font-semibold text-sm">Generate from description</h3>
        <textarea className="input min-h-20" value={nlPrompt} onChange={(e) => setNlPrompt(e.target.value)} placeholder="Backup all Windows VMs every night" />
        <div className="flex gap-2 flex-wrap">
          <button type="button" className="btn-primary text-sm" disabled={generating} onClick={async () => {
            setGenerating(true)
            try {
              const r = await aiGenerateBlueprint(nlPrompt)
              setPreview({ name: r.name, description: r.description, actions: r.actions })
              setName(r.name)
              setActions(r.actions.join(','))
            } catch (e: unknown) { toast.error(formatUserError(e)) }
            finally { setGenerating(false) }
          }}>{generating ? 'Generating…' : 'Preview blueprint'}</button>
          {preview && (
            <button type="button" className="btn-secondary text-sm" onClick={() => void createFromVms()}>Deploy preview</button>
          )}
        </div>
        {preview && (
          <p className="text-xs text-slate-400">{preview.description} · actions: {preview.actions.join(', ')}</p>
        )}
      </div>
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <label className="text-sm">Name<input className="input block mt-1" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="text-sm">Actions (comma-separated)<input className="input block mt-1" value={actions} onChange={(e) => setActions(e.target.value)} placeholder="start,stop,backup" /></label>
        <button type="button" className="btn-primary flex items-center gap-2" onClick={() => void createFromVms()}><Plus className="w-4 h-4" /> Create from VMs</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((bp) => (
          <article key={bp.id} className="card p-5 space-y-3">
            <h3 className="font-semibold">{bp.name}</h3>
            <p className="text-xs text-slate-500">{bp.description || 'No description'}</p>
            <p className="text-xs text-slate-400">{(bp.actions ?? []).join(', ')} · {bp.vm_ids?.length ?? 0} VMs</p>
            <div className="flex gap-2">
              <button type="button" className="btn-primary text-xs flex items-center gap-1" onClick={async () => {
                try {
                  const r = await runBlueprint(bp.id)
                  toast.success(`Queued ${r.task_ids.length} task(s)`)
                } catch (e: unknown) { toast.error(formatUserError(e)) }
              }}><Play className="w-3 h-3" /> Run</button>
              <button type="button" className="btn-danger text-xs flex items-center gap-1" onClick={async () => {
                try { await deleteBlueprint(bp.id); toast.success('Deleted'); await load() } catch (e: unknown) { toast.error(formatUserError(e)) }
              }}><Trash2 className="w-3 h-3" /> Delete</button>
            </div>
          </article>
        ))}
      </div>
      {rows.length === 0 && !error && <p className="text-slate-500 text-sm">Create a blueprint to automate recurring operations.</p>}
    </div>
  )
}
