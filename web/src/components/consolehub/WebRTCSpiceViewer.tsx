// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import SPICEViewer from '../SPICEViewer'

type Props = {
  vmName: string
  libvirtConnection?: string | null
}

/** Phase 3 high-performance SPICE lens — uses spice-html5 with WS proxy (WebRTC bridge optional). */
export default function WebRTCSpiceViewer({ vmName, libvirtConnection }: Props) {
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full" data-testid="webrtc-spice-console">
      <div className="rounded-t-lg border border-violet-500/30 bg-violet-950/30 px-3 py-2 text-xs text-violet-100/90 shrink-0">
        Performance mode — native SPICE over machina WebSocket proxy. Clipboard and resize follow spice-html5 capabilities.
      </div>
      <SPICEViewer vmName={vmName} libvirtConnection={libvirtConnection} autoConnect />
    </div>
  )
}
