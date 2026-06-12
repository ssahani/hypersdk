// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { describe, expect, it } from 'vitest'
import { aggregateAccessNoteLabels, consoleAccessHints } from './guestAccessHints'

describe('consoleAccessHints', () => {
  it('warns serial is ssh-key only', () => {
    const hints = consoleAccessHints(
      { auth_mode: 'ssh_key', serial_password_login: false, guest_ip_private: true },
      'serial',
      { guestIp: '192.168.122.199', sshUser: 'ubuntu' },
    )
    expect(hints.some((h) => h.includes('SSH-key only'))).toBe(true)
  })

  it('suggests port-forward ssh command when nat is exposed', () => {
    const hints = consoleAccessHints(
      { auth_mode: 'ssh_key', serial_password_login: false, guest_ip_private: true, ssh_nat_host_port: 2222 },
      'shell',
      { guestIp: '192.168.122.199', sshUser: 'ubuntu', hypervisorHost: 'lab.test' },
    )
    expect(hints.join(' ')).toContain('ssh -p 2222 ubuntu@lab.test')
  })

  it('aggregates access note labels for Cinema pill', () => {
    const labels = aggregateAccessNoteLabels(
      { auth_mode: 'ssh_key', serial_password_login: false, guest_ip_private: true },
      { guestIp: '192.168.122.199' },
    )
    expect(labels).toContain('SSH key-only')
    expect(labels).toContain('NAT guest IP')
    expect(labels).toContain('SSH not exposed')
  })
})
