// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('Zeus Graph Brain tab loads and path analysis works', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/zeus?tab=brain')
  await expect(page.getByText('Infrastructure Graph Brain')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/nodes · .* edges/)).toBeVisible()
  await page.getByRole('tab', { name: 'Graph Brain' }).click()
  await expect(page.getByText('Connectivity path')).toBeVisible()
})

test('Zeus rightsizing page loads recommendations', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/zeus/rightsizing')
  await expect(page.getByText('VM Rightsizing')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('idle-vm')).toBeVisible()
})

test('Incident commander page loads', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/zeus/incidents')
  await expect(page.getByText('Incident Commander')).toBeVisible({ timeout: 15_000 })
})
