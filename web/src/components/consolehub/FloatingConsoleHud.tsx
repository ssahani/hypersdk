// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState } from 'react'
import { useConsoleViewportOptional } from './ConsoleViewportContext'

type Props = {
  visible?: boolean
}

export default function FloatingConsoleHud({ visible = true }: Props) {
  const vp = useConsoleViewportOptional()
  const [show, setShow] = useState(true)
  const [idle, setIdle] = useState(false)

  useEffect(() => {
    if (!visible) return
    let timer: ReturnType<typeof setTimeout>
    const reset = () => {
      setShow(true)
      setIdle(false)
      clearTimeout(timer)
      timer = setTimeout(() => setIdle(true), 3000)
    }
    reset()
    window.addEventListener('mousemove', reset)
    return () => {
      window.removeEventListener('mousemove', reset)
      clearTimeout(timer)
    }
  }, [visible])

  if (!visible || !vp) return null

  const tone = vp.connected ? 'bg-emerald-500' : 'bg-amber-500'
  const label = vp.connected ? 'Connected' : 'Disconnected'

  return (
    <div
      className={`absolute top-3 right-3 z-30 transition-opacity duration-300 ${show && !idle ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-black/60 backdrop-blur-md text-xs text-slate-200 shadow-lg">
        <span className={`w-2 h-2 rounded-full ${tone}`} />
        <span>{label}</span>
        <span className="text-slate-500">·</span>
        <span className="uppercase text-slate-400">{vp.protocol.replace('guacamole_', '')}</span>
        <span className="text-slate-500">·</span>
        <span className="font-mono text-slate-300">{vp.resolution}</span>
        <span className="text-slate-500">·</span>
        <span className="text-slate-400 capitalize">{vp.mode}</span>
        {vp.mode === 'zoom' ? (
          <>
            <span className="text-slate-500">·</span>
            <span>{vp.zoom}%</span>
          </>
        ) : null}
      </div>
    </div>
  )
}
