// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'
import { waitForPlatformSession } from './helpers'

test('shell bridge shows on classic import', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/import')
  await waitForPlatformSession(page)
  const bar = page.locator('.shell-bridge-bar')
  await expect(bar).toBeVisible({ timeout: 20_000 })
  await expect(bar.getByRole('link', { name: /Back to Platform/i })).toBeVisible()
  await expect(bar.getByRole('link', { name: /Apps.*Integrations/i })).toBeVisible()
})

test('platform to K8s and back via shell bridge', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/k8s')
  await waitForPlatformSession(page)
  const bar = page.locator('.shell-bridge-bar')
  await expect(bar).toBeVisible({ timeout: 20_000 })
  const backLink = bar.getByRole('link', { name: /Back to Platform/i })
  await Promise.all([
    page.waitForURL(/\/platform/),
    backLink.click(),
  ])
})

test('OpenStack subnav links to platform when fleet mode', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/openstack')
  await waitForPlatformSession(page)
  const platformLink = page.getByRole('link', { name: /Platform desktop/i })
  await expect(platformLink).toBeVisible({ timeout: 20_000 })
  await Promise.all([
    page.waitForURL(/\/platform/),
    platformLink.click(),
  ])
})

test('classic storage shows empty state when no pools', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal', emptyStorage: true })
  await page.goto('/storage')
  await expect(page.getByText('No storage pools')).toBeVisible({ timeout: 15_000 })
})
