// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ActiveMonitor, ConsoleMonitor } from '../../utils/consoleMonitors'
import { inferConsoleMonitors } from '../../utils/consoleMonitors'

export type ViewportMode = 'fit' | 'fill' | 'native' | 'scroll' | 'zoom' | 'stretch'
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
  monitors: ConsoleMonitor[]
  activeMonitor: ActiveMonitor
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
  setMonitors: (monitors: ConsoleMonitor[]) => void
  setActiveMonitor: (monitor: ActiveMonitor) => void
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
  monitors: [],
  activeMonitor: 'all',
}

const Ctx = createContext<ViewportCtx | null>(null)

export function ConsoleViewportProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ViewportState>(defaultState)

  const setMode = useCallback((mode: ViewportMode) => {
    setState((s) => ({
      ...s,
      mode,
      scaledFit: mode === 'fit' || mode === 'fill',
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

  const setMonitors = useCallback((monitors: ConsoleMonitor[]) => {
    setState((s) => ({
      ...s,
      monitors,
      activeMonitor: monitors.length > 1 ? s.activeMonitor : 'all',
    }))
  }, [])

  const setActiveMonitor = useCallback((activeMonitor: ActiveMonitor) => {
    setState((s) => ({ ...s, activeMonitor }))
  }, [])

  useEffect(() => {
    const onTestGuestSize = (event: Event) => {
      const detail = (event as CustomEvent<{ width?: number; height?: number }>).detail
      const width = detail?.width ?? 0
      const height = detail?.height ?? 0
      if (width <= 0 || height <= 0) return
      setGuestSize(width, height)
      setMonitors(inferConsoleMonitors(width, height))
    }
    window.addEventListener('machina:console-guest-size', onTestGuestSize)
    return () => window.removeEventListener('machina:console-guest-size', onTestGuestSize)
  }, [setGuestSize, setMonitors])

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
      setMonitors,
      setActiveMonitor,
    }),
    [state, setMode, setZoom, setScaledFit, setGuestSize, setScroll, setViewportSize, setConnected, setProtocol, setResolution, setMonitors, setActiveMonitor],
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
