// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import VNCViewer from '../VNCViewer'
import SPICEViewer from '../SPICEViewer'
import SerialConsole from '../SerialConsole'
import SSHConsole from '../SSHConsole'
import type { ConsoleHubSessionResponse } from '../../api/platform'
import type { ClassicConsoleHubSessionResponse } from '../../api/vm'

type SessionLike = Pick<
  ConsoleHubSessionResponse | ClassicConsoleHubSessionResponse,
  'session_id' | 'backend' | 'embed_path' | 'emergency_url'
>

type Props = {
  protocol: string
  vmName: string
  wsUrl: string | null
  /** Platform serial WebSocket URL (same-origin proxy). */
  serialWsUrl?: string | null
  session: SessionLike | null
  guestIp?: string
  sshUser?: string
  sshConnectHost?: string
  sshConnectPort?: number
  kubeVirtNamespace?: string
  libvirtConnection?: string | null
  fillViewport?: boolean
  /** Hide built-in toolbar — Machine Cockpit provides floating HUD + dock. */
  cockpitMode?: boolean
  onReconnect?: () => void
  connectKey?: number
}

function VncShell({ cockpitMode, children }: { cockpitMode?: boolean; children: ReactNode }) {
  if (!cockpitMode) return <>{children}</>
  return <div className="flex flex-col flex-1 min-h-0 w-full h-full">{children}</div>
}

function CockpitVnc(props: {
  vmName: string
  wsUrl?: string
  kubeVirtNamespace?: string
  libvirtConnection?: string | null
  fillViewport?: boolean
  cockpitMode?: boolean
  onReconnect?: () => void
  connectKey?: number
}) {
  const scaled = props.cockpitMode || Boolean(props.fillViewport)
  return (
    <VncShell cockpitMode={props.cockpitMode}>
      <VNCViewer
        vmName={props.vmName}
        wsUrl={props.wsUrl}
        kubeVirtNamespace={props.kubeVirtNamespace}
        libvirtConnection={props.libvirtConnection}
        defaultScaledFit={scaled}
        fillViewport={props.fillViewport ?? props.cockpitMode}
        fillViewportOffset="11rem"
        cockpitMode={props.cockpitMode}
        onReconnect={props.onReconnect}
        connectKey={props.connectKey}
      />
    </VncShell>
  )
}

export default function ConsoleHubSession({
  protocol,
  vmName,
  wsUrl,
  serialWsUrl,
  session,
  guestIp,
  sshUser = 'ubuntu',
  sshConnectHost,
  sshConnectPort,
  kubeVirtNamespace,
  libvirtConnection,
  fillViewport,
  cockpitMode,
  onReconnect,
  connectKey,
}: Props) {
  if (session?.backend === 'guacamole' && session.session_id) {
    const src = `${session.embed_path}#/`
    return (
      <div className="flex flex-col flex-1 min-h-0 gap-2 w-full h-full">
        <iframe
          title={`ConsoleHub ${protocol}`}
          src={src}
          className="flex-1 w-full min-h-[420px] rounded-lg border border-slate-700/60 bg-black"
          allow="clipboard-read; clipboard-write; fullscreen"
        />
        {session.emergency_url ? (
          <div className="flex justify-end">
            <a
              href={session.emergency_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-xs inline-flex items-center gap-1 py-1 px-2"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open in new tab (fallback)
            </a>
          </div>
        ) : null}
      </div>
    )
  }

  if (protocol === 'spice') {
    return <SPICEViewer vmName={vmName} libvirtConnection={libvirtConnection} />
  }

  if (protocol === 'webrtc_spice') {
    return (
      <div className="rounded-lg border border-violet-500/30 bg-violet-950/20 p-4 text-sm text-violet-100 flex flex-col gap-3 flex-1 min-h-0">
        <p>WebRTC/SPICE high-performance mode — opt-in upgrade for SPICE-capable guests.</p>
        {wsUrl ? (
          <CockpitVnc vmName={vmName} wsUrl={wsUrl} fillViewport={fillViewport} cockpitMode={cockpitMode} onReconnect={onReconnect} connectKey={connectKey} />
        ) : (
          <SPICEViewer vmName={vmName} />
        )}
      </div>
    )
  }

  if (protocol === 'native_ssh' && (sshConnectHost || guestIp)) {
    const host = sshConnectHost?.trim() || guestIp!
    return (
      <div className="flex flex-col flex-1 min-h-0 w-full">
        <SSHConsole host={host} sshUser={sshUser} sshPort={sshConnectPort} />
      </div>
    )
  }

  if (protocol === 'serial') {
    return (
      <div className="flex flex-col flex-1 min-h-0 w-full">
        <SerialConsole vmName={vmName} libvirtConnection={libvirtConnection} wsUrl={serialWsUrl ?? undefined} />
      </div>
    )
  }

  if (kubeVirtNamespace) {
    return (
      <div className="flex flex-col flex-1 min-h-0 w-full h-full">
        <CockpitVnc
          vmName={vmName}
          kubeVirtNamespace={kubeVirtNamespace}
          fillViewport={fillViewport}
          cockpitMode={cockpitMode}
          onReconnect={onReconnect}
          connectKey={connectKey}
        />
      </div>
    )
  }

  if (wsUrl) {
    return (
      <div className="flex flex-col flex-1 min-h-0 w-full h-full">
        <CockpitVnc
          vmName={vmName}
          wsUrl={wsUrl}
          libvirtConnection={libvirtConnection}
          fillViewport={fillViewport}
          cockpitMode={cockpitMode}
          onReconnect={onReconnect}
          connectKey={connectKey}
        />
      </div>
    )
  }

  return (
    <div className="text-sm text-slate-400 p-4 border border-slate-800 rounded-lg">
      Console unavailable — start the VM and retry.
    </div>
  )
}
