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
} from 'lucide-react'
import type { ViewportMode, ZoomLevel } from './ConsoleViewportContext'
import { useConsoleViewportOptional } from './ConsoleViewportContext'

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
}: Props) {
  const vp = useConsoleViewportOptional()
  const [show, setShow] = useState(true)
  const [idle, setIdle] = useState(false)
  const [powerOpen, setPowerOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const powerRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)

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

        <button type="button" className={btn} title="Clipboard (use browser paste in canvas)">
          <Clipboard className="w-3.5 h-3.5" />
        </button>

        {onOpenAi ? (
          <button type="button" className={`${btn} border-violet-500/40 text-violet-200`} onClick={onOpenAi}>
            <Sparkles className="w-3.5 h-3.5" />
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
