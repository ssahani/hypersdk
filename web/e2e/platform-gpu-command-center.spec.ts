// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('GPU Command Center shows host inventory and placement advisor', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/gpu')
  await expect(page.getByRole('heading', { name: /GPU Command Center/i })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('link', { name: 'host-1' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/CUDA placement advisor/i)).toBeVisible()
  await expect(page.getByText(/CUDA-ready/i)).toBeVisible()
})

test('Resources hub links to GPU Command Center', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/resources')
  await page.locator('.tahoe-content').getByRole('link', { name: 'GPU Command Center' }).click()
  await expect(page).toHaveURL(/\/platform\/gpu/)
  await expect(page.getByRole('heading', { name: /GPU Command Center/i })).toBeVisible({ timeout: 15_000 })
})
