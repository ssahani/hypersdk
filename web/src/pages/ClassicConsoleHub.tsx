// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import {
  createClassicConsoleHubSession,
  getClassicConsoleHubPlan,
  getVM,
  listClassicConsoleHubSessions,
  vmDetailRoute,
  type ClassicConsoleHubPlan,
  type ClassicConsoleHubSessionResponse,
} from '../api/vm'
import { getWsToken } from '../api/client'
import { formatUserError } from '../utils/apiError'
import AiTerminalCompanion from '../components/ai/AiTerminalCompanion'
import ConsoleHubShell from '../components/consolehub/ConsoleHubShell'
import ConsoleHubProtocolPicker from '../components/consolehub/ConsoleHubProtocolPicker'
import ConsoleHubSession from '../components/consolehub/ConsoleHubSession'
import ConsoleHubSessionHistory, { type ConsoleHubSessionRow } from '../components/consolehub/ConsoleHubSessionHistory'
import { hubLinkClasses } from '../utils/semanticColors'

function classicVncWsUrl(plan: ClassicConsoleHubPlan, token: string): string | null {
  if (!plan.native.available) return null
  const path = plan.native.ws_path.replace('__WS_TOKEN__', encodeURIComponent(token))
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = typeof window !== 'undefined' ? window.location.host : ''
  return `${protocol}//${host}${path}`
}

export default function ClassicConsoleHub() {
  const { name } = useParams<{ name: string }>()
  const [searchParams] = useSearchParams()
  const conn = searchParams.get('connection') ?? undefined
  const [plan, setPlan] = useState<ClassicConsoleHubPlan | null>(null)
  const [session, setSession] = useState<ClassicConsoleHubSessionResponse | null>(null)
  const [activeProtocol, setActiveProtocol] = useState('novnc')
  const [vmState, setVmState] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectKey, setConnectKey] = useState(0)
  const [history, setHistory] = useState<ConsoleHubSessionRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [wsUrl, setWsUrl] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!name) return
    setLoading(true)
    setError(null)
    try {
      const [hubPlan, vm, sessions] = await Promise.all([
        getClassicConsoleHubPlan(name, conn),
        getVM(name, conn).catch(() => null),
        listClassicConsoleHubSessions(name, conn).catch(() => []),
      ])
      setPlan(hubPlan)
      setActiveProtocol(hubPlan.recommended)
      setVmState(vm?.state ?? null)
      setHistory(sessions)
      const needsGuac = hubPlan.recommended.startsWith('guacamole_')
      if (needsGuac && hubPlan.guacamole.available) {
        const sess = await createClassicConsoleHubSession(name, { protocol: hubPlan.recommended }, conn)
        setSession(sess)
        setWsUrl(null)
      } else {
        setSession(null)
        const token = await getWsToken()
        setWsUrl(classicVncWsUrl(hubPlan, token))
      }
    } catch (e: unknown) {
      setError(formatUserError(e))
    } finally {
      setLoading(false)
    }
  }, [name, conn])

  useEffect(() => {
    void load()
  }, [load, connectKey])

  const refreshHistory = async () => {
    if (!name) return
    setHistoryLoading(true)
    try {
      setHistory(await listClassicConsoleHubSessions(name, conn))
    } catch {
      /* optional panel */
    } finally {
      setHistoryLoading(false)
    }
  }

  const switchProtocol = async (protocol: string) => {
    if (!name) return
    setActiveProtocol(protocol)
    setError(null)
    try {
      if (protocol.startsWith('guacamole_')) {
        const sess = await createClassicConsoleHubSession(name, { protocol }, conn)
        setSession(sess)
        setWsUrl(null)
      } else {
        setSession(null)
        if (protocol === 'novnc' && plan) {
          const token = await getWsToken()
          setWsUrl(classicVncWsUrl(plan, token))
        }
      }
      void refreshHistory()
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }

  const displayProtocols = plan
    ? [...plan.protocols, ...(plan.guest_ip && !plan.protocols.includes('native_ssh') ? ['native_ssh'] : [])]
    : []

  if (!name) return null

  return (
    <ConsoleHubShell
      title={name}
      vmState={vmState ?? undefined}
      guestIp={plan?.guest_ip ?? undefined}
      loading={loading}
      error={error}
      onReconnect={() => setConnectKey((k) => k + 1)}
      prepend={
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link to={vmDetailRoute(name, conn)} className={`inline-flex items-center gap-1 ${hubLinkClasses()}`}>
            <ArrowLeft className="w-4 h-4" /> Back to VM
          </Link>
        </div>
      }
      protocolPicker={
        plan ? (
          <ConsoleHubProtocolPicker
            protocols={displayProtocols}
            recommended={plan.recommended}
            active={activeProtocol}
            onChange={(p) => void switchProtocol(p)}
          />
        ) : undefined
      }
      sessionInfo={
        session ? (
          <span>
            Session {session.session_id.slice(0, 8)}… · audit {session.audit_id.slice(0, 8)}… · expires {session.expires_at}
          </span>
        ) : (
          <span>Classic ConsoleHub · same-origin noVNC / SPICE / serial / Guacamole</span>
        )
      }
    >
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-[60vh]">
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <ConsoleHubSession
            key={`${activeProtocol}-${wsUrl ?? 'none'}-${connectKey}`}
            protocol={activeProtocol}
            vmName={name}
            wsUrl={wsUrl}
            session={session}
            guestIp={plan?.guest_ip ?? undefined}
            sshUser={plan?.ssh_user ?? undefined}
            libvirtConnection={conn}
            fillViewport
            connectKey={connectKey}
            onReconnect={() => setConnectKey((k) => k + 1)}
          />
        </div>
        <div className="lg:w-80 shrink-0 flex flex-col gap-3">
          <ConsoleHubSessionHistory sessions={history} loading={historyLoading} />
          <AiTerminalCompanion vmName={name} libvirtConnection={conn} />
        </div>
      </div>
    </ConsoleHubShell>
  )
}
