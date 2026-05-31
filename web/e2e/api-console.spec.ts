// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test.beforeEach(async ({ page }) => {
  await mockPlatformApi(page)
})

test('developer API console tab loads', async ({ page }) => {
  await page.goto('/platform/developer')
  await expect(page.getByRole('button', { name: /API Console/i })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /API Console/i }).click()
  await expect(page.getByPlaceholder('Filter operations…')).toBeVisible()
})

test('backups destinations tab loads', async ({ page }) => {
  await page.goto('/platform/backups?tab=destinations')
  await expect(page.getByRole('heading', { name: 'Backup destinations' })).toBeVisible({ timeout: 15_000 })
})
