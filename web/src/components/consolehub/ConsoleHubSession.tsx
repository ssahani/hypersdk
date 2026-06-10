// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

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
  session: SessionLike | null
  guestIp?: string
  sshUser?: string
  kubeVirtNamespace?: string
  libvirtConnection?: string | null
  fillViewport?: boolean
  onReconnect?: () => void
}

export default function ConsoleHubSession({
  protocol,
  vmName,
  wsUrl,
  session,
  guestIp,
  sshUser = 'ubuntu',
  kubeVirtNamespace,
  libvirtConnection,
  fillViewport,
  onReconnect,
}: Props) {
  if (session?.backend === 'guacamole' && session.session_id) {
    const src = `${session.embed_path}#/`
    return (
      <div className="flex flex-col flex-1 min-h-0 gap-2">
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
          <VNCViewer
            vmName={vmName}
            wsUrl={wsUrl}
            defaultScaledFit={false}
            fillViewport={fillViewport}
            onReconnect={onReconnect}
          />
        ) : (
          <SPICEViewer vmName={vmName} />
        )}
      </div>
    )
  }

  if (protocol === 'native_ssh' && guestIp) {
    return <SSHConsole host={guestIp} sshUser={sshUser} />
  }

  if (protocol === 'serial') {
    return <SerialConsole vmName={vmName} libvirtConnection={libvirtConnection} />
  }

  if (kubeVirtNamespace) {
    return (
      <VNCViewer
        vmName={vmName}
        kubeVirtNamespace={kubeVirtNamespace}
        defaultScaledFit={false}
        fillViewport={fillViewport}
        onReconnect={onReconnect}
      />
    )
  }

  if (wsUrl) {
    return (
      <VNCViewer
        vmName={vmName}
        wsUrl={wsUrl}
        libvirtConnection={libvirtConnection}
        defaultScaledFit={false}
        fillViewport={fillViewport}
        onReconnect={onReconnect}
      />
    )
  }

  return (
    <div className="text-sm text-slate-400 p-4 border border-slate-800 rounded-lg">
      Console unavailable — start the VM and retry.
    </div>
  )
}
