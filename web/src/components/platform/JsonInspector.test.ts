// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { describe, expect, it } from 'vitest'
import { summarizeJsonValue } from './JsonInspector'

describe('summarizeJsonValue', () => {
  it('keeps nested firewall payloads compact', () => {
    expect(summarizeJsonValue([{ chain: 'INPUT' }, { chain: 'FORWARD' }])).toBe('2 items')
    expect(summarizeJsonValue({ rules: [], policy: 'accept' })).toBe('2 fields')
  })

  it('renders primitive values directly', () => {
    expect(summarizeJsonValue(false)).toBe('false')
    expect(summarizeJsonValue('nftables')).toBe('nftables')
  })
})
