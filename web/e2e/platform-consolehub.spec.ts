// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test.describe('Platform ConsoleHub', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlatformApi(page, { tier: 'power' })
  })

  test('opens ConsoleHub from VM detail and shows lens bar', async ({ page }) => {
    await page.goto('/platform/vms/v1')
    await expect(page.getByRole('heading', { name: 'vm-1' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('link', { name: /console/i }).first().click()
    await expect(page).toHaveURL(/\/platform\/vms\/v1\/consolehub/)
    await expect(page.getByRole('heading', { name: 'vm-1' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Display' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'novnc', exact: true })).toBeVisible()
  })

  test('legacy /console redirects to consolehub', async ({ page }) => {
    await page.goto('/platform/vms/v1/console')
    await expect(page).toHaveURL(/\/platform\/vms\/v1\/consolehub/)
  })

  test('ConsoleHub shows laptop checklist and expose SSH on serial lens', async ({ page }) => {
    await page.goto('/platform/vms/v1/consolehub')
    await expect(page.getByTestId('vm-laptop-access-checklist')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Serial' }).first().click()
    await expect(page.getByTestId('console-login-recovery')).toBeVisible()
    const createReq = page.waitForRequest(
      (req) => req.url().includes('/port-forwards') && req.method() === 'POST',
    )
    await page.getByTestId('console-login-recovery').getByRole('button', { name: 'Expose SSH' }).click()
    const req = await createReq
    expect(req.postDataJSON()).toMatchObject({ host_port: 2222, vm_port: 22 })
  })

  test('CommandDock SSH switches to shell lens', async ({ page }) => {
    await page.goto('/platform/vms/v1/consolehub')
    await expect(page.getByRole('button', { name: 'SSH' }).last()).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'SSH' }).last().click()
    await expect(page.getByRole('button', { name: 'Shell' })).toHaveClass(/emerald/)
  })
})
