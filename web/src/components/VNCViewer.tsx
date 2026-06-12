// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

import { useEffect, useRef, useState } from 'react'
import { Keyboard, Maximize, Minimize, Monitor, RefreshCw } from 'lucide-react'
import { getWsToken } from '../api/client'
import { statusBgClass } from '../utils/semanticColors'
import { useConsoleViewportOptional } from './consolehub/ConsoleViewportContext'
import { useConsoleClipboardOptional } from './consolehub/ConsoleClipboardContext'

function wsConnQs(libvirtConnection?: string | null): string {
  if (!libvirtConnection || libvirtConnection === 'system') return ''
  return `&connection=${encodeURIComponent(libvirtConnection)}`
}

interface Props {
  vmName: string
  port?: number
  /** When set, connect to KubeVirt VNC via machina (kubectl proxy + API subresource) instead of libvirt. */
  kubeVirtNamespace?: string
  /** `session` when the domain is on qemu:///session (dual libvirt). */
  libvirtConnection?: string | null
  /** Pre-built WebSocket URL (platform controller proxy). Skips libvirt/KubeVirt URL construction. */
  wsUrl?: string
  /** Default for “Scale to fit” — on for platform desktop consoles, off for classic 1:1 installers. */
  defaultScaledFit?: boolean
  /** Stretch the viewer to available viewport height (platform shell). */
  fillViewport?: boolean
  /** CSS length subtracted from 100dvh when fillViewport is set. */
  fillViewportOffset?: string
  /** Refresh console session (fetch new WS token) instead of full page reload. */
  onReconnect?: () => void
  /** Bump when parent re-issues WS URL (Classic ConsoleHub connectKey). */
  connectKey?: number
  /** Machine Cockpit — hide toolbar; viewport controlled by floating HUD. */
  cockpitMode?: boolean
  /** Called when VNC canvas is ready (for Cinema screenshots). */
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
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

export default function VNCViewer({
  vmName,
  port = -1,
  kubeVirtNamespace,
  libvirtConnection,
  wsUrl: wsUrlOverride,
  defaultScaledFit = false,
  fillViewport = false,
  fillViewportOffset = '13rem',
  onReconnect,
  cockpitMode = false,
  connectKey = 0,
  onCanvasReady,
}: Props) {
  const vp = useConsoleViewportOptional()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [status, setStatus] = useState<'loading' | 'connecting' | 'connected' | 'disconnected'>('loading')
  /** Soft cursor dot helps when the remote cursor shape is delayed (common on Windows before drivers). */
  const [showDotCursor, setShowDotCursor] = useState(true)
  /** Scaling to fit can blur and sometimes hurts pointer feel; native 1:1 + scroll is sharper/snappier. */
  const [scaledFit, setScaledFit] = useState(defaultScaledFit || cockpitMode)
  const containerRef = useRef<HTMLDivElement>(null)
  const rfbRef = useRef<{ disconnect: () => void; sendCtrlAltDel?: () => void; clipboardPasteFrom?: (text: string) => void; showDotCursor: boolean; clipViewport?: boolean; scaleViewport?: boolean; addEventListener?: (type: string, fn: (e: Event) => void) => void; removeEventListener?: (type: string, fn: (e: Event) => void) => void } | null>(null)
  const clip = useConsoleClipboardOptional()
  const clipHandlerRef = useRef<((ev: Event) => void) | null>(null)

  const scaledFitRef = useRef(scaledFit)
  const showDotCursorRef = useRef(showDotCursor)
  scaledFitRef.current = scaledFit
  showDotCursorRef.current = showDotCursor

  useEffect(() => {
    const kube = Boolean(kubeVirtNamespace)
    const directWs = Boolean(wsUrlOverride)
    if (
      !directWs
      && ((!kube && (port == null || port <= 0)) || (kube && !kubeVirtNamespace))
    ) return

    let cancelled = false
    let raf = 0

    async function connect() {
      // Wait until the canvas container is mounted (flex layout can attach ref after first paint).
      for (let i = 0; i < 120; i++) {
        if (cancelled) return
        if (containerRef.current) break
        await new Promise<void>((resolve) => {
          raf = requestAnimationFrame(() => resolve())
        })
      }
      if (!containerRef.current || cancelled) return

      // Clear container
      containerRef.current.innerHTML = ''

      let wsUrl = wsUrlOverride
      if (!wsUrl) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        let token: string
        try {
          token = await getWsToken()
        } catch {
          setStatus('disconnected')
          return
        }
        if (cancelled) return
        const cq = wsConnQs(libvirtConnection)
        const encVm = encodeURIComponent(vmName)
        wsUrl = kube && kubeVirtNamespace
          ? `${protocol}//${window.location.host}/ws/v1/k8s-kubevirt/${encodeURIComponent(kubeVirtNamespace)}/${encVm}/vnc?token=${encodeURIComponent(token)}`
          : `${protocol}//${window.location.host}/ws/v1/vnc/${encVm}?token=${encodeURIComponent(token)}${cq}`
      }

      const syncGuestSize = (rfb: { _fbWidth?: number; _fbHeight?: number }) => {
        const w = rfb._fbWidth ?? 0
        const h = rfb._fbHeight ?? 0
        if (w > 0 && h > 0) vp?.setGuestSize(w, h)
      }

      const wireCommon = (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rfb: any,
      ) => {
        applyViewportMode(rfb, scaledFitRef.current)
        rfb.resizeSession = false
        rfb.focusOnClick = true
        rfb.showDotCursor = showDotCursorRef.current

        rfb.addEventListener('connect', () => {
          if (!cancelled) {
            setStatus('connected')
            vp?.setConnected(true)
            syncGuestSize(rfb)
            applyViewportMode(rfb, scaledFitRef.current)
            window.dispatchEvent(new Event('resize'))
            const canvas = containerRef.current?.querySelector('canvas')
            onCanvasReady?.(canvas as HTMLCanvasElement | null)
            if (clip) {
              const onGuestClipboard = (ev: Event) => {
                const text = (ev as CustomEvent<{ text: string }>).detail?.text ?? ''
                if (text) clip.onGuestClipboard(text)
              }
              clipHandlerRef.current = onGuestClipboard
              rfb.addEventListener('clipboard', onGuestClipboard)
              clip.registerBridge({
                pasteToGuest: (text: string) => {
                  rfb.clipboardPasteFrom?.(text)
                },
              })
            }
            scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            requestAnimationFrame(() => {
              syncGuestSize(rfb)
              applyViewportMode(rfb, scaledFitRef.current)
              window.dispatchEvent(new Event('resize'))
            })
            setTimeout(() => {
              if (!cancelled) {
                syncGuestSize(rfb)
                window.dispatchEvent(new Event('resize'))
              }
            }, 250)
          }
        })
        rfb.addEventListener('disconnect', () => {
          if (!cancelled) {
            setStatus('disconnected')
            vp?.setConnected(false)
            vp?.setGuestSize(0, 0)
            onCanvasReady?.(null)
            if (clip) {
              if (clipHandlerRef.current) {
                rfb.removeEventListener('clipboard', clipHandlerRef.current)
                clipHandlerRef.current = null
              }
              clip.registerBridge(null)
            }
          }
        })
        rfb.addEventListener('desktopname', () => syncGuestSize(rfb))
        rfb.addEventListener('resize', () => {
          syncGuestSize(rfb)
          window.dispatchEvent(new Event('resize'))
        })
        rfb.addEventListener('credentialsrequired', () => {
          rfb.sendCredentials({ password: '' })
        })

        rfbRef.current = rfb
      }

      // Prefer bundled novnc-core (always shipped with the web UI). Fall back to system
      // noVNC at /novnc/ when the daemon serves it (install.sh installs the novnc package).
      try {
        setStatus('connecting')
        const { default: RFB } = await import(/* @vite-ignore */ 'novnc-core/lib/rfb')
        if (cancelled || !containerRef.current) return

        const rfb = new RFB(containerRef.current, wsUrl, {
          showDotCursor: showDotCursorRef.current,
          shared: true,
        })
        wireCommon(rfb)
      } catch (e) {
        console.error('Failed to load bundled noVNC RFB:', e)

        try {
          const loadRfb = new Function('return import("/novnc/core/rfb.js")')
          const module = await loadRfb() as { default: new (...args: unknown[]) => Record<string, unknown> }
          const RFB = module.default
          if (cancelled || !containerRef.current) return

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rfb: any = new (RFB as any)(containerRef.current, wsUrl, {
            showDotCursor: showDotCursorRef.current,
            shared: true,
          })
          wireCommon(rfb)
        } catch {
          setStatus('disconnected')
        }
      }
    }

    connect()

    return () => {
      cancelled = true
      if (raf) cancelAnimationFrame(raf)
      if (rfbRef.current) {
        const rfb = rfbRef.current
        if (clipHandlerRef.current && rfb.removeEventListener) {
          rfb.removeEventListener('clipboard', clipHandlerRef.current)
        }
        clipHandlerRef.current = null
        clip?.registerBridge(null)
        if (typeof rfb.disconnect === 'function') {
          try { rfb.disconnect() } catch { /* ignore */ }
        }
      }
      rfbRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reconnect when VM/port/ws URL/connectKey changes
  }, [vmName, port, kubeVirtNamespace, libvirtConnection, wsUrlOverride, connectKey, clip])

  useEffect(() => {
    if (!fillViewport || status !== 'connected') return
    const onResize = () => window.dispatchEvent(new Event('resize'))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [fillViewport, status])

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

  useEffect(() => {
    if (!cockpitMode || !vp) return
    const mode = vp.mode
    setScaledFit(mode === 'fit' || mode === 'fill' || mode === 'stretch')
  }, [cockpitMode, vp?.mode, vp])

  useEffect(() => {
    const rfb = rfbRef.current
    if (!rfb || status !== 'connected' || !cockpitMode || !vp) return
    const mode = vp.mode
    const fit = mode === 'fit' || mode === 'fill' || mode === 'stretch'
    applyViewportMode(rfb as { scaleViewport: boolean; clipViewport: boolean }, fit)
    window.dispatchEvent(new Event('resize'))
  }, [cockpitMode, vp?.mode, status, vp])

  useEffect(() => {
    if (!cockpitMode || !vp || !scrollRef.current) return
    const el = scrollRef.current
    const ro = new ResizeObserver(() => {
      vp.setViewportSize(el.clientWidth, el.clientHeight)
      const rfb = rfbRef.current
      if (rfb && status === 'connected' && el.clientWidth > 0 && el.clientHeight > 0) {
        applyViewportMode(rfb as { scaleViewport: boolean; clipViewport: boolean }, scaledFitRef.current)
        window.dispatchEvent(new Event('resize'))
      }
    })
    ro.observe(el)
    vp.setViewportSize(el.clientWidth, el.clientHeight)
    return () => ro.disconnect()
  }, [cockpitMode, vp, status])

  useEffect(() => {
    if (!cockpitMode || !vp || !scrollRef.current) return
    const el = scrollRef.current
    el.scrollLeft = vp.scrollLeft
    el.scrollTop = vp.scrollTop
  }, [cockpitMode, vp?.scrollLeft, vp?.scrollTop, vp])

  function sendCtrlAltDel() {
    rfbRef.current?.sendCtrlAltDel?.()
  }

  if (!wsUrlOverride && !kubeVirtNamespace && (port == null || port <= 0)) {
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

  const vncTone = status === 'connected' ? 'ok' : status === 'connecting' || status === 'loading' ? 'warn' : 'error'
  const statusColor = `${statusBgClass(vncTone)}${vncTone === 'warn' ? ' animate-pulse' : ''}`
  const statusText = status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : status === 'loading' ? 'Loading VNC client...' : 'Disconnected'

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-50 bg-black flex flex-col h-screen'
          : fillViewport || cockpitMode
            ? 'flex flex-col flex-1 min-h-0 h-full w-full rounded-lg overflow-hidden'
            : 'flex flex-col rounded-b-lg overflow-hidden'
      }
    >
      {!cockpitMode ? (
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
            <button
              type="button"
              onClick={() => (onReconnect ? onReconnect() : window.location.reload())}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Reconnect
            </button>
          )}
          <button type="button" onClick={() => setFullscreen(!fullscreen)} className="p-1.5 hover:bg-slate-700 rounded transition" title="Fullscreen">
            {fullscreen ? <Minimize className="w-4 h-4 text-slate-400" /> : <Maximize className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </div>
      ) : null}
      {!cockpitMode ? (
      <p className="text-xs text-slate-500 px-4 py-2 bg-slate-900/40 border-b border-slate-700/50 leading-relaxed shrink-0">
        {status === 'disconnected' && (
          <span className="block text-amber-300/90 mb-1">
            Console disconnected — ensure the VM is running, wait for cloud-init on first boot, then Reconnect.
          </span>
        )}
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
      ) : null}
      <div
        ref={scrollRef}
        className={`relative w-full h-full bg-black overflow-auto ${fullscreen || fillViewport || cockpitMode ? 'flex-1 min-h-[320px]' : ''}`}
        onScroll={cockpitMode && vp ? (e) => vp.setScroll(e.currentTarget.scrollLeft, e.currentTarget.scrollTop) : undefined}
        style={{
          height: cockpitMode
            ? '100%'
            : fullscreen
            ? undefined
            : fillViewport
              ? `max(480px, calc(100dvh - ${fillViewportOffset}))`
              : 'min-h-[480px]',
          backgroundColor: '#000',
        }}
      >
        <div
          ref={containerRef}
          className={`inline-block min-w-full min-h-full ${cockpitMode && vp?.mode === 'stretch' ? 'w-full h-full [&_canvas]:!w-full [&_canvas]:!h-full' : ''}`}
          style={{
            transform: cockpitMode && vp?.mode === 'zoom' ? `scale(${vp.zoom / 100})` : undefined,
            transformOrigin: 'top left',
          }}
        />
        {cockpitMode && status === 'connected' ? (
          <p className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 max-w-md text-center text-xs text-slate-400 bg-black/70 border border-white/10 rounded-lg px-3 py-2 pointer-events-none">
            Blank display? Linux cloud images often log to <strong className="text-slate-200">Serial</strong> only — use Serial or SSH in the dock. Click the canvas, then try <strong className="text-slate-200">Native</strong> or <strong className="text-slate-200">Ctrl+Alt+Del</strong>.
          </p>
        ) : null}
      </div>
    </div>
  )
}
