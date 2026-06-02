// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('Jarvis shell hides sidebar on Normal tier dashboard', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/platform')
  await expect(page.getByTestId('platform-jarvis-shell')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Maintenance Mission' })).toBeVisible()
  await expect(page.locator('aside.platform-sidebar')).toHaveCount(0)
})

test('Jarvis intent chip navigates to Maintenance Mission', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/platform')
  await expect(page.getByRole('button', { name: 'Maintenance Mission' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Maintenance Mission' }).click()
  await expect(page).toHaveURL(/\/platform\/maintenance\?tab=mission/, { timeout: 15_000 })
})

test('Jarvis shell visible on power tier dashboard', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform')
  await expect(page.getByTestId('platform-jarvis-shell')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByPlaceholder(/Ask Machina or search fleet/i)).toBeVisible()
})

test('normal tier dashboard shows launchpad without fleet insights', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/platform')
  await expect(page.getByRole('heading', { name: 'Launchpad' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('platform-fleet-insights-toggle')).toHaveCount(0)
})
