// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { describe, expect, it } from 'vitest'
import { isPathAllowedForTier, minTierForPath } from './platformDesktopTier'

describe('isPathAllowedForTier', () => {
  it('allows observability and placement on power tier', () => {
    expect(isPathAllowedForTier('/platform/observability', 'power')).toBe(true)
    expect(isPathAllowedForTier('/platform/placement', 'power')).toBe(true)
  })

  it('allows settings workspace routes on power tier', () => {
    expect(isPathAllowedForTier('/platform/policy', 'power')).toBe(true)
    expect(isPathAllowedForTier('/platform/api-keys', 'power')).toBe(true)
    expect(isPathAllowedForTier('/platform/webhooks', 'power')).toBe(true)
    expect(isPathAllowedForTier('/platform/users', 'power')).toBe(true)
    expect(isPathAllowedForTier('/platform/enterprise', 'power')).toBe(true)
  })

  it('blocks observability and operations hub on normal tier', () => {
    expect(isPathAllowedForTier('/platform/observability', 'normal')).toBe(false)
    expect(isPathAllowedForTier('/platform/operations', 'normal')).toBe(false)
    expect(isPathAllowedForTier('/platform/infrastructure', 'normal')).toBe(false)
    expect(isPathAllowedForTier('/platform/notifications', 'normal')).toBe(true)
    expect(isPathAllowedForTier('/platform/policy', 'normal')).toBe(false)
  })

  it('allows zone hub routes on power tier', () => {
    expect(isPathAllowedForTier('/platform/infrastructure', 'power')).toBe(true)
    expect(isPathAllowedForTier('/platform/workloads', 'power')).toBe(true)
    expect(isPathAllowedForTier('/platform/administration', 'power')).toBe(true)
  })
})

describe('minTierForPath', () => {
  it('returns the lowest tier that can reach a path', () => {
    expect(minTierForPath('/platform/vms')).toBe('normal')
    expect(minTierForPath('/platform/infrastructure')).toBe('power')
    expect(minTierForPath('/platform/observability')).toBe('power')
    expect(minTierForPath('/platform/developer')).toBe('advanced')
    expect(minTierForPath('/platform/zeus/security/policies')).toBe('advanced')
  })
})
