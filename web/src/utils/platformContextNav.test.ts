// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { describe, expect, it } from 'vitest'
import { isContextNavActive, splitContextNavItems, type ContextNavItem } from './platformContextNav'

const SAMPLE: ContextNavItem[] = [
  { to: '/platform/zeus/security', label: 'Security Center' },
  { to: '/platform/zeus/security/firewall', label: 'Firewall' },
  { to: '/platform/zeus/security/ports', label: 'Open Ports' },
  { to: '/platform/zeus/security/services', label: 'Allowed Apps' },
  { to: '/platform/zeus/security/activity', label: 'Activity' },
  { to: '/platform/zeus/security/compliance', label: 'Compliance' },
  { to: '/platform/zeus/security/k8s', label: 'Kubernetes' },
  { to: '/platform/zeus/security/policies', label: 'Policy Studio' },
]

describe('splitContextNavItems', () => {
  it('returns all items when under the cap', () => {
    const items = SAMPLE.slice(0, 4)
    const result = splitContextNavItems(items, '/platform/zeus/security/firewall', '')
    expect(result.visible).toHaveLength(4)
    expect(result.overflow).toHaveLength(0)
  })

  it('splits overflow when over the cap and active item is in primary range', () => {
    const result = splitContextNavItems(SAMPLE, '/platform/zeus/security/firewall', '', 6)
    expect(result.visible).toHaveLength(6)
    expect(result.overflow.length).toBeGreaterThan(0)
    expect(result.visible.some((item) => item.to === '/platform/zeus/security/firewall')).toBe(true)
  })

  it('keeps active item visible when it would otherwise overflow', () => {
    const result = splitContextNavItems(SAMPLE, '/platform/zeus/security/policies', '', 6)
    expect(result.visible.some((item) => item.to === '/platform/zeus/security/policies')).toBe(true)
    expect(result.overflow.some((item) => item.to === '/platform/zeus/security/policies')).toBe(false)
  })
})

describe('isContextNavActive', () => {
  it('matches settings sections via query params', () => {
    const item = { to: '/platform/settings?section=network', label: 'Network' }
    expect(isContextNavActive('/platform/settings', '?section=network', item)).toBe(true)
    expect(isContextNavActive('/platform/settings', '?section=general', item)).toBe(false)
  })

  it('matches hub roots exactly without catching child routes', () => {
    const hub = { to: '/platform/operations', label: 'Overview' }
    expect(isContextNavActive('/platform/operations', '', hub)).toBe(true)
    expect(isContextNavActive('/platform/operations/tasks', '', hub)).toBe(false)
  })
})
