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

  test('Shell lens shows guest access and shell access banners', async ({ page }) => {
    await page.goto('/platform/vms/v1/consolehub')
    await page.getByRole('button', { name: 'Shell' }).first().click()
    await expect(page.getByTestId('guest-access-banner')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('shell-access-banner')).toBeVisible()
  })

  test('Serial recovery card switches to shell lens', async ({ page }) => {
    await page.goto('/platform/vms/v1/consolehub')
    await page.getByRole('button', { name: 'Serial' }).first().click()
    await expect(page.getByTestId('console-login-recovery')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Switch to Shell' }).click()
    await expect(page.getByRole('button', { name: 'Shell' })).toHaveClass(/emerald/)
  })

  test('Command Center opens with tabs and compact NAT panel', async ({ page }) => {
    await page.goto('/platform/vms/v1/consolehub')
    await page.getByRole('button', { name: 'Command Center' }).first().click()
    const panel = page.getByTestId('command-center-panel')
    await expect(panel).toBeVisible({ timeout: 15_000 })
    await expect(panel.getByTestId('vm-port-forward-panel')).toBeVisible()
    await expect(panel.getByTestId('consolehub-session-history')).toBeVisible()
    await expect(panel.getByText('Recent sessions')).toBeVisible()
    await expect(panel.getByText('admin').first()).toBeVisible()
    await panel.getByRole('button', { name: 'Health' }).click()
    await expect(panel.getByRole('button', { name: 'Run scan' })).toBeVisible()
    await panel.getByRole('button', { name: 'Events' }).click()
    await panel.getByRole('button', { name: 'AI' }).click()
  })

  test('KubeVirt VM serial lens uses native KubeVirt console', async ({ page }) => {
    await page.goto('/platform/vms/kv1/consolehub')
    await expect(page.getByText('kv-vm-1').first()).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Serial' }).first().click()
    await expect(page.getByTestId('kubevirt-serial-console')).toBeVisible({ timeout: 15_000 })
  })

  test('SPICE VM shows WebRTC performance console tab', async ({ page }) => {
    await page.goto('/platform/vms/sp1/consolehub')
    await expect(page.getByText('spice-vm-1').first()).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'webrtc spice', exact: true }).click()
    await expect(page.getByTestId('webrtc-spice-console')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Performance mode/i)).toBeVisible()
  })
})
