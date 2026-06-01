// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('Reports runbooks tab executes catalog playbook', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/reports?tab=runbooks')
  await expect(page.getByText('Host offline recovery')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Execute' }).click()
  await expect(page.getByText(/Runbook steps recorded|Runbooks/i).first()).toBeVisible({ timeout: 10_000 })
})

test('Reports showback tab shows project rollup', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/reports?tab=showback')
  await expect(page.getByText(/Compliance showback/i)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('default')).toBeVisible()
  await expect(page.getByText(/Fleet compliance grade: B\+/i)).toBeVisible()
})

test('Operations hub links to runbooks', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/operations')
  await page.getByRole('link', { name: /Reports & Runbooks/i }).click()
  await expect(page).toHaveURL(/\/platform\/reports\?tab=runbooks/)
  await expect(page.getByText('Host offline recovery')).toBeVisible({ timeout: 15_000 })
})
