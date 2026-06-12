// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test.describe('Platform Launchpad', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlatformApi(page, { tier: 'power' })
  })

  test('navigates to Launchpad and shows Grafana tile', async ({ page }) => {
    await page.goto('/platform/launchpad')
    await expect(page.getByTestId('platform-launchpad-page')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Launchpad' })).toBeVisible()
    await expect(page.getByTestId('launchpad-tile-grafana')).toBeVisible()
    await expect(page.getByTestId('launchpad-hero-search')).toBeVisible()
  })

  test('Spotlight finds Grafana and offers open action', async ({ page }) => {
    await page.goto('/platform')
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Space' : 'Control+Space')
    await expect(page.getByPlaceholder(/search/i)).toBeVisible({ timeout: 10_000 })
    await page.getByPlaceholder(/search/i).fill('grafana')
    await expect(page.getByText('Grafana')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Open app/i)).toBeVisible()
  })
})
