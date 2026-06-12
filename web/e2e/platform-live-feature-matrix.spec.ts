// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Serial feature-by-feature matrix (live lab) — read-only F01 through F18.

import { test, expect } from '@playwright/test'
import { discoverLiveVm, openLiveVmDetailById } from './helpers/featureMatrix'
import { ensureLoggedIn } from './helpers/liveAuth'
import { liveBaseUrl, openVmDetailTab, skipUnlessLiveVm } from './helpers/liveVm'

test.describe.configure({ mode: 'serial' })

let liveVm: { id: string; guest_ip?: string; observed_state?: string } | null = null

test.beforeEach(({ page: _page }, testInfo) => {
  skipUnlessLiveVm(testInfo)
})

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage()
  const live = liveBaseUrl()
  await ensureLoggedIn(page, live, { tier: 'power' })
  liveVm = await discoverLiveVm(page, live)
  await page.close()
})

test('F01 — live VM detail hero and action surfaces', async ({ page }) => {
  test.skip(!liveVm?.id, 'no platform VMs on host')
  const live = liveBaseUrl()
  await ensureLoggedIn(page, live, { tier: 'power' })
  await openLiveVmDetailById(page, live, liveVm!.id)
  await expect(page.getByTestId('vm-detail-hero')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('vm-detail-action-bar')).toBeVisible()
})

test('F02 — live action bar Cinema and power overflow menu', async ({ page }) => {
  test.skip(!liveVm?.id, 'no platform VMs on host')
  const live = liveBaseUrl()
  await ensureLoggedIn(page, live, { tier: 'power' })
  await openLiveVmDetailById(page, live, liveVm!.id)
  const bar = page.getByTestId('vm-detail-action-bar')
  await expect(bar.getByRole('link', { name: /Open Cinema/i })).toBeVisible()
  const overflow = page.getByRole('button', { name: /Power & more/i })
  if (await overflow.isVisible().catch(() => false)) {
    await overflow.click()
    await expect(page.getByRole('menu')).toBeVisible()
  }
})

test('F03 — live attention stack or connect checklist visible', async ({ page }) => {
  test.skip(!liveVm?.id, 'no platform VMs on host')
  const live = liveBaseUrl()
  await ensureLoggedIn(page, live, { tier: 'power' })
  await openLiveVmDetailById(page, live, liveVm!.id)
  await expect(
    page.getByTestId('vm-attention-stack').or(page.getByTestId('vm-laptop-access-checklist')),
  ).toBeVisible({ timeout: 20_000 })
})

test('F04 — live Connect hub on Overview', async ({ page }) => {
  test.skip(!liveVm?.id, 'no platform VMs on host')
  const live = liveBaseUrl()
  await ensureLoggedIn(page, live, { tier: 'power' })
  await openLiveVmDetailById(page, live, liveVm!.id)
  await expect(page.getByTestId('vm-daily-access')).toBeVisible({ timeout: 20_000 })
})

test('F05 — live Access tab with NAT panel', async ({ page }) => {
  test.skip(!liveVm?.id, 'no platform VMs on host')
  const live = liveBaseUrl()
  await ensureLoggedIn(page, live, { tier: 'power' })
  await openLiveVmDetailById(page, live, liveVm!.id, 'access')
  await expect(page.getByTestId('vm-port-forward-panel')).toBeVisible({ timeout: 20_000 })
})

test('F06 — live SSH connect dialog from header', async ({ page }) => {
  test.skip(!liveVm?.id, 'no platform VMs on host')
  const live = liveBaseUrl()
  await ensureLoggedIn(page, live, { tier: 'power' })
  await openLiveVmDetailById(page, live, liveVm!.id)
  await page.getByTestId('vm-detail-action-bar').getByRole('button', { name: 'SSH' }).click()
  await expect(page.getByTestId('vm-ssh-connect-dialog')).toBeVisible({ timeout: 10_000 })
})

test('F07 — live network tab NAT panel exposes SSH preset', async ({ page }) => {
  test.skip(!liveVm?.id, 'no platform VMs on host')
  const live = liveBaseUrl()
  await ensureLoggedIn(page, live, { tier: 'power' })
  await openLiveVmDetailById(page, live, liveVm!.id, 'network')
  await expect(page.getByTestId('vm-port-forward-panel')).toBeVisible({ timeout: 20_000 })
  const sshBtn = page.getByTestId('expose-service-ssh')
  test.skip((await sshBtn.count()) === 0, 'SSH preset already exposed or unavailable')
  await expect(sshBtn).toBeVisible()
})

test('F08 — live Overview usage or compute panels', async ({ page }) => {
  test.skip(!liveVm?.id, 'no platform VMs on host')
  const live = liveBaseUrl()
  await ensureLoggedIn(page, live, { tier: 'power' })
  await openLiveVmDetailById(page, live, liveVm!.id)
  await expect(
    page.getByTestId('vm-usage-bars').or(page.getByRole('heading', { name: 'Compute' })),
  ).toBeVisible({ timeout: 20_000 })
})

test('F09 — live Console tab guidance', async ({ page }) => {
  test.skip(!liveVm?.id, 'no platform VMs on host')
  const live = liveBaseUrl()
  await ensureLoggedIn(page, live, { tier: 'power' })
  await openLiveVmDetailById(page, live, liveVm!.id, 'console')
  await expect(page.getByRole('link', { name: /Open Cinema/i })).toBeVisible({ timeout: 15_000 })
})

