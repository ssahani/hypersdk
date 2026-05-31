// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { Page } from '@playwright/test'

export type DesktopTier = 'normal' | 'power' | 'advanced'

const TIER_KEY = 'machina-platform-desktop-tier'
const WELCOME_KEY = 'zyvor-platform-welcome-done'

export async function ensureLoggedIn(page: Page, baseUrl: string) {
  const user = process.env.PLAYWRIGHT_LIVE_USER
  const pass = process.env.PLAYWRIGHT_LIVE_PASS
  await page.goto(`${baseUrl}/platform`)
  if (!user || !pass) return
  if (!page.url().includes('/login')) return
  await page.getByLabel('Username').fill(user)
  await page.getByLabel('Password').fill(pass)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await page.waitForURL(/\/platform/, { timeout: 30_000 })
}

export async function setDesktopTier(page: Page, tier: DesktopTier) {
  await page.addInitScript(
    ([t, welcomeKey, tierKey]) => {
      localStorage.setItem(welcomeKey, '1')
      localStorage.setItem(tierKey, t)
    },
    [tier, WELCOME_KEY, TIER_KEY] as const,
  )
}

export interface PlatformInfoFlags {
  openstackEnabled: boolean
  k8sEnabled: boolean
}

export async function fetchPlatformFlags(page: Page, baseUrl: string): Promise<PlatformInfoFlags> {
  try {
    const res = await page.request.get(`${baseUrl}/api/v1/system/platform-info`, {
      ignoreHTTPSErrors: true,
    })
    if (!res.ok()) return { openstackEnabled: false, k8sEnabled: false }
    const body = (await res.json()) as {
      openstack?: { enabled?: boolean }
      kubevirt?: { exec_enabled?: boolean }
    }
    return {
      openstackEnabled: Boolean(body.openstack?.enabled),
      k8sEnabled: Boolean(body.kubevirt?.exec_enabled),
    }
  } catch {
    return { openstackEnabled: false, k8sEnabled: false }
  }
}
