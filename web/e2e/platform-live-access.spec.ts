// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { ensureLoggedIn } from './helpers/liveAuth'

const live = process.env.PLAYWRIGHT_LIVE_URL?.replace(/\/$/, '')
test.skip(!live, 'Set PLAYWRIGHT_LIVE_URL to run live access e2e')

test.beforeEach(async ({ page }) => {
  await ensureLoggedIn(page, live!, { tier: 'power' })
})

test('platform VM overview shows daily access when guest IP is private', async ({ page }) => {
  const vmsRes = await page.request.get(`${live}/api/v1/platform/controller/api/v1/vms`, {
    ignoreHTTPSErrors: true,
  })
  expect(vmsRes.ok()).toBeTruthy()
  const vms = (await vmsRes.json()) as Array<{ id: string; guest_ip?: string }>
  const vm = vms.find((v) => v.guest_ip?.startsWith('192.168.')) ?? vms[0]
  test.skip(!vm?.id, 'no platform VMs on host')

  await page.goto(`${live}/platform/vms/${vm.id}`)
  await expect(page.getByTestId('vm-daily-access').or(page.getByTestId('vm-laptop-access-checklist'))).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByTestId('vm-detail-action-bar')).toBeVisible({ timeout: 20_000 })
})

test('Access tab shows connect hub on live VM', async ({ page }) => {
  const vmsRes = await page.request.get(`${live}/api/v1/platform/controller/api/v1/vms`, {
    ignoreHTTPSErrors: true,
  })
  const vms = (await vmsRes.json()) as Array<{ id: string; guest_ip?: string }>
  const vm = vms.find((v) => v.guest_ip?.startsWith('192.168.')) ?? vms[0]
  test.skip(!vm?.id, 'no platform VMs on host')

  await page.goto(`${live}/platform/vms/${vm.id}?tab=access`)
  await expect(page.getByTestId('vm-daily-access')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('vm-port-forward-panel')).toBeVisible({ timeout: 20_000 })
})

test('network tab exposes SSH via port forward panel', async ({ page }) => {
  const vmsRes = await page.request.get(`${live}/api/v1/platform/controller/api/v1/vms`, {
    ignoreHTTPSErrors: true,
  })
  const vms = (await vmsRes.json()) as Array<{ id: string; guest_ip?: string }>
  const vm = vms.find((v) => v.guest_ip?.startsWith('192.168.')) ?? vms[0]
  test.skip(!vm?.id, 'no platform VMs on host')

  await page.goto(`${live}/platform/vms/${vm.id}?tab=network`)
  await expect(page.getByTestId('vm-port-forward-panel')).toBeVisible({ timeout: 20_000 })
  const sshBtn = page.getByTestId('expose-service-ssh')
  if (await sshBtn.count()) {
    const createReq = page.waitForRequest(
      (req) => req.url().includes('/port-forwards') && req.method() === 'POST',
    )
    await sshBtn.click()
    const req = await createReq
    expect(req.postDataJSON()).toMatchObject({ vm_port: 22 })
  }
})

test('ConsoleHub serial lens shows recovery card on private NAT VM', async ({ page }) => {
  const vmsRes = await page.request.get(`${live}/api/v1/platform/controller/api/v1/vms`, {
    ignoreHTTPSErrors: true,
  })
  const vms = (await vmsRes.json()) as Array<{ id: string; guest_ip?: string }>
  const vm = vms.find((v) => v.guest_ip?.startsWith('192.168.')) ?? vms[0]
  test.skip(!vm?.id, 'no platform VMs on host')

  await page.goto(`${live}/platform/vms/${vm.id}/consolehub`)
  await page.getByRole('button', { name: 'Serial' }).first().click()
  await expect(
    page.getByTestId('console-login-recovery').or(page.getByTestId('vm-laptop-access-checklist')),
  ).toBeVisible({ timeout: 20_000 })
})

test('Machine Finder table SSH opens connect dialog', async ({ page }) => {
  await page.goto(`${live}/platform/vms?lens=table`)
  await expect(page.getByRole('heading', { name: /Machine Finder/i })).toBeVisible({ timeout: 20_000 })
  const sshBtn = page.getByTitle('SSH').first()
  test.skip((await sshBtn.count()) === 0, 'no VMs in table')
  await sshBtn.click()
  await expect(page.getByTestId('vm-ssh-connect-dialog')).toBeVisible({ timeout: 10_000 })
})
