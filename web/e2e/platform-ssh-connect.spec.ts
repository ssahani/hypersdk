// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test.describe('Platform SSH connect dialog', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlatformApi(page, { tier: 'power' })
  })

  test('VM detail SSH shows NAT banner and expose action', async ({ page }) => {
    await page.goto('/platform/vms/v1')
    await expect(page.getByTestId('vm-daily-access')).toBeVisible({ timeout: 15_000 })
    await page.locator('button.btn-secondary.text-sm').filter({ hasText: 'SSH' }).click()
    await expect(page.getByTestId('vm-ssh-connect-dialog')).toBeVisible()
    await expect(page.getByTestId('vm-ssh-nat-banner')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Expose SSH & copy command' })).toBeVisible()
    const createReq = page.waitForRequest(
      (req) => req.url().includes('/port-forwards') && req.method() === 'POST',
    )
    await page.getByRole('button', { name: 'Expose SSH & copy command' }).click()
    const req = await createReq
    expect(req.postDataJSON()).toMatchObject({ host_port: 2222, vm_port: 22 })
  })

  test('Machine Finder SSH opens NAT-aware dialog', async ({ page }) => {
    await page.goto('/platform/vms?lens=table')
    await expect(page.getByRole('heading', { name: /Machine Finder/i })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'SSH' }).first().click()
    await expect(page.getByTestId('vm-ssh-connect-dialog')).toBeVisible()
    await expect(page.getByTestId('vm-ssh-nat-banner')).toBeVisible()
  })

  test('Mission Control SSH opens NAT-aware dialog', async ({ page }) => {
    await page.goto('/platform')
    await page.getByText('vm-1').first().click({ timeout: 15_000 })
    await expect(page.getByTestId('fleet-command-center')).toBeVisible()
    await page.getByTestId('fleet-command-center').getByRole('button', { name: 'SSH' }).click()
    await expect(page.getByTestId('vm-ssh-connect-dialog')).toBeVisible()
    await expect(page.getByTestId('vm-ssh-nat-banner')).toBeVisible()
  })
})
