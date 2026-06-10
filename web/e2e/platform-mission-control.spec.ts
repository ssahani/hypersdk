// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('mission control landing shows hero and launchpad', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/platform')
  await expect(page.getByTestId('mission-control-page')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('mission-control-hero')).toBeVisible()
  await expect(page.getByTestId('mission-control-launchpad')).toBeVisible()
  await expect(page.getByRole('heading', { name: /e2e-cluster|host-1|Mission Control|Machina fleet/i }).first()).toBeVisible()
})

test('mission control card opens command center', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/platform')
  await page.getByText('vm-1').first().click({ timeout: 15_000 })
  await expect(page.getByTestId('fleet-command-center')).toBeVisible()
})

test('F3 expands fleet geography on mission control', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/platform')
  await page.keyboard.press('F3')
  await expect(page.getByTestId('mission-control-geography')).toBeVisible({ timeout: 10_000 })
})
