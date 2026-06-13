// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Maximize2, Monitor } from 'lucide-react'
import {
  getConsoleHubPlan,
  issuePlatformVmWsToken,
  platformVmVncWsUrl,
  type ConsoleHubPlan,
} from '../../../api/platform'
import VNCViewer from '../../VNCViewer'
import { openCenterPopout } from '../../../utils/platformCenterPopout'
import VmConsoleQuickLinks from './VmConsoleQuickLinks'
import { cinemaHubPath, cinemaPopoutPath } from '../../../utils/consoleExperienceMode'
import { consoleStatusLabel } from './vmConsoleLinks'

type Props = {
  vmId: string
  vmName: string
  connected?: boolean
}

export default function ConsoleTheatrePreview({ vmId, vmName, connected = true }: Props) {
  const [plan, setPlan] = useState<ConsoleHubPlan | null>(null)
  const [wsUrl, setWsUrl] = useState<string | null>(null)
  const [connectKey, setConnectKey] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const [hubPlan, tokenRes] = await Promise.all([
        getConsoleHubPlan(vmId).catch(() => null),
        issuePlatformVmWsToken(vmId).catch(() => null),
      ])
      setPlan(hubPlan)
      if (tokenRes?.token) {
        setWsUrl(platformVmVncWsUrl(vmId, tokenRes.token))
      } else {
        setWsUrl(null)
      }
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Console unavailable')
      setPlan(null)
      setWsUrl(null)
    }
  }, [vmId])

  useEffect(() => {
    void load()
  }, [load])

  const status = plan
    ? consoleStatusLabel(plan.protocols, plan.recommended)
    : connected
      ? 'VNC · Ready'
      : 'Disconnected'

  const showVnc = Boolean(wsUrl) && (plan?.protocols.includes('novnc') ?? true)

  return (
    <section className="rounded-lg border border-white/[0.08] bg-black/40 overflow-hidden" data-testid="console-theatre-preview">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] text-xs gap-2">
        <span className="text-slate-300 font-medium shrink-0">Console Theatre</span>
        <span className={connected ? 'text-emerald-400 truncate text-right' : 'text-slate-500 truncate text-right'} title={status}>
          {status}
        </span>
      </div>

      <div className="px-3 pt-2 pb-1">
        <VmConsoleQuickLinks vmId={vmId} running compact />
      </div>

      {loadError ? (
        <p className="px-3 py-2 text-xs text-amber-300/90">{loadError}</p>
      ) : showVnc ? (
        <div className="relative mx-2 mb-2 rounded-md border border-white/[0.06] overflow-hidden bg-black aspect-video w-[calc(100%-1rem)] max-h-[11rem] flex flex-col" data-testid="console-theatre-vnc">
          <VNCViewer
            vmName={vmName}
            wsUrl={wsUrl ?? undefined}
            previewMode
            defaultScaledFit
            fillViewport
            fillViewportOffset="0"
            connectKey={connectKey}
            onReconnect={() => {
              setConnectKey((k) => k + 1)
              void load()
            }}
          />
        </div>
      ) : (
        <div className="px-3 py-3 text-xs text-slate-500">
          {plan?.protocols.includes('spice') || plan?.protocols.includes('webrtc_spice')
            ? 'This VM uses SPICE — open SPICE or Performance above.'
            : 'Open VNC above or use ConsoleHub for serial/SSH lenses.'}
        </div>
      )}

      <div className="flex border-t border-white/[0.06] divide-x divide-white/[0.06]">
        <Link
          to={cinemaHubPath(vmId, plan?.recommended && plan.recommended !== 'serial' ? { protocol: plan.recommended } : undefined)}
          className="flex-1 btn-secondary text-xs rounded-none border-0 py-2 inline-flex items-center justify-center gap-1"
        >
            <Monitor className="w-3.5 h-3.5" /> Open Cinema
        </Link>
        <button
          type="button"
          className="flex-1 btn-secondary text-xs rounded-none border-0 py-2 inline-flex items-center justify-center gap-1"
          onClick={() => openCenterPopout(cinemaPopoutPath(vmId))}
        >
          <Maximize2 className="w-3.5 h-3.5" /> Pop out
        </button>
      </div>
    </section>
  )
}
