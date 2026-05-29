// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Bot, Send, X, Zap } from 'lucide-react'
import { useAi } from '../../contexts/AiContext'
import { aiCopilotStream, executeAutopilotAction, getAutopilotProposal, type ProposedAction } from '../../api/ai'
import { usePlatformInfo } from '../../contexts/PlatformInfoContext'
import { useToastContext } from '../../contexts/ToastContext'
import { formatUserError } from '../../utils/apiError'

export default function MachinaCopilot() {
  const { copilotOpen, closeCopilot, contextVmId, mode } = useAi()
  const { info } = usePlatformInfo()
  const toast = useToastContext()
  const platform = Boolean(info?.control_plane?.proxy_url)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([])
  const [busy, setBusy] = useState(false)
  const [proposals, setProposals] = useState<ProposedAction[]>([])
  const [executingId, setExecutingId] = useState<string | null>(null)

  const loadProposals = useCallback(async () => {
    if (!platform || mode === 'off') return
    try {
      const p = await getAutopilotProposal(contextVmId ?? undefined)
      setProposals(p.actions)
    } catch {
      setProposals([])
    }
  }, [platform, mode, contextVmId])

  useEffect(() => {
    if (copilotOpen) void loadProposals()
  }, [copilotOpen, loadProposals])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text }])
    if (!platform) {
      setMessages((m) => [...m, { role: 'assistant', text: 'Connect Zyvor Platform (control plane) to use Machina Copilot.' }])
      return
    }
    setBusy(true)
    const assistantIdx = messages.length + 1
    setMessages((m) => [...m, { role: 'assistant', text: '' }])
    try {
      await aiCopilotStream(text, contextVmId ?? undefined, (ev) => {
        if (ev.type === 'chunk' && ev.text) {
          setMessages((m) => {
            const next = [...m]
            const last = next[assistantIdx]
            if (last?.role === 'assistant') {
              next[assistantIdx] = { role: 'assistant', text: last.text + ev.text }
            }
            return next
          })
        } else if (ev.type === 'error') {
          setMessages((m) => {
            const next = [...m]
            next[assistantIdx] = { role: 'assistant', text: ev.message ?? 'Stream error' }
            return next
          })
        }
      })
    } catch (e: unknown) {
      setMessages((m) => {
        const next = [...m]
        next[assistantIdx] = { role: 'assistant', text: formatUserError(e) }
        return next
      })
    } finally {
      setBusy(false)
    }
  }, [input, busy, platform, contextVmId, messages.length])

  const runAction = async (action: ProposedAction) => {
    setExecutingId(action.id)
    try {
      const r = await executeAutopilotAction(action.action_type, action.object_ref)
      toast.success(r.message)
      setMessages((m) => [...m, { role: 'assistant', text: `✓ ${r.message}` }])
      await loadProposals()
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    } finally {
      setExecutingId(null)
    }
  }

  if (!copilotOpen || mode === 'off') return null

  const modeLabel = mode === 'autopilot' ? 'Autopilot — low-risk fixes run in batch' : mode === 'autopilot_preview' ? 'Autopilot preview — confirm each action' : 'Advisor mode'

  return (
    <>
      <div className="fixed inset-0 z-[55] bg-black/20 lg:hidden" onClick={closeCopilot} aria-hidden />
      <aside className="fixed right-0 top-0 bottom-0 z-[56] w-full max-w-md border-l border-white/[0.08] bg-slate-900/98 backdrop-blur-xl flex flex-col shadow-2xl animate-fade-in">
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-orange-400" />
            <div>
              <p className="font-semibold text-sm">Machina Copilot</p>
              <p className="text-[10px] text-slate-500">{modeLabel}</p>
            </div>
          </div>
          <button type="button" onClick={closeCopilot} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </header>
        {proposals.length > 0 && (
          <div className="px-4 py-3 border-b border-white/[0.06] space-y-2 max-h-48 overflow-y-auto">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-400/80 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Proposed fixes
            </p>
            {proposals.map((a) => (
              <div key={a.id} className="rounded-lg border border-white/[0.06] p-2 text-xs">
                <p className="font-medium text-slate-200">{a.label}</p>
                <p className="text-slate-500 mt-0.5 line-clamp-2">{a.review}</p>
                <button
                  type="button"
                  className="btn-primary text-[10px] mt-2"
                  disabled={executingId === a.id}
                  onClick={() => void runAction(a)}
                >
                  {executingId === a.id ? 'Running…' : 'Review & run'}
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-slate-500">Ask about VM health, capacity, cost, migrations, security, or network paths.</p>
              <div className="flex flex-wrap gap-2">
                {['Why is this VM slow?', 'Cluster capacity headroom', 'Security risks', 'Migration readiness'].map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="text-[10px] rounded-full border border-white/[0.08] px-2 py-1 text-slate-400 hover:text-slate-200"
                    onClick={() => setInput(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`rounded-xl px-3 py-2 ${m.role === 'user' ? 'bg-blue-500/15 ml-8' : 'bg-slate-800/80 mr-4'}`}>
              <p className="whitespace-pre-wrap text-slate-200">{m.text}</p>
            </div>
          ))}
        </div>
        <footer className="p-3 border-t border-white/[0.06] flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder="Why is this VM slow?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void send() }}
          />
          <button type="button" className="btn-primary px-3" disabled={busy} onClick={() => void send()}>
            <Send className="w-4 h-4" />
          </button>
        </footer>
      </aside>
    </>
  )
}
