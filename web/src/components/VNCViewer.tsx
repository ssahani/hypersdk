import { useEffect, useRef, useState } from 'react'
import { Keyboard, Maximize, Minimize, Monitor, RefreshCw } from 'lucide-react'
import { getWsToken } from '../api/client'

interface Props {
  vmName: string
  port?: number
  /** When set, connect to KubeVirt VNC via machina (kubectl proxy + API subresource) instead of libvirt. */
  kubeVirtNamespace?: string
}

/** Apply scale vs native resolution (scroll) — affects perceived sharpness and pointer mapping. */
function applyViewportMode(
  rfb: { scaleViewport: boolean; clipViewport: boolean },
  scaledFit: boolean,
) {
  if (scaledFit) {
    rfb.scaleViewport = true
    rfb.clipViewport = false
  } else {
    rfb.scaleViewport = false
    rfb.clipViewport = true
  }
  window.dispatchEvent(new Event('resize'))
}

export default function VNCViewer({ vmName, port = -1, kubeVirtNamespace }: Props) {
  const [fullscreen, setFullscreen] = useState(false)
  const [status, setStatus] = useState<'loading' | 'connecting' | 'connected' | 'disconnected'>('loading')
  /** Soft cursor dot helps when the remote cursor shape is delayed (common on Windows before drivers). */
  const [showDotCursor, setShowDotCursor] = useState(true)
  /** Scaling to fit can blur and sometimes hurts pointer feel; native 1:1 + scroll is sharper/snappier. */
  const [scaledFit, setScaledFit] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const rfbRef = useRef<{ disconnect: () => void; sendCtrlAltDel?: () => void; showDotCursor: boolean; clipViewport?: boolean; scaleViewport?: boolean } | null>(null)

  const scaledFitRef = useRef(scaledFit)
  const showDotCursorRef = useRef(showDotCursor)
  scaledFitRef.current = scaledFit
  showDotCursorRef.current = showDotCursor

  useEffect(() => {
    const kube = Boolean(kubeVirtNamespace)
    if ((!kube && (port == null || port <= 0)) || (kube && !kubeVirtNamespace) || !containerRef.current) return

    let cancelled = false

    async function connect() {
      if (!containerRef.current || cancelled) return

      // Clear container
      containerRef.current.innerHTML = ''

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      let token: string
      try {
        token = await getWsToken()
      } catch {
        setStatus('disconnected')
        return
      }
      if (cancelled) return
      const wsUrl = kube && kubeVirtNamespace
        ? `${protocol}//${window.location.host}/ws/v1/k8s-kubevirt/${encodeURIComponent(kubeVirtNamespace)}/${encodeURIComponent(vmName)}/vnc?token=${encodeURIComponent(token)}`
        : `${protocol}//${window.location.host}/ws/v1/vnc/${encodeURIComponent(vmName)}?token=${encodeURIComponent(token)}`

      const wireCommon = (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rfb: any,
      ) => {
        applyViewportMode(rfb, scaledFitRef.current)
        rfb.resizeSession = false
        rfb.focusOnClick = true
        rfb.showDotCursor = showDotCursorRef.current

        rfb.addEventListener('connect', () => {
          if (!cancelled) setStatus('connected')
        })
        rfb.addEventListener('disconnect', () => {
          if (!cancelled) setStatus('disconnected')
        })
        rfb.addEventListener('credentialsrequired', () => {
          rfb.sendCredentials({ password: '' })
        })

        rfbRef.current = rfb
      }

      // Dynamically import RFB from server-hosted noVNC (ESM module)
      // This is the same noVNC that's served at /novnc/core/rfb.js
      try {
        setStatus('connecting')
        // Load noVNC RFB from server-hosted ESM files (same approach as Cockpit)
        // Use Function constructor to avoid bundler trying to resolve the path
        const loadRfb = new Function('return import("/novnc/core/rfb.js")')
        const module = await loadRfb() as { default: new (...args: unknown[]) => Record<string, unknown> }
        const RFB = module.default

        if (cancelled || !containerRef.current) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rfb: any = new (RFB as any)(containerRef.current, wsUrl, { showDotCursor: showDotCursorRef.current })
        wireCommon(rfb)
      } catch (e) {
        console.error('Failed to load noVNC RFB:', e)

        // Fallback: try novnc-core npm package
        try {
          const { default: RFB } = await import(/* @vite-ignore */ 'novnc-core/lib/rfb')
          if (cancelled || !containerRef.current) return

          const rfb = new RFB(containerRef.current, wsUrl, { showDotCursor: showDotCursorRef.current })
          wireCommon(rfb)
        } catch {
          setStatus('disconnected')
        }
      }
    }

    connect()

    return () => {
      cancelled = true
      if (rfbRef.current && typeof rfbRef.current.disconnect === 'function') {
        try { rfbRef.current.disconnect() } catch { /* ignore */ }
      }
      rfbRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reconnect only when VM/port changes; viewport toggled via effect below
  }, [vmName, port, kubeVirtNamespace])

  useEffect(() => {
    const rfb = rfbRef.current
    if (!rfb || status !== 'connected') return
    applyViewportMode(rfb as { scaleViewport: boolean; clipViewport: boolean }, scaledFit)
  }, [scaledFit, status])

  useEffect(() => {
    const rfb = rfbRef.current
    if (!rfb || status !== 'connected') return
    rfb.showDotCursor = showDotCursor
  }, [showDotCursor, status])

  function sendCtrlAltDel() {
    rfbRef.current?.sendCtrlAltDel?.()
  }

  if (!kubeVirtNamespace && (port == null || port <= 0)) {
    return (
      <div className="flex flex-col items-center justify-center bg-black rounded-lg p-12 text-center" style={{ minHeight: '500px' }}>
        <Monitor className="w-16 h-16 text-slate-600 mb-4" />
        <h3 className="text-lg font-semibold text-slate-400 mb-2">VNC Not Available</h3>
        <p className="text-sm text-slate-500 max-w-md">
          VM '{vmName}' doesn't have a VNC port assigned. Make sure the VM is running and has VNC graphics configured.
        </p>
      </div>
    )
  }

  const statusColor = status === 'connected' ? 'bg-green-500' : status === 'connecting' || status === 'loading' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
  const statusText = status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : status === 'loading' ? 'Loading VNC client...' : 'Disconnected'

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-50 bg-black flex flex-col h-screen'
          : 'flex flex-col rounded-b-lg overflow-hidden'
      }
    >
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 rounded-t-lg shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
          <span className="text-sm text-slate-300">VNC — {kubeVirtNamespace ? `${kubeVirtNamespace}/${vmName}` : vmName}</span>
          <span className="text-xs text-slate-500">{statusText}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={sendCtrlAltDel}
            disabled={status !== 'connected'}
            className="px-2 py-1 rounded text-xs transition flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Send Ctrl+Alt+Del (Windows login, Task Manager)"
          >
            <Keyboard className="w-3 h-3" /> Ctrl+Alt+Del
          </button>
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-slate-600"
              checked={showDotCursor}
              onChange={(e) => setShowDotCursor(e.target.checked)}
            />
            Local cursor
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-slate-600"
              checked={scaledFit}
              onChange={(e) => setScaledFit(e.target.checked)}
            />
            Scale to fit
          </label>
          {status === 'disconnected' && (
            <button type="button" onClick={() => window.location.reload()} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Reconnect</button>
          )}
          <button type="button" onClick={() => setFullscreen(!fullscreen)} className="p-1.5 hover:bg-slate-700 rounded transition" title="Fullscreen">
            {fullscreen ? <Minimize className="w-4 h-4 text-slate-400" /> : <Maximize className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500 px-4 py-2 bg-slate-900/40 border-b border-slate-700/50 leading-relaxed shrink-0">
        {kubeVirtNamespace
          ? (
              <>
                KubeVirt graphics via the cluster API (machina runs a short-lived <code className="text-slate-400">kubectl proxy</code> on the daemon host).
                The VMI must be running; if connect fails, confirm <code className="text-slate-400">kubectl</code> works for your session user.
              </>
            )
          : (
              <>
                Graphical installers stream full-screen bitmaps over VNC — pointer movement can lag behind display updates,
                especially at high resolutions. Leave <strong className="text-slate-400">Scale to fit</strong> off for 1:1
                mapping (scroll the panel), keep <strong className="text-slate-400">Local cursor</strong> on for immediate
                feedback, and use <strong className="text-slate-400">SPICE</strong> when the VM offers it.
              </>
            )}
      </p>
      <div
        ref={containerRef}
        className={`w-full bg-black ${fullscreen ? 'flex-1 min-h-0' : ''}`}
        style={{
          height: fullscreen ? undefined : 'min(900px, calc(100vh - 13rem))',
          backgroundColor: '#000',
        }}
      />
    </div>
  )
}
