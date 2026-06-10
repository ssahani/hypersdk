// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import {
  createConsoleHubSession,
  getConsoleHubPlan,
  getPlatformVm,
  issuePlatformVmWsToken,
  listConsoleHubSessions,
  platformVmVncWsUrl,
  type ConsoleHubPlan,
  type ConsoleHubSessionResponse,
  requestConsoleAccess,
} from '../../api/platform'
import { formatUserError } from '../../utils/apiError'
import { useToastContext } from '../../contexts/ToastContext'
import AiTerminalCompanion from '../../components/ai/AiTerminalCompanion'
import ConsoleHubShell from '../../components/consolehub/ConsoleHubShell'
import ConsoleHubProtocolPicker from '../../components/consolehub/ConsoleHubProtocolPicker'
import ConsoleHubSession from '../../components/consolehub/ConsoleHubSession'
import ConsoleHubSessionHistory, { type ConsoleHubSessionRow } from '../../components/consolehub/ConsoleHubSessionHistory'
import { isCenterPopoutMode, openCenterPopout } from '../../utils/platformCenterPopout'
import { hubLinkClasses } from '../../utils/semanticColors'

export default function PlatformConsoleHub() {
  const toast = useToastContext()
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const isPopout = isCenterPopoutMode(location.search)
  const [plan, setPlan] = useState<ConsoleHubPlan | null>(null)
  const [session, setSession] = useState<ConsoleHubSessionResponse | null>(null)
  const [activeProtocol, setActiveProtocol] = useState('novnc')
  const [wsUrl, setWsUrl] = useState<string | null>(null)
  const [vmName, setVmName] = useState<string | null>(null)
  const [vmState, setVmState] = useState<string | null>(null)
  const [nodeName, setNodeName] = useState<string | null>(null)
  const [kubeVirtNamespace, setKubeVirtNamespace] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectKey, setConnectKey] = useState(0)
  const [history, setHistory] = useState<ConsoleHubSessionRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [hubPlan, tokenRes, vm, sessions] = await Promise.all([
        getConsoleHubPlan(id),
        issuePlatformVmWsToken(id),
        getPlatformVm(id).catch(() => null),
        listConsoleHubSessions(id).catch(() => []),
      ])
      setPlan(hubPlan)
      setVmName(hubPlan.vm_name)
      setActiveProtocol(hubPlan.recommended)
      setHistory(sessions)
      setVmState(vm?.observed_state ?? vm?.desired_state ?? null)
      setNodeName(vm?.host_id ? vm.host_id.slice(0, 8) : null)
      const isKubevirt = vm?.inventory_source === 'kubevirt'
      setKubeVirtNamespace(isKubevirt ? (vm?.k8s_namespace ?? 'default') : null)
      if (isKubevirt) {
        setWsUrl(null)
      } else {
        setWsUrl(platformVmVncWsUrl(id, tokenRes.token))
      }

      const needsGuac = hubPlan.recommended.startsWith('guacamole_')
      if (needsGuac && hubPlan.guacamole.available) {
        const sess = await createConsoleHubSession(id, { protocol: hubPlan.recommended })
        setSession(sess)
      } else {
        setSession(null)
      }
    } catch (e: unknown) {
      setError(formatUserError(e))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load, connectKey])

  const refreshHistory = async () => {
    if (!id) return
    setHistoryLoading(true)
    try {
      setHistory(await listConsoleHubSessions(id))
    } catch {
      /* optional */
    } finally {
      setHistoryLoading(false)
    }
  }

  const switchProtocol = async (protocol: string) => {
    if (!id) return
    setActiveProtocol(protocol)
    setError(null)
    try {
      if (protocol.startsWith('guacamole_')) {
        const sess = await createConsoleHubSession(id, { protocol })
        setSession(sess)
      } else {
        setSession(null)
        if (protocol === 'novnc' && !kubeVirtNamespace) {
          const tokenRes = await issuePlatformVmWsToken(id)
          setWsUrl(platformVmVncWsUrl(id, tokenRes.token))
        }
      }
      void refreshHistory()
    } catch (e: unknown) {
      setError(formatUserError(e))
    }
  }

  const requestAccess = async () => {
    if (!id || !activeProtocol) return
    try {
      await requestConsoleAccess(id, { protocol: activeProtocol, reason: 'ConsoleHub operator access' })
      toast.success('JIT console access request submitted — check Zeus → Approvals')
    } catch (e: unknown) {
      toast.error(formatUserError(e))
    }
  }

  const displayProtocols = plan
    ? [...plan.protocols, ...(plan.guest_ip && !plan.protocols.includes('native_ssh') ? ['native_ssh'] : [])]
    : []

  return (
    <ConsoleHubShell
      title={vmName ?? 'VM console'}
      vmState={vmState ?? undefined}
      guestIp={plan?.guest_ip ?? undefined}
      nodeName={nodeName ?? undefined}
      loading={loading}
      error={error}
      errorHints={
        error?.toLowerCase().includes('approval')
          ? [
              'Production VMs may require JIT console approval (CONSOLEHUB_REQUIRE_APPROVAL=1).',
              'Submit a request below or ask an operator to approve in Zeus → Approvals.',
            ]
          : error?.toLowerCase().includes('oidc') || error?.toLowerCase().includes('sso')
            ? ['Production consoles may require OIDC/SAML login (CONSOLEHUB_REQUIRE_OIDC=1).']
            : undefined
      }
      errorActions={
        error?.toLowerCase().includes('approval') ? (
          <button type="button" className="btn-secondary text-sm" onClick={() => void requestAccess()}>
            Request console access
          </button>
        ) : undefined
      }
      onReconnect={() => setConnectKey((k) => k + 1)}
      onPopout={id && !isPopout ? () => openCenterPopout(`/platform/vms/${id}/consolehub`) : undefined}
      prepend={
        !isPopout ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link to="/platform/vms" className={`inline-flex items-center gap-1 ${hubLinkClasses()}`}>
              <ArrowLeft className="w-4 h-4" /> VM list
            </Link>
            {id ? (
              <Link to={`/platform/vms/${id}`} className={`inline-flex items-center gap-1 ${hubLinkClasses()}`}>
                Back to VM
              </Link>
            ) : null}
            {kubeVirtNamespace ? (
              <span className="text-xs text-sky-300/90 font-mono">KubeVirt · {kubeVirtNamespace}/{vmName}</span>
            ) : null}
          </div>
        ) : undefined
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
          <span>
            {kubeVirtNamespace ? 'KubeVirt VNC via cluster subresource' : 'Native same-origin proxy · noVNC / SPICE / serial'}
          </span>
        )
      }
    >
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          {vmName && (
            <ConsoleHubSession
              protocol={activeProtocol}
              vmName={vmName}
              wsUrl={wsUrl}
              session={session}
              guestIp={plan?.guest_ip ?? undefined}
              sshUser={plan?.ssh_user ?? undefined}
              kubeVirtNamespace={kubeVirtNamespace ?? undefined}
              fillViewport={isPopout}
              onReconnect={() => setConnectKey((k) => k + 1)}
            />
          )}
        </div>
        {id && !isPopout && vmName ? (
          <div className="lg:w-80 shrink-0 flex flex-col gap-3">
            <ConsoleHubSessionHistory sessions={history} loading={historyLoading} />
            <AiTerminalCompanion vmName={vmName} vmId={id} />
          </div>
        ) : null}
      </div>
    </ConsoleHubShell>
  )
}
