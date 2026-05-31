// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { describe, expect, it } from 'vitest'
import { groupSpotlightByZone, spotlightNavForTier, spotlightZoneOrder } from './platformSpotlightNav'

describe('spotlightNavForTier', () => {
  it('groups desktop hubs under Platform hubs zone', () => {
    const entries = spotlightNavForTier('power')
    const hubs = entries.filter((entry) => entry.kind === 'hub')
    expect(hubs.length).toBeGreaterThan(0)
    expect(hubs.every((entry) => entry.zone === 'Platform hubs')).toBe(true)
  })

  it('orders Platform hubs before sidebar zones', () => {
    const order = spotlightZoneOrder()
    expect(order[0]).toBe('Platform hubs')
    const grouped = groupSpotlightByZone(spotlightNavForTier('advanced'))
    expect(grouped[0]?.zone).toBe('Platform hubs')
  })

  it('includes settings panes on power tier', () => {
    const entries = spotlightNavForTier('power')
    const settings = entries.filter((entry) => entry.zone === 'Settings')
    expect(settings.some((entry) => entry.label === 'Policy')).toBe(true)
    expect(settings.every((entry) => entry.path.includes('section='))).toBe(true)
  })
})
