// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('VM Finder inspector shows readable labels and Open VM CTA', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.addInitScript(() => {
    localStorage.setItem('platform-vms-view', 'columns')
  })
  await page.goto('/platform/vms')
  await expect(page.getByRole('heading', { name: 'Virtual Machines', exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('vm-1').first()).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Column view' }).click()
  await page.getByRole('button', { name: 'vm-1' }).click()
  const inspector = page.locator('.platform-finder-inspector').first()
  await expect(inspector).toBeVisible({ timeout: 10_000 })
  await expect(inspector.getByRole('link', { name: 'Open VM' })).toBeVisible()
  await expect(inspector.getByText('Source', { exact: true })).toBeVisible()
  await expect(inspector.getByText('Guest IP', { exact: true })).toBeVisible()

  const labelColor = await page.evaluate(() => {
    const el = document.querySelector('.platform-finder-inspector .platform-finder-inspector-label')
    if (!el) return null
    return getComputedStyle(el).color
  })
  expect(labelColor).toBeTruthy()
  const rgb = labelColor!.match(/\d+/g)?.map(Number) ?? []
  const lum = rgb.length >= 3 ? (rgb[0] + rgb[1] + rgb[2]) / 3 : 0
  expect(lum).toBeGreaterThan(100)
})

test('Machine Finder inspector shows geography labels and Open VM', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/platform/hosts/finder')
  await expect(page.getByRole('heading', { name: /Machine Finder/i })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'host-1' }).click()
  await expect(page.getByRole('link', { name: 'Open host' })).toBeVisible({ timeout: 10_000 })
  const inspector = page.locator('.platform-finder-inspector').first()
  await expect(inspector).toBeVisible()
  await expect(inspector.getByText('Site', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /vm-1 running/ }).click()
  await expect(inspector.getByText('State', { exact: true })).toBeVisible()
  await expect(inspector.getByRole('link', { name: 'Open VM' })).toBeVisible()
})
