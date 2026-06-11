// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { ConsoleViewportProvider, useConsoleViewport } from './ConsoleViewportContext'
import MachineCommandStrip from './MachineCommandStrip'
import ViewLensBar, { lensToProtocol, type ConsoleLens } from './ViewLensBar'
import MachineCanvas from './MachineCanvas'
import FloatingConsoleHud from './FloatingConsoleHud'
import CommandDock from './CommandDock'
import ConsoleMinimap from './ConsoleMinimap'
import ZeroPanicRecoveryBar from './ZeroPanicRecoveryBar'
import ConsoleCopilotLens from './ConsoleCopilotLens'
import CommandCenterPanel from './CommandCenterPanel'
import MachineTimeline from './MachineTimeline'
import type { ConsoleHubPlan, ConsoleHubSessionResponse } from '../../api/platform'
import type { ConsoleHubSessionRow } from './ConsoleHubSessionHistory'
import type { VmTimelineEntry } from '../../api/platformVmTimeline'
import { recipeForError, type ConsoleRecipe } from '../../data/consoleRecipes'
import ConsoleHubSession from './ConsoleHubSession'
import GuestAccessBanner from './GuestAccessBanner'
import { sendGuestKey } from '../../api/vm'
import { useToastContext } from '../../contexts/ToastContext'

export type MachineCockpitProps = {
  vmId: string
  vmName: string
  plan: ConsoleHubPlan | null
  session: ConsoleHubSessionResponse | null
  wsUrl: string | null
  serialWsUrl?: string | null
  activeProtocol: string
  onProtocolChange: (protocol: string) => void
  vmState?: string | null
  nodeName?: string | null
  healthScore?: number | null
  kubeVirtNamespace?: string | null
  error?: string | null
  loading?: boolean
  history?: ConsoleHubSessionRow[]
  machineTimeline?: VmTimelineEntry[]
  isPopout?: boolean
  onReconnect?: () => void
  onPopout?: () => void
  connectKey?: number
  prepend?: ReactNode
}

