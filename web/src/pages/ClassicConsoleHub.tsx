// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import type { ConsoleHubPlan, ConsoleHubSessionResponse } from '../api/platform'
import { getWsToken } from '../api/client'
import { formatUserError } from '../utils/apiError'
import MachineCockpit from '../components/consolehub/MachineCockpit'
import type { ConsoleHubSessionRow } from '../components/consolehub/ConsoleHubSessionHistory'
import PageLayout from '../components/PageLayout'
import { hubLinkClasses } from '../utils/semanticColors'

function classicWsUrl(pathTemplate: string, token: string): string | null {
  const path = pathTemplate.replace('__WS_TOKEN__', encodeURIComponent(token))
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = typeof window !== 'undefined' ? window.location.host : ''
  return `${protocol}//${host}${path}`
}

function classicVncWsUrl(plan: ClassicConsoleHubPlan, token: string): string | null {
  if (!plan.native.available) return null
  return classicWsUrl(plan.native.ws_path, token)
}

function classicSerialWsUrl(plan: ClassicConsoleHubPlan, token: string): string | null {
  const path = plan.native.serial_ws_path ?? plan.native.ws_path.replace('/vnc/', '/console/')
  return classicWsUrl(path, token)
}

function toPlatformPlan(plan: ClassicConsoleHubPlan): ConsoleHubPlan {
  return { ...plan, vm_id: plan.vm_name }
}

function toPlatformSession(sess: ClassicConsoleHubSessionResponse): ConsoleHubSessionResponse {
  return { ...sess, vm_id: sess.vm_name }
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
  const [wsUrl, setWsUrl] = useState<string | null>(null)
  const [serialWsUrl, setSerialWsUrl] = useState<string | null>(null)

  const platformPlan = useMemo(() => (plan ? toPlatformPlan(plan) : null), [plan])
  const platformSession = useMemo(() => (session ? toPlatformSession(session) : null), [session])

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
        setSerialWsUrl(classicSerialWsUrl(hubPlan, token))
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
        } else if (protocol === 'serial' && plan) {
          const token = await getWsToken()
          setSerialWsUrl(classicSerialWsUrl(plan, token))
        }
      }
      setHistory(await listClassicConsoleHubSessions(name, conn).catch(() => []))
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }

  const prepend = (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Link to={vmDetailRoute(name ?? '', conn)} className={`inline-flex items-center gap-1 ${hubLinkClasses()}`}>
        <ArrowLeft className="w-4 h-4" /> Back to VM
      </Link>
    </div>
  )

  if (!name) return null

  return (
    <PageLayout
      compact
      hideHeader
      loading={loading && !plan}
      contentClassName="flex flex-col flex-1 min-h-0 h-full min-h-[calc(100dvh-14rem)]"
      title={name}
      subtitle="Classic ConsoleHub · Machine Canvas"
    >
      {plan ? (
        <div className="flex flex-col flex-1 min-h-0 h-full">
          <MachineCockpit
            vmId={name}
            vmName={name}
            plan={platformPlan}
            session={platformSession}
            wsUrl={wsUrl}
            serialWsUrl={serialWsUrl}
            activeProtocol={activeProtocol}
            onProtocolChange={(p) => void switchProtocol(p)}
            vmState={vmState}
            error={error}
            loading={loading}
            history={history}
            onReconnect={() => setConnectKey((k) => k + 1)}
            connectKey={connectKey}
            prepend={prepend}
          />
        </div>
      ) : !loading ? (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8 max-w-lg mx-auto text-center space-y-4">
          <h2 className="text-lg font-semibold text-amber-100">Console unavailable</h2>
          <p className="text-sm text-amber-200/80">{error ?? 'Could not load console plan for this VM.'}</p>
        </section>
      ) : null}
    </PageLayout>
  )
}
