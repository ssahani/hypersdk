// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type ViewportMode = 'fit' | 'native' | 'scroll' | 'zoom'
export type ZoomLevel = 75 | 100 | 125 | 150 | 200

export type ViewportState = {
  mode: ViewportMode
  zoom: ZoomLevel
  scaledFit: boolean
  guestWidth: number
  guestHeight: number
  scrollLeft: number
  scrollTop: number
  viewportWidth: number
  viewportHeight: number
  connected: boolean
  protocol: string
  resolution: string
}

type ViewportCtx = ViewportState & {
  setMode: (mode: ViewportMode) => void
  setZoom: (zoom: ZoomLevel) => void
  setScaledFit: (v: boolean) => void
  setGuestSize: (w: number, h: number) => void
  setScroll: (left: number, top: number) => void
  setViewportSize: (w: number, h: number) => void
  setConnected: (v: boolean) => void
  setProtocol: (p: string) => void
  setResolution: (r: string) => void
}

const defaultState: ViewportState = {
  mode: 'fit',
  zoom: 100,
  scaledFit: true,
  guestWidth: 0,
  guestHeight: 0,
  scrollLeft: 0,
  scrollTop: 0,
  viewportWidth: 0,
  viewportHeight: 0,
  connected: false,
  protocol: 'novnc',
  resolution: '—',
}

const Ctx = createContext<ViewportCtx | null>(null)

export function ConsoleViewportProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ViewportState>(defaultState)

  const setMode = useCallback((mode: ViewportMode) => {
    setState((s) => ({
      ...s,
      mode,
      scaledFit: mode === 'fit',
    }))
  }, [])

  const setZoom = useCallback((zoom: ZoomLevel) => {
    setState((s) => ({ ...s, zoom, mode: 'zoom', scaledFit: false }))
  }, [])

  const setScaledFit = useCallback((scaledFit: boolean) => {
    setState((s) => ({ ...s, scaledFit, mode: scaledFit ? 'fit' : 'native' }))
  }, [])

  const setGuestSize = useCallback((guestWidth: number, guestHeight: number) => {
    setState((s) => ({
      ...s,
      guestWidth,
      guestHeight,
      resolution: guestWidth > 0 ? `${guestWidth}×${guestHeight}` : s.resolution,
    }))
  }, [])

  const setScroll = useCallback((scrollLeft: number, scrollTop: number) => {
    setState((s) => ({ ...s, scrollLeft, scrollTop }))
  }, [])

  const setViewportSize = useCallback((viewportWidth: number, viewportHeight: number) => {
    setState((s) => ({ ...s, viewportWidth, viewportHeight }))
  }, [])

  const setConnected = useCallback((connected: boolean) => {
    setState((s) => ({ ...s, connected }))
  }, [])

  const setProtocol = useCallback((protocol: string) => {
    setState((s) => ({ ...s, protocol }))
  }, [])

  const setResolution = useCallback((resolution: string) => {
    setState((s) => ({ ...s, resolution }))
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      setMode,
      setZoom,
      setScaledFit,
      setGuestSize,
      setScroll,
      setViewportSize,
      setConnected,
      setProtocol,
      setResolution,
    }),
    [state, setMode, setZoom, setScaledFit, setGuestSize, setScroll, setViewportSize, setConnected, setProtocol, setResolution],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useConsoleViewport() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useConsoleViewport requires ConsoleViewportProvider')
  return ctx
}

export function useConsoleViewportOptional() {
  return useContext(Ctx)
}
