// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('Enterprise security strip on advanced dashboard', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'advanced' })
  await page.goto('/platform')
  const strip = page.getByTestId('enterprise-security-strip')
  await expect(strip).toBeVisible({ timeout: 15_000 })
  await expect(strip.getByText('Enterprise security', { exact: true })).toBeVisible()
  await expect(strip.getByRole('link', { name: 'Open Keychain →' })).toBeVisible()
})
