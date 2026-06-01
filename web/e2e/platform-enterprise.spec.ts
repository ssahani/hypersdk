// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('Enterprise Keychain tab shows secrets inventory', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'advanced' })
  await page.goto('/platform/enterprise?tab=keychain')
  await expect(page.getByRole('heading', { name: 'Enterprise Security' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('corp-vault')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Secrets inventory' })).toBeVisible()
})

test('Vault sync failure shows ErrorBanner', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'advanced' })
  await page.goto('/platform/enterprise?tab=vault')
  await page.getByRole('button', { name: 'Sync all' }).click()
  await expect(page.getByRole('alert')).toContainText(/vault sync failed|failed/i, { timeout: 10_000 })
})
