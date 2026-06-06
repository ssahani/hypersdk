// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test.describe('Platform guest UX', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlatformApi(page, { tier: 'power' })
  })

  test('guest health tab shows error banner on API failure', async ({ page }) => {
    await page.goto('/platform/vms/guest-health-fail?tab=guestHealth')
    await expect(page.getByText('Could not load guest health')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  })

  test('fleet analyze guests card is dismissible and supports empty matches', async ({ page }) => {
    await page.route('**/*fleet/guest-query*', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          query: 'empty-test',
          summary: 'No VMs matched for empty-test query.',
          matched_count: 0,
          scanned_count: 3,
          llm_powered: false,
          vms: [],
        }),
      })
    })
    await page.goto('/platform/vms')
    await page.getByPlaceholder('Search VMs…').fill('empty-test')
    await page.getByRole('button', { name: 'Analyze guests' }).click()
    const reportCard = page.locator('div.rounded-xl').filter({
      has: page.getByLabel('Dismiss fleet guest report'),
    })
    await expect(reportCard.getByText('No VMs matched for empty-test query.')).toBeVisible({ timeout: 15_000 })
    await page.locator('aside.fixed.right-0 header button').click()
    await page.getByLabel('Dismiss fleet guest report').click()
    await expect(reportCard).not.toBeVisible()
  })

  test('fleet guest query VM rows deep-link to guest health tab', async ({ page }) => {
    await page.route('**/*fleet/guest-query*', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          query: 'guest agent',
          summary: '1 VM matched.',
          matched_count: 1,
          scanned_count: 1,
          llm_powered: false,
          vms: [{ vm_id: 'v1', vm_name: 'vm-1', os_pretty_name: 'Ubuntu', guest_ip: '10.0.0.5', install_state: 'running', user_count: 1, flags: [] }],
        }),
      })
    })
    await page.goto('/platform/vms')
    await page.getByRole('button', { name: 'Analyze guests' }).click()
    await page.locator('a[href="/platform/vms/v1?tab=guestHealth"]').click()
    await expect(page).toHaveURL(/\/platform\/vms\/v1\?tab=guestHealth/)
  })
})
