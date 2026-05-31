// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('shell bridge shows on classic import', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/import')
  const bar = page.locator('.shell-bridge-bar')
  await expect(bar).toBeVisible({ timeout: 15_000 })
  await expect(bar.getByRole('link', { name: /Back to Platform/i })).toBeVisible()
  await expect(bar.getByRole('link', { name: /Apps.*Integrations/i })).toBeVisible()
})

test('platform to K8s and back via shell bridge', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/k8s')
  const bar = page.locator('.shell-bridge-bar')
  await expect(bar).toBeVisible({ timeout: 15_000 })
  await bar.getByRole('link', { name: /Back to Platform/i }).click()
  await expect(page).toHaveURL(/\/platform/, { timeout: 15_000 })
})

test('OpenStack subnav links to platform when fleet mode', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/openstack')
  const platformLink = page.getByRole('link', { name: /Platform desktop/i })
  await expect(platformLink).toBeVisible()
  await Promise.all([
    page.waitForURL(/\/platform/),
    platformLink.click(),
  ])
})

test('classic storage shows empty state when no pools', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/storage')
  await expect(page.getByText('No storage pools')).toBeVisible({ timeout: 15_000 })
})
