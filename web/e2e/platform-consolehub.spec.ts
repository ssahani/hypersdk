// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test.describe('Platform ConsoleHub', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlatformApi(page, { tier: 'power' })
  })

  test('opens ConsoleHub from VM detail and shows protocol picker', async ({ page }) => {
    await page.goto('/platform/vms/v1')
    await expect(page.getByRole('heading', { name: 'vm-1' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('link', { name: /console/i }).first().click()
    await expect(page).toHaveURL(/\/platform\/vms\/v1\/consolehub/)
    await expect(page.getByRole('heading', { name: 'vm-1' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /VNC \(native\)/i })).toBeVisible()
  })

  test('legacy /console redirects to consolehub', async ({ page }) => {
    await page.goto('/platform/vms/v1/console')
    await expect(page).toHaveURL(/\/platform\/vms\/v1\/consolehub/)
  })
})
