// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { describe, expect, it } from 'vitest'
import { isPathAllowedForTier } from './platformDesktopTier'

describe('isPathAllowedForTier', () => {
  it('allows observability and placement on power tier', () => {
    expect(isPathAllowedForTier('/platform/observability', 'power')).toBe(true)
    expect(isPathAllowedForTier('/platform/placement', 'power')).toBe(true)
  })

  it('blocks observability and operations hub on normal tier', () => {
    expect(isPathAllowedForTier('/platform/observability', 'normal')).toBe(false)
    expect(isPathAllowedForTier('/platform/operations', 'normal')).toBe(false)
    expect(isPathAllowedForTier('/platform/notifications', 'normal')).toBe(true)
  })
})
