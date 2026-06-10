// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('platform unknown route shows recovery page', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/platform/does-not-exist-route')
  await expect(page.getByTestId('platform-not-found')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('platform-not-found').getByRole('link', { name: 'Mission Control' })).toBeVisible()
})
