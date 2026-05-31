// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { describe, expect, it } from 'vitest'
import { hostStateTone, httpStatusTone, k8sPhaseTone, migrationReadinessTone, openstackStatusTone, poolStateBadgeClasses, sessionBadgeClasses, taskStatusTone, utilizationTone, vmStateTone } from './semanticColors'

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

  it('maps vm and openstack statuses', () => {
    expect(vmStateTone('running')).toBe('ok')
    expect(openstackStatusTone('ACTIVE')).toBe('ok')
    expect(k8sPhaseTone('Failed')).toBe('error')
  })

  it('builds session badge classes', () => {
    expect(sessionBadgeClasses()).toContain('--machina-status-warn')
  })

  it('maps utilization percent to tone', () => {
    expect(utilizationTone(50)).toBe('ok')
    expect(utilizationTone(70)).toBe('ok')
    expect(utilizationTone(71)).toBe('warn')
    expect(utilizationTone(95)).toBe('error')
  })

  it('builds pool state badge classes', () => {
    expect(poolStateBadgeClasses('running')).toContain('--machina-status-ok')
    expect(poolStateBadgeClasses('inactive')).toContain('--machina-status-neutral')
  })
})
