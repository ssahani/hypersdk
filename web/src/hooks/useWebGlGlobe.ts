// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useEffect, useState, type RefObject } from 'react'

export type WebGlGlobeSite = {
  name: string
  hosts: number
  healthPct: number
  lat: number
  lng: number
}

function healthColor(pct: number): number {
  if (pct >= 90) return 0x34d399
  if (pct >= 70) return 0xfbbf24
  return 0xf87171
}

export function useWebGlGlobe(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  sites: WebGlGlobeSite[],
  enabled: boolean,
): boolean {
  const [webGlActive, setWebGlActive] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setWebGlActive(false)
      return undefined
    }
    const canvas = canvasRef.current
    if (!canvas) return undefined

    let disposed = false
    let raf = 0
    let cleanupScene: (() => void) | undefined

    const boot = async () => {
      let THREE: typeof import('three')
      try {
        THREE = await import('three')
      } catch {
        if (!disposed) setWebGlActive(false)
        return
      }
      if (disposed || !canvasRef.current) return

      let renderer: import('three').WebGLRenderer
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
      } catch {
        if (!disposed) setWebGlActive(false)
        return
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setClearColor(0x020617, 0)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
      camera.position.set(0, 0, 2.6)

      const disposables: Array<{ dispose: () => void }> = []
      const globe = new THREE.Mesh(
        new THREE.SphereGeometry(1, 48, 48),
        new THREE.MeshBasicMaterial({ color: 0x0c4a6e, wireframe: true, transparent: true, opacity: 0.35 }),
      )
      disposables.push(globe.geometry, globe.material as import('three').Material)
      scene.add(globe)

      const markerGroup = new THREE.Group()
      scene.add(markerGroup)

      for (const site of sites) {
        const phi = Math.PI / 2 - site.lat
        const theta = site.lng
        const r = 1.02 + Math.min(0.08, site.hosts * 0.008)
        const x = r * Math.sin(phi) * Math.cos(theta)
        const y = r * Math.cos(phi)
        const z = r * Math.sin(phi) * Math.sin(theta)
        const size = 0.02 + Math.min(0.05, site.hosts * 0.004)
        const geo = new THREE.SphereGeometry(size, 12, 12)
        const mat = new THREE.MeshBasicMaterial({ color: healthColor(site.healthPct) })
        disposables.push(geo, mat)
        const dot = new THREE.Mesh(geo, mat)
        dot.position.set(x, y, z)
        markerGroup.add(dot)
      }

      const resize = () => {
        const w = canvas.clientWidth
        const h = canvas.clientHeight
        if (w < 8 || h < 8) return
        renderer.setSize(w, h, false)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }

      const ro = new ResizeObserver(resize)
      ro.observe(canvas)
      resize()

      if (!disposed) setWebGlActive(true)
      let frame = 0

      const draw = () => {
        if (disposed) return
        frame += 1
        globe.rotation.y = frame * 0.004
        markerGroup.rotation.y = frame * 0.004
        renderer.render(scene, camera)
        raf = requestAnimationFrame(draw)
      }
      raf = requestAnimationFrame(draw)

      cleanupScene = () => {
        ro.disconnect()
        cancelAnimationFrame(raf)
        for (const d of disposables) d.dispose()
        renderer.dispose()
      }
    }

    void boot()

    return () => {
      disposed = true
      setWebGlActive(false)
      cancelAnimationFrame(raf)
      cleanupScene?.()
    }
  }, [canvasRef, enabled, sites])

  return webGlActive
}
