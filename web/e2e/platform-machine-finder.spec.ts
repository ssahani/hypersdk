// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('Machine Finder shows site → rack → host → VM columns', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/platform/hosts/finder')
  await expect(page.getByRole('heading', { name: /Machine Finder/i })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'DC-1' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Rack A' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'host-1' })).toBeVisible()
  await page.getByRole('button', { name: 'host-1' }).click()
  await expect(page.getByRole('button', { name: 'vm-1' })).toBeVisible()
  await page.getByRole('button', { name: 'vm-1' }).click()
  await expect(page.getByRole('link', { name: 'Open VM' })).toBeVisible()
})

test('Hosts context includes Infrastructure Finder route', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/hosts/finder')
  await expect(page.getByRole('heading', { name: /Machine Finder/i })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('link', { name: 'Mission Control' })).toBeVisible()
})
