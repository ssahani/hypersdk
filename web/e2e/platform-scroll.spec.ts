// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'
import { mockAuthenticatedApi } from './helpers/authMock'
import { expectPageScrolls } from './helpers/platformTestHelpers'

const SHORT_VIEWPORT = 400

test.describe('platform pages document scroll', () => {
  for (const [path, heading] of [
    ['/platform/vms', /virtual machines/i],
    ['/platform/hosts', /hosts/i],
    ['/platform/settings', /settings/i],
    ['/platform/network-canvas', /network canvas/i],
    ['/platform/templates', /fleet template catalog/i],
    ['/platform/networks', /networks/i],
    ['/platform/zeus/security', /security center/i],
    ['/platform/hosts/finder', /machine finder/i],
  ] as const) {
    test(`${path} scrolls with short viewport`, async ({ page }) => {
      await mockPlatformApi(page, { tier: 'power' })
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({ timeout: 20_000 })
      await expectPageScrolls(page, { viewportHeight: SHORT_VIEWPORT })
    })
  }

  test('/platform/vms/:id scrolls on VM detail', async ({ page }) => {
    await mockPlatformApi(page, { tier: 'power' })
    await page.goto('/platform/vms/v1')
    await expect(page.getByRole('heading', { name: /vm-1/i }).first()).toBeVisible({ timeout: 20_000 })
    await expectPageScrolls(page, { viewportHeight: SHORT_VIEWPORT })
  })

  test('/platform/vms/:id keeps detail tabs sticky while scrolling', async ({ page }) => {
    await mockPlatformApi(page, { tier: 'power' })
    await page.goto('/platform/vms/v1')
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible({ timeout: 20_000 })
    await page.setViewportSize({ width: 1280, height: 400 })
    const before = await page.getByRole('tab', { name: 'Overview' }).boundingBox()
    await page.evaluate(() => window.scrollTo(0, 1200))
    const after = await page.getByRole('tab', { name: 'Overview' }).boundingBox()
    expect(before).not.toBeNull()
    expect(after).not.toBeNull()
    expect(after!.y).toBeLessThan(before!.y + 80)
    expect(after!.y).toBeLessThan(320)
  })

  test('/platform/hosts/:id scrolls on host detail', async ({ page }) => {
    await mockPlatformApi(page, { tier: 'power' })
    await page.goto('/platform/hosts/h1')
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 20_000 })
    await expectPageScrolls(page, { viewportHeight: SHORT_VIEWPORT })
  })
})

test.describe('classic pages document scroll', () => {
  test('/vms scrolls with short viewport', async ({ page }) => {
    await mockAuthenticatedApi(page)
    await page.goto('/vms')
    await expect(page.getByRole('heading', { name: /virtual machines/i })).toBeVisible({ timeout: 15_000 })
    await expectPageScrolls(page, { viewportHeight: SHORT_VIEWPORT })
  })

  test('dashboard scrolls with short viewport', async ({ page }) => {
    await mockAuthenticatedApi(page)
    await page.goto('/')
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 })
    await expectPageScrolls(page, { viewportHeight: SHORT_VIEWPORT })
  })
})