function CockpitInner({
  vmId,
  vmName,
  plan,
  session,
  wsUrl,
  serialWsUrl,
  activeProtocol,
  onProtocolChange,
  vmState,
  nodeName,
  healthScore,
  kubeVirtNamespace,
  error,
  loading,
  history = [],
  machineTimeline = [],
  isPopout,
  onReconnect,
  connectKey = 0,
  prepend,
}: MachineCockpitProps) {
  const toast = useToastContext()
  const vp = useConsoleViewport()
  const [lens, setLens] = useState<ConsoleLens>('display')
  const [theatre, setTheatre] = useState(isPopout ?? false)
  const [commandCenter, setCommandCenter] = useState(false)
  const [ccTab, setCcTab] = useState('Overview')
  const [activeRecipe, setActiveRecipe] = useState<ConsoleRecipe | null>(null)

  const displayProtocols = plan
    ? [...plan.protocols, ...(plan.guest_ip && !plan.protocols.includes('native_ssh') ? ['native_ssh'] : [])]
    : []

  useEffect(() => {
    vp.setProtocol(activeProtocol)
    if (activeProtocol === 'novnc' || activeProtocol.startsWith('guacamole_')) {
      vp.setMode('fit')
    }
    if (loading) {
      vp.setConnected(false)
    }
  }, [activeProtocol, loading, vp])

  useEffect(() => {
    vp.setScaledFit(vp.mode === 'fit')
  }, [vp.mode, vp])

  useEffect(() => {
    if (plan?.recommended === 'serial') {
      setLens('serial')
    } else if (plan?.recommended === 'spice' || plan?.recommended === 'webrtc_spice') {
      setLens('display')
    } else if (plan?.recommended === 'novnc') {
      setLens('display')
    }
  }, [plan?.recommended])

  const switchLens = useCallback(
    (next: ConsoleLens) => {
      setLens(next)
      if (next === 'ai' || next === 'events' || next === 'recovery') return
      if (next === 'network' || next === 'perf') {
        setCommandCenter(true)
        setCcTab(next === 'network' ? 'Overview' : 'Health')
        return
      }
      const proto = lensToProtocol(next, displayProtocols, plan?.recommended ?? 'novnc')
      onProtocolChange(proto)
    },
    [displayProtocols, onProtocolChange, plan?.recommended],
  )

  const sendCtrlAltDel = async () => {
    try {
      await sendGuestKey(vmName, { preset: 'ctrl_alt_del' })
      toast.success('Sent Ctrl+Alt+Del')
    } catch {
      toast.error('Could not send key')
    }
  }

  const recipe = activeRecipe ?? recipeForError(error ?? null)

  const canvasContent = (() => {
    if (lens === 'ai') {
      return (
        <ConsoleCopilotLens
          vmId={vmId}
          vmName={vmName}
          activeLens={lens}
          guestIp={plan?.guest_ip}
          vmState={vmState}
          onSwitchLens={(l) => switchLens(l as ConsoleLens)}
        />
      )
    }
    if (lens === 'events') {
      return (
        <div className="p-4 overflow-y-auto flex-1">
          <MachineTimeline sessions={history} timeline={machineTimeline} />
        </div>
      )
    }
    if (lens === 'recovery') {
      return (
        <div className="p-4 overflow-y-auto flex-1">
          <ZeroPanicRecoveryBar
            error={error ?? 'Select a recovery action'}
            vmState={vmState}
            recipe={recipe}
            onReconnect={onReconnect}
            onOpenSerial={() => switchLens('serial')}
            onOpenSsh={() => switchLens('shell')}
            onOpenEvents={() => switchLens('events')}
            onAiDiagnose={() => switchLens('ai')}
            onRunRecipe={setActiveRecipe}
          />
        </div>
      )
    }
    return (
      <div className="flex flex-col flex-1 min-h-0 w-full gap-2">
        {(activeProtocol === 'serial' || activeProtocol === 'native_ssh') && (
          <GuestAccessBanner
            hints={plan?.guest_access}
            lens={activeProtocol === 'serial' ? 'serial' : 'shell'}
            sshUser={plan?.ssh_user ?? undefined}
            guestIp={plan?.guest_ip ?? undefined}
            vmId={vmId}
          />
        )}
        <ConsoleHubSession
        key={`${activeProtocol}-${wsUrl ?? 'none'}-${connectKey}`}
        protocol={activeProtocol}
        vmName={vmName}
        wsUrl={wsUrl}
        serialWsUrl={serialWsUrl}
        session={session}
        guestIp={plan?.guest_ip ?? undefined}
        sshUser={plan?.ssh_user ?? undefined}
        kubeVirtNamespace={kubeVirtNamespace ?? undefined}
        fillViewport
        cockpitMode
        onReconnect={onReconnect}
        connectKey={connectKey}
      />
      </div>
    )
  })()

  return (
    <div className={`flex flex-col flex-1 min-h-0 w-full ${theatre ? 'fixed inset-0 z-[55] bg-[#050508] p-2 md:p-4' : ''}`}>
      {prepend}
      {!error || wsUrl ? null : (
        <ZeroPanicRecoveryBar
          error={error}
          vmState={vmState}
          recipe={recipe}
          onReconnect={onReconnect}
          onOpenSerial={() => switchLens('serial')}
          onOpenSsh={() => switchLens('shell')}
          onOpenEvents={() => { setLens('events'); setCommandCenter(true) }}
          onAiDiagnose={() => switchLens('ai')}
          onRunRecipe={setActiveRecipe}
        />
      )}
      <MachineCommandStrip
        vmName={vmName}
        vmState={vmState}
        guestIp={plan?.guest_ip}
        osHint={plan?.os_hint}
        nodeName={nodeName}
        healthScore={healthScore}
        theatre={theatre}
        onEnterTheatre={() => setTheatre(true)}
        onCommandCenter={() => setCommandCenter(true)}
        onAi={() => switchLens('ai')}
      />
      <ViewLensBar
        active={lens}
        onChange={switchLens}
        displayProtocols={displayProtocols}
        activeProtocol={activeProtocol}
        onProtocolChange={onProtocolChange}
        recommended={plan?.recommended}
        osHint={plan?.os_hint}
        guestAccess={plan?.guest_access}
        sshUser={plan?.ssh_user ?? undefined}
        guestIp={plan?.guest_ip ?? undefined}
      />
      <MachineCanvas vmState={vmState} healthScore={healthScore} theatre={theatre} className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center flex-1 text-slate-500 text-sm">Loading machine canvas…</div>
        ) : (
          <>
            <div className="flex-1 min-h-0 w-full flex flex-col relative z-0">
              {canvasContent}
            </div>
            {lens === 'display' ? (
              <>
                <FloatingConsoleHud visible={!loading} />
                <CommandDock
                  visible={!loading}
                  onCtrlAltDel={() => void sendCtrlAltDel()}
                  onExplain={() => switchLens('ai')}
                  onSwitchLens={(l) => switchLens(l as ConsoleLens)}
                />
                <ConsoleMinimap />
              </>
            ) : null}
          </>
        )}
      </MachineCanvas>
      {theatre && !isPopout ? (
        <button type="button" className="fixed top-3 left-3 z-[70] btn-secondary text-xs" onClick={() => setTheatre(false)}>
          Exit Theatre
        </button>
      ) : null}
      <CommandCenterPanel
        open={commandCenter && lens !== 'events'}
        onClose={() => setCommandCenter(false)}
        vmId={vmId}
        vmName={vmName}
        healthScore={healthScore}
        vmState={vmState}
        guestIp={plan?.guest_ip}
        sessions={history}
        timeline={machineTimeline}
        initialTab={ccTab}
        onAction={() => toast.info('Action queued — open VM detail for full workflow')}
      />
    </div>
  )
}

export default function MachineCockpit(props: MachineCockpitProps) {
  return (
    <ConsoleViewportProvider>
      <CockpitInner {...props} />
    </ConsoleViewportProvider>
  )
}
