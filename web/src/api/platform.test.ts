// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  PLATFORM_CONTROLLER_PROXY,
  resolvePlatformApiUrl,
  usesCoLocatedControllerProxy,
  defaultControllerProxyUrl,
  getControllerBase,
} from './platform'

const LS_CONTROLLER = 'machina_platform_controller'

const PROXY_BASE = `http://localhost:3000${PLATFORM_CONTROLLER_PROXY}`

const windowStub = {
  location: { origin: 'http://localhost:3000', protocol: 'http:', hostname: 'localhost', port: '3000', host: 'localhost:3000' },
}

const makeLocalStorageMock = () => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  }
}

beforeEach(() => {
  vi.stubGlobal('window', windowStub)
  vi.stubGlobal('localStorage', makeLocalStorageMock())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('PLATFORM_CONTROLLER_PROXY', () => {
  it('has the expected value', () => {
    expect(PLATFORM_CONTROLLER_PROXY).toBe('/api/v1/platform/controller')
  })
})

describe('usesCoLocatedControllerProxy', () => {
  it('returns true when base includes the proxy path', () => {
    expect(usesCoLocatedControllerProxy(PROXY_BASE)).toBe(true)
  })

  it('returns false for a direct controller URL', () => {
    expect(usesCoLocatedControllerProxy('http://localhost:5093')).toBe(false)
  })
})

describe('resolvePlatformApiUrl', () => {
  it('returns proxy-based URL when base is co-located', () => {
    const url = resolvePlatformApiUrl('/api/v1/vms', PROXY_BASE)
    expect(url).toBe(`${PLATFORM_CONTROLLER_PROXY}/api/v1/vms`)
  })

  it('returns direct URL when base is not the proxy', () => {
    const url = resolvePlatformApiUrl('/api/v1/vms', 'http://localhost:5093')
    expect(url).toBe('http://localhost:5093/api/v1/vms')
  })

  it('handles paths without leading slash', () => {
    const url = resolvePlatformApiUrl('api/v1/hosts', PROXY_BASE)
    expect(url).toBe(`${PLATFORM_CONTROLLER_PROXY}/api/v1/hosts`)
  })
})

describe('defaultControllerProxyUrl', () => {
  it('returns a string containing the proxy path', () => {
    const url = defaultControllerProxyUrl()
    expect(url).toContain(PLATFORM_CONTROLLER_PROXY)
  })
})

describe('getControllerBase precedence', () => {
  it('falls back to the same-origin daemon proxy when nothing is saved and no env var is set', () => {
    expect(getControllerBase()).toBe(PROXY_BASE)
  })

  it('uses VITE_MACHINA_CONTROLLER_URL when no localStorage override is saved', () => {
    vi.stubEnv('VITE_MACHINA_CONTROLLER_URL', 'http://dev-controller.example:5093')
    expect(getControllerBase()).toBe('http://dev-controller.example:5093')
  })

  it('prefers a saved localStorage override over VITE_MACHINA_CONTROLLER_URL', () => {
    vi.stubEnv('VITE_MACHINA_CONTROLLER_URL', 'http://dev-controller.example:5093')
    localStorage.setItem(LS_CONTROLLER, PROXY_BASE)
    expect(getControllerBase()).toBe(PROXY_BASE)
  })
})
