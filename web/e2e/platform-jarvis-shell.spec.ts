// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('Jarvis shell hides sidebar on Normal tier dashboard', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/platform')
  await expect(page.getByTestId('mission-control-briefing')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Migration planner' })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('aside.platform-sidebar')).toHaveCount(0)
})

test('Jarvis intent chip navigates to Maintenance Mission', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/platform')
  await page.getByRole('button', { name: 'Migration planner' }).click()
  await expect(page).toHaveURL(/\/platform\/vms\?lens=migration/, { timeout: 15_000 })
})

test('Jarvis shell visible on power tier dashboard', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform')
  await expect(page.getByTestId('mission-control-briefing')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByPlaceholder(/Ask Zeus or search fleet/i)).toBeVisible()
})

test('normal tier dashboard shows launchpad without fleet insights', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/platform')
  await expect(page.getByTestId('mission-control-launchpad')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('platform-fleet-insights-toggle')).toHaveCount(0)
})
