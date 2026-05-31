// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('Security Center loads with threat score', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/zeus/security')
  await expect(page.getByRole('heading', { name: 'Security Center' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Fleet threat score')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/4 nodes/)).toBeVisible({ timeout: 15_000 })
})

test('Machine Security view shows process tabs', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/zeus/machines/h1')
  await expect(page.getByText('Machine · h1')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Processes')).toBeVisible()
})
