// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useRef, useState } from 'react'
import {
  Camera,
  Clipboard,
  Keyboard,
  LayoutGrid,
  MoreHorizontal,
  PanelRight,
  Power,
  RotateCcw,
  Sparkles,
  Square,
  Users,
} from 'lucide-react'
import type { ViewportMode, ZoomLevel } from './ConsoleViewportContext'
import { useConsoleViewportOptional } from './ConsoleViewportContext'
import { useConsoleClipboardOptional } from './ConsoleClipboardContext'
import { useToastContext } from '../../contexts/ToastContext'

type Props = {
  visible?: boolean
  vmId: string
  readOnly?: boolean
  onCtrlAltDel?: () => void
  onSendKey?: (preset: 'esc' | 'ctrl_alt_del' | 'alt_tab') => void
  onPower?: (action: 'shutdown' | 'reboot' | 'stop') => void
  onScreenshot?: () => void
  onOpenAi?: () => void
  onOpenOpsShelf?: () => void
  onOpenStudio?: () => void
  onSwitchLens?: (lens: string) => void
  onRecord?: () => void
  onShareView?: () => void
  shareBusy?: boolean
  activeProtocol?: string
  spiceAudioEnabled?: boolean
  onToggleSpiceAudio?: () => void
}

const ZOOM_LEVELS: ZoomLevel[] = [75, 100, 125, 150, 200]

