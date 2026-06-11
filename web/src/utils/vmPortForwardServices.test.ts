// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { describe, expect, it } from 'vitest'
import {
  inferAccessFromPorts,
  ruleMatchesService,
  serviceAccessLabel,
  suggestHostPort,
} from './vmPortForwardServices'

describe('vmPortForwardServices', () => {
  it('suggests host port for well-known guest ports', () => {
    expect(suggestHostPort(22)).toBe(2222)
    expect(suggestHostPort(80)).toBe(9080)
    expect(suggestHostPort(8080)).toBe(18080)
  })

  it('builds service access labels', () => {
    expect(serviceAccessLabel({ access: 'http', hostPort: 9080 }, 'ubuntu', 'lab.test')).toBe(
      'http://lab.test:9080/',
    )
    expect(serviceAccessLabel({ access: 'ssh', hostPort: 2222 }, 'ubuntu', 'lab.test')).toBe(
      'ssh -p 2222 ubuntu@lab.test',
    )
    expect(serviceAccessLabel({ access: 'tcp', hostPort: 13306 }, 'ubuntu', 'lab.test')).toBe(
      'lab.test:13306',
    )
  })

  it('matches rules to services by ports', () => {
    expect(
      ruleMatchesService({ protocol: 'tcp', host_port: 13306, vm_port: 3306 }, {
        hostPort: 13306,
        vmPort: 3306,
      }),
    ).toBe(true)
  })

  it('infers access kind for custom ports', () => {
    expect(inferAccessFromPorts(5432)).toBe('tcp')
    expect(inferAccessFromPorts(8080, true)).toBe('http')
  })
})
