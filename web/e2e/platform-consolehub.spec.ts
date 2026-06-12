// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test.describe('Platform ConsoleHub', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlatformApi(page, { tier: 'power' })
  })

  test('opens Cinema mode by default from VM detail', async ({ page }) => {
    await page.goto('/platform/vms/v1')
    await expect(page.getByRole('heading', { name: 'vm-1' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('link', { name: /Open Cinema/i }).first().click()
    await expect(page).toHaveURL(/\/platform\/vms\/v1\/consolehub/)
    await expect(page.getByTestId('cinema-shell')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Machina Cinema')).toBeVisible()
  })

  test('legacy /console redirects to consolehub', async ({ page }) => {
    await page.goto('/platform/vms/v1/console')
    await expect(page).toHaveURL(/\/platform\/vms\/v1\/consolehub/)
  })

  test('Cinema shows access note pill instead of checklist', async ({ page }) => {
    await page.goto('/platform/vms/v1/consolehub')
    await expect(page.getByTestId('cinema-shell')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('access-note-pill')).toBeVisible()
    await expect(page.getByTestId('vm-laptop-access-checklist')).toHaveCount(0)
  })

  test('Cinema control strip and Ops Shelf handle', async ({ page }) => {
    await page.goto('/platform/vms/v1/consolehub')
    await expect(page.getByTestId('cinema-control-strip')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('ops-shelf-handle')).toBeVisible()
  })

  test('Studio mode shows lens bar and serial recovery', async ({ page }) => {
    await page.goto('/platform/vms/v1/consolehub?mode=studio')
    await expect(page.getByTestId('studio-layout')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Serial' }).first().click()
    await expect(page.getByTestId('console-login-recovery')).toBeVisible()
    const createReq = page.waitForRequest(
      (req) => req.url().includes('/port-forwards') && req.method() === 'POST',
    )
    await page.getByTestId('console-login-recovery').getByRole('button', { name: 'Expose SSH' }).click()
    const req = await createReq
    expect(req.postDataJSON()).toMatchObject({ host_port: 2222, vm_port: 22 })
  })

  test('Studio shell lens shows guest access banners', async ({ page }) => {
    await page.goto('/platform/vms/v1/consolehub?mode=studio')
    await page.getByRole('button', { name: 'Shell' }).first().click()
    await expect(page.getByTestId('guest-access-banner')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('shell-access-banner')).toBeVisible()
  })

  test('Ops Shelf opens from cinema handle', async ({ page }) => {
    await page.goto('/platform/vms/v1/consolehub')
    await expect(page.getByTestId('cinema-shell')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('ops-shelf-handle').click()
    const panel = page.getByTestId('ops-shelf')
    await expect(panel).toBeVisible({ timeout: 15_000 })
    await expect(panel.getByTestId('vm-port-forward-panel')).toBeVisible()
    await expect(panel.getByTestId('consolehub-session-history')).toBeVisible()
    await panel.getByRole('button', { name: 'Health' }).click()
    await expect(panel.getByRole('button', { name: 'Run scan' })).toBeVisible()
  })

  test('KubeVirt VM serial in studio uses native console', async ({ page }) => {
    await page.goto('/platform/vms/kv1/consolehub?mode=studio')
    await expect(page.getByText('kv-vm-1').first()).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Serial' }).first().click()
    await expect(page.getByTestId('kubevirt-serial-console')).toBeVisible({ timeout: 15_000 })
  })

  test('SPICE VM shows WebRTC in cinema protocol chips', async ({ page }) => {
    await page.goto('/platform/vms/sp1/consolehub')
    await expect(page.getByTestId('cinema-shell')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'webrtc spice', exact: true }).click()
    await expect(page.getByTestId('webrtc-spice-console')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Performance mode/i)).toBeVisible()
  })
})
