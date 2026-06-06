// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('Migration radar ESXi source triggers HyperSDK scan', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/migration')
  const scanReq = page.waitForResponse(
    (r) => r.url().includes('/hypersdk/providers/vms') && r.request().method() === 'GET',
  )
  await page.getByTestId('migration-source-esxi').click()
  await scanReq
  await expect(page.getByText('vcenter-vm-1')).toBeVisible({ timeout: 15_000 })
})