test('F10 — live Doctor tab loads', async ({ page }) => {
  test.skip(!liveVm?.id, 'no platform VMs on host')
  const live = liveBaseUrl()
  await ensureLoggedIn(page, live, { tier: 'power' })
  await openLiveVmDetailById(page, live, liveVm!.id)
  await openVmDetailTab(page, 'Doctor')
  await expect(page.getByRole('button', { name: /Rescan|Run migrate plan/i }).first()).toBeVisible({
    timeout: 30_000,
  })
})

test('F11 — live ConsoleHub cinema and serial recovery', async ({ page }) => {
  test.skip(!liveVm?.id, 'no platform VMs on host')
  const live = liveBaseUrl()
  await ensureLoggedIn(page, live, { tier: 'power' })
  await page.goto(`${live}/platform/vms/${liveVm!.id}/consolehub`)
  await expect(page.getByTestId('cinema-shell')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Serial' }).first().click()
  await expect(
    page.getByTestId('console-login-recovery').or(page.getByTestId('vm-laptop-access-checklist')),
  ).toBeVisible({ timeout: 20_000 })
})

test('F12 — live Machine Finder SSH entry point', async ({ page }) => {
  test.skip(!liveVm?.id, 'no platform VMs on host')
  const live = liveBaseUrl()
  await ensureLoggedIn(page, live, { tier: 'power' })
  await page.goto(`${live}/platform/vms?lens=table`)
  await expect(page.getByRole('heading', { name: /Machine Finder/i })).toBeVisible({ timeout: 20_000 })
  const sshBtn = page.getByTitle('SSH').first()
  test.skip((await sshBtn.count()) === 0, 'no VMs in table')
  await sshBtn.click()
  await expect(page.getByTestId('vm-ssh-connect-dialog')).toBeVisible({ timeout: 10_000 })
})

test('F13 — live Mission Control SSH dialog', async ({ page }) => {
  test.skip(!liveVm?.id, 'no platform VMs on host')
  const live = liveBaseUrl()
  await ensureLoggedIn(page, live, { tier: 'power' })
  await page.goto(`${live}/platform`)
  const vmCard = page.getByText(/ubuntu-desktop|vm-/i).first()
  test.skip((await vmCard.count()) === 0, 'Mission Control VM card not found')
  await vmCard.click({ timeout: 15_000 })
  await expect(page.getByTestId('fleet-command-center')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('fleet-command-center').getByRole('button', { name: 'SSH' }).click()
  await expect(page.getByTestId('vm-ssh-connect-dialog')).toBeVisible({ timeout: 10_000 })
})

test('F14 — live Compute panel and Edit CPU modal', async ({ page }) => {
  test.skip(!liveVm?.id, 'no platform VMs on host')
  const live = liveBaseUrl()
  await ensureLoggedIn(page, live, { tier: 'power' })
  await openLiveVmDetailById(page, live, liveVm!.id)
  await expect(
    page.getByRole('heading', { name: 'Compute' }).or(page.getByTestId('vm-usage-bars')),
  ).toBeVisible({ timeout: 20_000 })
  const editCpu = page.getByRole('button', { name: 'Edit CPU' })
  test.skip((await editCpu.count()) === 0, 'Compute panel not available')
  await editCpu.click()
  await expect(page.getByText(/CPU topology/i)).toBeVisible({ timeout: 10_000 })
})

test('F15 — live Disks tab attach and resize forms', async ({ page }) => {
  test.skip(!liveVm?.id, 'no platform VMs on host')
  const live = liveBaseUrl()
  await ensureLoggedIn(page, live, { tier: 'power' })
  await openLiveVmDetailById(page, live, liveVm!.id, 'disks')
  await expect(page.getByTestId('vm-disks-panel')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Attach disk' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Resize block device' })).toBeVisible()
})

test('F16 — live Network tab Attach NIC', async ({ page }) => {
  test.skip(!liveVm?.id, 'no platform VMs on host')
  const live = liveBaseUrl()
  await ensureLoggedIn(page, live, { tier: 'power' })
  await openLiveVmDetailById(page, live, liveVm!.id, 'network')
  await expect(page.getByTestId('vm-network-panel')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Attach NIC' })).toBeVisible()
})

test('F17 — live Snapshots tab create workflow', async ({ page }) => {
  test.skip(!liveVm?.id, 'no platform VMs on host')
  const live = liveBaseUrl()
  await ensureLoggedIn(page, live, { tier: 'power' })
  await openLiveVmDetailById(page, live, liveVm!.id, 'snapshots')
  await expect(page.getByTestId('vm-snapshots-panel')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Create snapshot' })).toBeVisible()
})

test('F18 — live Devices tab and Disks insert ISO panel', async ({ page }) => {
  test.skip(!liveVm?.id, 'no platform VMs on host')
  const live = liveBaseUrl()
  await ensureLoggedIn(page, live, { tier: 'power' })
  await openLiveVmDetailById(page, live, liveVm!.id, 'devices')
  await expect(page.getByTestId('vm-devices-panel')).toBeVisible({ timeout: 30_000 })
  await openLiveVmDetailById(page, live, liveVm!.id, 'disks')
  await expect(page.getByTestId('vm-insert-iso-panel')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('vm-insert-iso-submit')).toBeVisible()
})
