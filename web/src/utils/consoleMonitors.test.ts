// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { describe, expect, it } from 'vitest'
import { inferConsoleMonitors, monitorScrollTarget } from './consoleMonitors'

describe('consoleMonitors', () => {
  it('infers dual 1920 panels from 3840x1080', () => {
    const m = inferConsoleMonitors(3840, 1080)
    expect(m).toHaveLength(2)
    expect(m[0]).toMatchObject({ x: 0, width: 1920, height: 1080 })
    expect(m[1]).toMatchObject({ x: 1920, width: 1920, height: 1080 })
  })

  it('returns empty for single 1920x1080', () => {
    expect(inferConsoleMonitors(1920, 1080)).toEqual([])
  })

  it('scroll target for active monitor', () => {
    const m = inferConsoleMonitors(3840, 1080)!
    expect(monitorScrollTarget(m, 1)).toEqual({ left: 1920, top: 0 })
    expect(monitorScrollTarget(m, 'all')).toBeNull()
  })
})
