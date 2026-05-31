// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test.beforeEach(async ({ page }) => {
  await mockPlatformApi(page, { tier: 'advanced' })
})

test('developer API console tab loads controller operations', async ({ page }) => {
  await page.goto('/platform/developer')
  await page.getByRole('button', { name: /API Console/i }).click()
  await expect(page.getByPlaceholder('Filter operations…')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: /Controller \(fleet\)/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /hosts/i })).toBeVisible()
  await page.getByPlaceholder('Filter operations…').fill('/api/v1/hosts')
  await expect(page.getByText('/api/v1/hosts').first()).toBeVisible()
})

test('developer API console host tab loads daemon operations', async ({ page }) => {
  await page.goto('/platform/developer')
  await page.getByRole('button', { name: /API Console/i }).click()
  await page.getByRole('button', { name: /Host \(daemon\)/i }).click()
  await expect(page.getByText('/api/v1/vms').first()).toBeVisible({ timeout: 15_000 })
  await page.getByText('/api/v1/vms').first().click()
  await page.getByRole('button', { name: 'Execute' }).click()
  await expect(page.locator('body')).not.toContainText('Application error')
})

test('backups destinations tab loads', async ({ page }) => {
  await page.goto('/platform/backups?tab=destinations')
  await expect(page.getByRole('heading', { name: 'Backup destinations' })).toBeVisible({ timeout: 15_000 })
})
