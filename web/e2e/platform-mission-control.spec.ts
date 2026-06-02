// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test.describe.configure({ mode: 'serial' })

test('platform mission control overlay opens from Jarvis', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/platform')
  await expect(page.getByTestId('platform-jarvis-shell')).toBeVisible({ timeout: 15_000 })
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('machina-open-mission-control')))
  await expect(page.getByRole('dialog', { name: 'Mission Control' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Mission Control', level: 1 })).toBeVisible()
  expect(errors).toEqual([])
})

test('platform jarvis briefing strip', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/platform')
  await expect(page.getByTestId('platform-jarvis-shell')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByPlaceholder(/Ask Zeus or search fleet/i)).toBeVisible()
  await expect(page.getByText('Good morning').or(page.getByText('Good afternoon')).or(page.getByText('Good evening'))).toBeVisible()
})
