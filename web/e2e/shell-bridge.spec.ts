// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('shell bridge shows on classic import', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/import')
  await expect(page.locator('.shell-bridge-bar')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.shell-bridge-bar a[href="/platform"]')).toContainText('Back to Platform')
  await expect(page.locator('.shell-bridge-bar a[href="/platform/integrations"]')).toBeVisible()
})

test('OpenStack subnav links to platform when fleet mode', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/openstack')
  await expect(page.getByRole('link', { name: /Platform desktop/i })).toBeVisible()
  await page.getByRole('link', { name: /Platform desktop/i }).click()
  await expect(page).toHaveURL(/\/platform/)
})