export default function CinemaControlStrip({
  visible = true,
  vmId,
  readOnly = false,
  onCtrlAltDel,
  onSendKey,
  onPower,
  onScreenshot,
  onOpenAi,
  onOpenOpsShelf,
  onOpenStudio,
  onSwitchLens,
  onRecord,
  onShareView,
  shareBusy = false,
  activeProtocol = 'novnc',
  spiceAudioEnabled = false,
  onToggleSpiceAudio,
}: Props) {
  const vp = useConsoleViewportOptional()
  const clip = useConsoleClipboardOptional()
  const toast = useToastContext()
  const [show, setShow] = useState(true)
  const [idle, setIdle] = useState(false)
  const [powerOpen, setPowerOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [clipOpen, setClipOpen] = useState(false)
  const [localDraft, setLocalDraft] = useState('')
  const powerRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)
  const clipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!visible) return
    let timer: ReturnType<typeof setTimeout>
    const reset = () => {
      setShow(true)
      setIdle(false)
      clearTimeout(timer)
      timer = setTimeout(() => setIdle(true), 3500)
    }
    reset()
    window.addEventListener('mousemove', reset)
    return () => {
      window.removeEventListener('mousemove', reset)
      clearTimeout(timer)
    }
  }, [visible])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (powerRef.current && !powerRef.current.contains(e.target as Node)) setPowerOpen(false)
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
      if (clipRef.current && !clipRef.current.contains(e.target as Node)) setClipOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  if (!visible || !vp) return null

  const btn =
    'px-2.5 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 transition inline-flex items-center gap-1'

  const setMode = (mode: ViewportMode) => {
    vp.setMode(mode)
    setMoreOpen(false)
  }

  const openClipboard = async () => {
    if (clipOpen) {
      setClipOpen(false)
      return
    }
    try {
      const text = await navigator.clipboard.readText()
      setLocalDraft(text)
    } catch {
      setLocalDraft('')
    }
    setClipOpen(true)
  }

  const sendToGuest = async () => {
    if (!clip?.canSync || readOnly) return
    const ok = await clip.pasteLocalToGuest(localDraft)
    if (ok) {
      toast.success('Sent clipboard to VM')
      setClipOpen(false)
    } else {
      toast.error('Could not send clipboard — check permissions and VNC connection')
    }
  }

  const copyFromGuest = async () => {
    if (!clip?.guestText.trim()) return
    const ok = await clip.copyGuestToLocal()
    if (ok) {
      setLocalDraft(clip.guestText)
      toast.success('Copied VM clipboard to laptop')
    } else {
      toast.error('Could not copy to laptop clipboard')
    }
  }

  return (
    <div
      className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-30 transition-opacity duration-300 ${show && !idle ? 'opacity-100' : 'opacity-0 pointer-events-none hover:opacity-100 hover:pointer-events-auto'}`}
      data-testid="cinema-control-strip"
      data-idle={idle ? 'true' : 'false'}
    >
      <div className="flex flex-wrap items-center justify-center gap-1.5 px-2 py-1.5 rounded-2xl border border-white/10 bg-black/70 backdrop-blur-md shadow-xl">
        <div className="relative" ref={powerRef}>
          <button type="button" className={`${btn} ${readOnly ? 'opacity-40 cursor-not-allowed' : ''}`} disabled={readOnly} onClick={() => !readOnly && setPowerOpen((v) => !v)} title={readOnly ? 'Read-only session' : 'Power'}>
            <Power className="w-3.5 h-3.5" />
          </button>
          {powerOpen ? (
            <div className="absolute bottom-full left-0 mb-1 min-w-[10rem] rounded-lg border border-white/10 bg-slate-950/95 p-1 shadow-xl">
              {(['shutdown', 'reboot', 'stop'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  className="block w-full text-left px-2 py-1.5 text-xs text-slate-200 hover:bg-white/10 rounded capitalize"
                  onClick={() => {
                    onPower?.(a)
                    setPowerOpen(false)
                  }}
                >
                  {a === 'stop' ? 'Force off' : a}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <button type="button" className={`${btn} ${readOnly ? 'opacity-40 cursor-not-allowed' : ''}`} disabled={readOnly} onClick={() => !readOnly && onPower?.('reboot')} title="Reboot">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {onCtrlAltDel ? (
          <button type="button" className={btn} onClick={onCtrlAltDel}>
            <Keyboard className="w-3 h-3" /> Ctrl+Alt+Del
          </button>
        ) : null}

        <button type="button" className={btn} onClick={() => setMode('fit')}>Fit</button>
        <button type="button" className={btn} onClick={() => setMode('fill')}>Fill</button>
        <button type="button" className={btn} onClick={() => setMode('native')}>Native</button>
        <button type="button" className={btn} onClick={() => setMode('scroll')}>Scroll</button>

        {onScreenshot ? (
          <button type="button" className={btn} onClick={onScreenshot} title="Screenshot">
            <Camera className="w-3.5 h-3.5" />
          </button>
        ) : null}

        <div className="relative" ref={clipRef}>
          <button
            type="button"
            className={`${btn} ${readOnly ? 'opacity-40 cursor-not-allowed' : ''}`}
            disabled={readOnly}
            title={readOnly ? 'Read-only session' : 'Sync clipboard with VM'}
            data-testid="cinema-clipboard"
            onClick={() => void openClipboard()}
          >
            <Clipboard className="w-3.5 h-3.5" />
          </button>
          {clipOpen && !readOnly ? (
            <div
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-72 rounded-lg border border-white/10 bg-slate-950/95 p-3 shadow-xl space-y-2"
              data-testid="cinema-clipboard-panel"
            >
              <p className="text-[11px] font-medium text-slate-200">Clipboard sync</p>
              {!clip?.canSync ? (
                <p className="text-[10px] text-amber-200/80">Connect the display console to enable paste into the VM.</p>
              ) : null}
              <textarea
                className="w-full min-h-[4.5rem] rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-slate-100 font-mono resize-y"
                value={localDraft}
                onChange={(e) => setLocalDraft(e.target.value)}
                placeholder="Paste text to send to the VM…"
              />
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className={`${btn} text-[11px] ${!clip?.canSync ? 'opacity-40 cursor-not-allowed' : ''}`}
                  disabled={!clip?.canSync}
                  onClick={() => void sendToGuest()}
                >
                  Send to VM
                </button>
                {clip?.guestText.trim() ? (
                  <button type="button" className={`${btn} text-[11px]`} onClick={() => void copyFromGuest()}>
                    Copy from VM
                  </button>
                ) : null}
              </div>
              {clip?.guestText.trim() ? (
                <p className="text-[10px] text-slate-500 truncate" title={clip.guestText}>
                  VM clipboard: {clip.guestText.slice(0, 80)}{clip.guestText.length > 80 ? '…' : ''}
                </p>
              ) : (
                <p className="text-[10px] text-slate-500">Copy inside the VM to pull text here.</p>
              )}
            </div>
          ) : null}
        </div>

        {onOpenAi ? (
          <button type="button" className={`${btn} border-violet-500/40 text-violet-200`} onClick={onOpenAi}>
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        ) : null}

        {onShareView && !readOnly ? (
          <button
            type="button"
            className={`${btn} border-sky-500/30 text-sky-100`}
            disabled={shareBusy}
            onClick={onShareView}
            title="Share read-only view link"
            data-testid="cinema-share-view"
          >
            <Users className="w-3.5 h-3.5" />
          </button>
        ) : null}

        {onOpenStudio ? (
          <button type="button" className={btn} onClick={onOpenStudio} title="Machina Studio">
            <LayoutGrid className="w-3.5 h-3.5" /> Studio
          </button>
        ) : null}

        {onOpenOpsShelf ? (
          <button type="button" className={btn} onClick={onOpenOpsShelf} title="Ops Shelf">
            <PanelRight className="w-3.5 h-3.5" />
          </button>
        ) : null}

        <div className="relative" ref={moreRef}>
          <button type="button" className={btn} onClick={() => setMoreOpen((v) => !v)}>
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {moreOpen ? (
            <div className="absolute bottom-full right-0 mb-1 min-w-[11rem] rounded-lg border border-white/10 bg-slate-950/95 p-1 shadow-xl">
              {ZOOM_LEVELS.map((z) => (
                <button
                  key={z}
                  type="button"
                  className="block w-full text-left px-2 py-1.5 text-xs text-slate-200 hover:bg-white/10 rounded"
                  onClick={() => {
                    vp.setZoom(z)
                    setMoreOpen(false)
                  }}
                >
                  Zoom {z}%
                </button>
              ))}
              <button type="button" className="block w-full text-left px-2 py-1.5 text-xs text-slate-200 hover:bg-white/10 rounded" onClick={() => setMode('stretch')}>
                Stretch
              </button>
              {onSwitchLens ? (
                <>
                  <button type="button" className="block w-full text-left px-2 py-1.5 text-xs text-slate-200 hover:bg-white/10 rounded" onClick={() => { onSwitchLens('serial'); setMoreOpen(false) }}>
                    Serial
                  </button>
                  <button type="button" className="block w-full text-left px-2 py-1.5 text-xs text-slate-200 hover:bg-white/10 rounded" onClick={() => { onSwitchLens('shell'); setMoreOpen(false) }}>
                    Shell
                  </button>
                </>
              ) : null}
              {onSendKey ? (
                <button type="button" className="block w-full text-left px-2 py-1.5 text-xs text-slate-200 hover:bg-white/10 rounded" onClick={() => { onSendKey('esc'); setMoreOpen(false) }}>
                  Send Esc
                </button>
              ) : null}
              {(activeProtocol === 'spice' || activeProtocol === 'webrtc_spice') && onToggleSpiceAudio ? (
                <button
                  type="button"
                  className="block w-full text-left px-2 py-1.5 text-xs text-violet-200 hover:bg-white/10 rounded"
                  data-testid="cinema-spice-audio-toggle"
                  onClick={() => {
                    onToggleSpiceAudio()
                    setMoreOpen(false)
                  }}
                >
                  {spiceAudioEnabled ? 'Disable SPICE audio' : 'Enable SPICE audio'}
                </button>
              ) : null}
              <button
                type="button"
                className="block w-full text-left px-2 py-1.5 text-xs text-slate-400 hover:bg-white/10 rounded"
                onClick={() => {
                  onRecord?.()
                  setMoreOpen(false)
                }}
              >
                Record (coming soon)
              </button>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className={btn}
          onClick={() => document.documentElement.requestFullscreen?.()}
          title="Fullscreen"
        >
          <Square className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
