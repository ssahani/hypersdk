// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { describe, expect, it } from 'vitest'
import { hostStateTone, taskStatusTone } from './semanticColors'

describe('semanticColors', () => {
  it('maps task statuses', () => {
    expect(taskStatusTone('completed')).toBe('ok')
    expect(taskStatusTone('failed')).toBe('error')
    expect(taskStatusTone('running')).toBe('info')
  })

  it('maps host states', () => {
    expect(hostStateTone('online')).toBe('ok')
    expect(hostStateTone('offline')).toBe('error')
    expect(hostStateTone('online', false, true)).toBe('warn')
  })
})
