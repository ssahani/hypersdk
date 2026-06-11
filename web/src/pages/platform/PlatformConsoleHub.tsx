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
  listVmPortForwards,
  listVmTimeline,
  platformVmVncWsUrl,
  platformVmSerialWsUrl,
  platformVncWsUrl,
  requestConsoleAccess,
  runVmHealthCheck,
  type ConsoleHubPlan,
  type ConsoleHubSessionResponse,
  type VmPortForwardRule,
} from '../../api/platform'
import { formatUserError } from '../../utils/apiError'
import { useToastContext } from '../../contexts/ToastContext'
import MachineCockpit from '../../components/consolehub/MachineCockpit'
import VmLaptopAccessChecklist from '../../components/vm/VmLaptopAccessChecklist'
import type { ConsoleHubSessionRow } from '../../components/consolehub/ConsoleHubSessionHistory'
import { isCenterPopoutMode, openCenterPopout } from '../../utils/platformCenterPopout'
import { hubLinkClasses } from '../../utils/semanticColors'
import PageLayout from '../../components/PageLayout'

export default function PlatformConsoleHub() {
  const toast = useToastContext()
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const isPopout = isCenterPopoutMode(location.search)
  const [plan, setPlan] = useState<ConsoleHubPlan | null>(null)
  const [session, setSession] = useState<ConsoleHubSessionResponse | null>(null)
  const [activeProtocol, setActiveProtocol] = useState('novnc')
  const [wsUrl, setWsUrl] = useState<string | null>(null)
  const [serialWsUrl, setSerialWsUrl] = useState<string | null>(null)
  const [vmName, setVmName] = useState<string | null>(null)
  const [vmState, setVmState] = useState<string | null>(null)
  const [nodeName, setNodeName] = useState<string | null>(null)
  const [healthScore, setHealthScore] = useState<number | null>(null)
  const [kubeVirtNamespace, setKubeVirtNamespace] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectKey, setConnectKey] = useState(0)
  const [history, setHistory] = useState<ConsoleHubSessionRow[]>([])
  const [machineTimeline, setMachineTimeline] = useState<Awaited<ReturnType<typeof listVmTimeline>>>([])
  const [portForwardRules, setPortForwardRules] = useState<VmPortForwardRule[]>([])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [planRes, tokenRes, vm, sessions, timeline, health] = await Promise.all([
        getConsoleHubPlan(id).then((v) => ({ ok: true as const, v })).catch((e: unknown) => ({ ok: false as const, e })),
        issuePlatformVmWsToken(id).then((v) => ({ ok: true as const, v })).catch((e: unknown) => ({ ok: false as const, e })),
        getPlatformVm(id).catch(() => null),
        listConsoleHubSessions(id).catch(() => []),
        listVmTimeline(id).catch(() => []),
        runVmHealthCheck(id).catch(() => null),
      ])

      const hubPlan = planRes.ok ? planRes.v : null
      const wsToken = tokenRes.ok ? tokenRes.v.token : null

      if (!hubPlan && !wsToken) {
        const err = !planRes.ok ? planRes.e : !tokenRes.ok ? tokenRes.e : null
        setError(formatUserError(err))
        return
      }

      if (hubPlan) {
        setPlan(hubPlan)
        setVmName(hubPlan.vm_name)
        setActiveProtocol(hubPlan.recommended)
        if (hubPlan.guest_ip?.trim()) {
          listVmPortForwards(id).then(setPortForwardRules).catch(() => setPortForwardRules([]))
        } else {
          setPortForwardRules([])
        }
      } else if (vm?.name) {
        setVmName(vm.name)
      }

      if (!planRes.ok || !tokenRes.ok) {
        const partialErr = formatUserError(
          !planRes.ok ? planRes.e : !tokenRes.ok ? tokenRes.e : null,
        )
        const canDisplay = Boolean(
          wsToken
          || hubPlan?.native?.ws_path
          || vm?.inventory_source === 'kubevirt',
        )
        if (!canDisplay) setError(partialErr)
      }

      setHistory(sessions)
      setMachineTimeline(timeline)
      setHealthScore(health ? parseInt(health.score.split('/')[0], 10) || null : null)
      setVmState(vm?.observed_state ?? vm?.desired_state ?? null)
      setNodeName(vm?.host_id ? vm.host_id.slice(0, 8) : null)
      const isKubevirt = vm?.inventory_source === 'kubevirt'
      setKubeVirtNamespace(isKubevirt ? (vm?.k8s_namespace ?? 'default') : null)
      if (isKubevirt) {
        setWsUrl(null)
        setSerialWsUrl(null)
      } else if (wsToken) {
        setWsUrl(platformVmVncWsUrl(id, wsToken))
        setSerialWsUrl(platformVmSerialWsUrl(id, wsToken))
      } else if (hubPlan?.native?.ws_path) {
        setWsUrl(platformVncWsUrl(hubPlan.native.ws_path))
      }

      if (wsToken || hubPlan?.native?.ws_path) {
        setError(null)
      }

      const needsGuac = hubPlan?.recommended.startsWith('guacamole_') ?? false
      if (needsGuac && hubPlan?.guacamole.available) {
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
        } else if (protocol === 'serial' && !kubeVirtNamespace) {
          const tokenRes = await issuePlatformVmWsToken(id)
          setSerialWsUrl(platformVmSerialWsUrl(id, tokenRes.token))
        }
      }
      setHistory(await listConsoleHubSessions(id).catch(() => []))
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

  const checklistPrepend =
    plan?.guest_access?.guest_ip_private && id && vmName && plan.guest_ip ? (
      <VmLaptopAccessChecklist
        vmId={id}
        vmName={vmName}
        vmState={vmState ?? 'unknown'}
        guestIp={plan.guest_ip}
        sshUser={plan.ssh_user ?? 'ubuntu'}
        hypervisorAddress={plan.hypervisor_address ?? undefined}
        guestAccess={plan.guest_access}
        portForwardRules={portForwardRules}
        onRefreshRules={() => void load()}
        onNotify={(m) => toast.success(m)}
        networkTabHref={`/platform/vms/${id}?tab=network`}
      />
    ) : null

  const prepend = !isPopout ? (
    <div className="space-y-2 mb-2">
      {checklistPrepend}
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
      {error?.toLowerCase().includes('approval') ? (
        <button type="button" className="btn-secondary text-sm" onClick={() => void requestAccess()}>
          Request console access
        </button>
      ) : null}
      {id && !isPopout ? (
        <button type="button" className="btn-secondary text-sm ml-auto" onClick={() => openCenterPopout(`/platform/vms/${id}/consolehub`)}>
          Pop out
        </button>
      ) : null}
      </div>
    </div>
  ) : checklistPrepend ?? undefined

  return (
    <PageLayout
      compact
      hideHeader
      loading={loading && !vmName}
      contentClassName="flex flex-col flex-1 min-h-0 h-full min-h-[calc(100dvh-14rem)]"
      title={vmName ?? 'Machine Cockpit'}
      subtitle="Zeus ConsoleHub · Machine Canvas"
    >
      {id && vmName ? (
        <div className="flex flex-col flex-1 min-h-0 h-full">
          <MachineCockpit
          vmId={id}
          vmName={vmName}
          plan={plan}
          session={session}
          wsUrl={wsUrl}
          serialWsUrl={serialWsUrl}
          activeProtocol={activeProtocol}
          onProtocolChange={(p) => void switchProtocol(p)}
          vmState={vmState}
          nodeName={nodeName}
          healthScore={healthScore}
          kubeVirtNamespace={kubeVirtNamespace}
          error={error}
          loading={loading}
          history={history}
          machineTimeline={machineTimeline}
          isPopout={isPopout}
          onReconnect={() => setConnectKey((k) => k + 1)}
          connectKey={connectKey}
          prepend={prepend}
          hypervisorAddress={plan?.hypervisor_address ?? undefined}
          portForwardRules={portForwardRules}
          onPlanRefresh={() => void load()}
        />
        </div>
      ) : !loading && id ? (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8 max-w-lg mx-auto text-center space-y-4" data-testid="consolehub-recovery">
          <h2 className="text-lg font-semibold text-amber-100">Machine not found</h2>
          <p className="text-sm text-amber-200/80">This VM does not exist or the session expired.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/platform" className="btn-primary text-sm">Mission Control</Link>
            <Link to="/platform/vms" className="btn-secondary text-sm">Machine Finder</Link>
          </div>
        </section>
      ) : null}
    </PageLayout>
  )
}
