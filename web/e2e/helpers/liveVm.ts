// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { expect, type Page } from '@playwright/test'
import { ensureLoggedIn, liveCredentials, setDesktopTier } from './liveAuth'

export const liveBaseUrl = () => process.env.PLAYWRIGHT_LIVE_URL?.replace(/\/$/, '') ?? ''

export const liveVmId = () => process.env.PLAYWRIGHT_LIBVIRT_VM_ID?.trim() ?? ''

export const liveVmName = () => process.env.PLAYWRIGHT_LIBVIRT_VM_NAME?.trim() || 'ubuntu-desktop'

const PRIMARY_TABS = new Set(['Overview', 'Console', 'Performance', 'Doctor', 'Disks', 'Devices'])

export function skipUnlessLiveVm(test: { skip: (cond: boolean, reason?: string) => void }) {
  test.skip(!liveBaseUrl() || !liveCredentials(), 'Set PLAYWRIGHT_LIVE_URL, PLAYWRIGHT_LIVE_USER, PLAYWRIGHT_LIVE_PASS')
  test.skip(!liveVmId(), 'Set PLAYWRIGHT_LIBVIRT_VM_ID')
}

/** Open platform VM detail for the configured libvirt VM. */
export async function openLiveVmDetail(page: Page, vmId = liveVmId(), vmName = liveVmName()) {
  const live = liveBaseUrl()
  await setDesktopTier(page, 'power')
  await ensureLoggedIn(page, live, '/platform')
  await page.goto(`${live}/platform/vms/${vmId}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(new RegExp(vmName, 'i')).first()).toBeVisible({ timeout: 60_000 })
}

/** Primary tabs are direct buttons; others live under the More menu. */
export async function openVmDetailTab(page: Page, label: string) {
  if (PRIMARY_TABS.has(label)) {
    await page.getByRole('button', { name: label, exact: true }).click()
    return
  }
  await page.getByRole('button', { name: /^More$/ }).click()
  await page.getByRole('menuitem', { name: label, exact: true }).click()
}

export async function platformApiGet(page: Page, path: string) {
  return page.request.get(`${liveBaseUrl()}${path}`, { ignoreHTTPSErrors: true })
}

export async function platformApiPost(page: Page, path: string, body?: unknown) {
  return page.request.post(`${liveBaseUrl()}${path}`, {
    ignoreHTTPSErrors: true,
    data: body,
  })
}
