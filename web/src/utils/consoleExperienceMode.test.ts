// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  cinemaHubPath,
  cinemaPopoutPath,
  loadConsoleModePreference,
  parseConsoleMode,
  resolveConsoleMode,
  saveConsoleModePreference,
  spectatorCinemaPath,
  studioHubPath,
} from './consoleExperienceMode'

function mockStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
    clear: () => store.clear(),
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: mockStorage(),
  })
})

afterEach(() => {
  localStorage.clear()
})

describe('consoleExperienceMode', () => {
  it('parseConsoleMode defaults to cinema', () => {
    expect(parseConsoleMode('')).toBe('cinema')
    expect(parseConsoleMode('?mode=cinema')).toBe('cinema')
    expect(parseConsoleMode('?mode=studio')).toBe('studio')
  })

  it('resolveConsoleMode restores saved preference when URL has no mode', () => {
    saveConsoleModePreference('v1', 'studio')
    expect(resolveConsoleMode('', 'v1')).toBe('studio')
    expect(resolveConsoleMode('?mode=cinema', 'v1')).toBe('cinema')
  })

  it('load and save console mode preference per VM', () => {
    saveConsoleModePreference('a', 'studio')
    saveConsoleModePreference('b', 'mission')
    expect(loadConsoleModePreference('a')).toBe('studio')
    expect(loadConsoleModePreference('b')).toBe('mission')
    expect(loadConsoleModePreference('missing')).toBeNull()
  })

  it('builds spectator cinema paths', () => {
    expect(spectatorCinemaPath('v1', 'sess-1', 'tok')).toBe('/platform/vms/v1/consolehub?mode=cinema&session=sess-1&spectator=tok')
  })

  it('builds cinema and studio hub paths', () => {
    expect(cinemaHubPath('v1')).toBe('/platform/vms/v1/consolehub?mode=cinema')
    expect(studioHubPath('v1')).toBe('/platform/vms/v1/consolehub?mode=studio')
    const popout = new URL(cinemaPopoutPath('v1'), 'http://localhost')
    expect(popout.pathname).toBe('/platform/vms/v1/consolehub')
    expect(popout.searchParams.get('mode')).toBe('cinema')
    expect(popout.searchParams.get('popout')).toBe('1')
  })
})
