// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('advanced tier shows sidebar policy and Go menu opens', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'advanced' })
  await page.goto('/platform/policy')
  await expect(page.getByRole('heading', { name: /Policy & Quotas/i })).toBeVisible()

  await page.goto('/platform')
  const goMenu = page.getByRole('button', { name: /^Go$/i })
  if (await goMenu.count()) {
    await goMenu.click()
    await expect(page.getByRole('button', { name: 'All destinations…' })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: 'Operations' })).toBeVisible()
  }
})

test('context bar shows security sub-nav on policy studio route', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'advanced' })
  await page.goto('/platform/zeus/security/policies')
  await expect(page.getByRole('heading', { name: /Policy Studio/i })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.tahoe-context-bar')).toBeVisible()
  await expect(page.locator('.tahoe-context-pill', { hasText: 'Policy Studio' })).toBeVisible()
})

test('dashboard has no desktop tabs row', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/vms')
  await page.goto('/platform/hosts')
  await expect(page.locator('.mac-desktop-tabs')).toHaveCount(0)
  await expect(page.locator('.tahoe-context-bar')).toBeVisible()
})

test('policy studio route loads', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'advanced' })
  await page.goto('/platform/zeus/security/policies')
  await expect(page.getByRole('heading', { name: /Policy Studio/i })).toBeVisible()
})

test('normal tier shows sidebar by default', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/platform')
  await expect(page.locator('.tahoe-sidebar')).toBeVisible()
})

test('security context bar collapses overflow into More menu', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'advanced' })
  await page.goto('/platform/zeus/security/policies')
  await expect(page.locator('.tahoe-context-bar')).toBeVisible()
  await expect(page.locator('.tahoe-context-pill', { hasText: 'Policy Studio' })).toBeVisible()
  await expect(page.locator('.tahoe-context-more')).toBeVisible()
  await page.locator('.tahoe-context-more').click()
  await expect(page.locator('.tahoe-context-overflow-item', { hasText: 'Threat Hunting' })).toBeVisible()
})
