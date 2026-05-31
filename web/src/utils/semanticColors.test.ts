// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { describe, expect, it } from 'vitest'
import { hostStateTone, httpStatusTone, k8sPhaseTone, migrationReadinessTone, openstackStatusTone, sessionBadgeClasses, taskStatusTone, vmStateTone } from './semanticColors'

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

  it('maps http status and migration readiness', () => {
    expect(httpStatusTone(200)).toBe('ok')
    expect(httpStatusTone(404)).toBe('warn')
    expect(httpStatusTone(500)).toBe('error')
    expect(migrationReadinessTone('ready')).toBe('ok')
    expect(migrationReadinessTone('failed')).toBe('error')
  })
})
