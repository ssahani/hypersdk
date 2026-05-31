// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { describe, expect, it } from 'vitest'
import { checkStatusTone, hostStateTone, httpStatusTone, k8sPhaseTone, migrationReadinessTone, openstackStatusTone, poolStateBadgeClasses, prereqTone, sessionBadgeClasses, serviceStateTone, statusChipClasses, statusSurfaceClasses, taskStatusTone, utilizationTone, userRoleTone, vmStateTone } from './semanticColors'

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

  it('maps user roles and status surfaces', () => {
    expect(userRoleTone('admin')).toBe('error')
    expect(userRoleTone('operator')).toBe('info')
    expect(statusChipClasses('warn')).toContain('--machina-status-warn')
    expect(statusSurfaceClasses('ok')).toContain('--machina-status-ok')
  })

  it('maps check and service states', () => {
    expect(checkStatusTone('pass')).toBe('ok')
    expect(checkStatusTone('fail')).toBe('error')
    expect(serviceStateTone('active')).toBe('ok')
    expect(serviceStateTone('failed')).toBe('error')
    expect(prereqTone(true)).toBe('ok')
    expect(prereqTone(false)).toBe('warn')
    expect(prereqTone(false, 'error')).toBe('error')
  })
})
