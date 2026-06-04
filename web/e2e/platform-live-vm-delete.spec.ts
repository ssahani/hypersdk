// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Live UX: delete VM on deployed host (regression for post-delete navigation crash).

import { test, expect } from '@playwright/test'
import { ensureLoggedIn, liveCredentials, setDesktopTier } from './helpers/liveAuth'

const live = process.env.PLAYWRIGHT_LIVE_URL?.replace(/\/$/, '')

test.skip(!live || !liveCredentials(), 'Set PLAYWRIGHT_LIVE_URL, PLAYWRIGHT_LIVE_USER, PLAYWRIGHT_LIVE_PASS')

test.beforeEach(async ({ page }) => {
  await setDesktopTier(page, 'power')
  await ensureLoggedIn(page, live!, '/platform')
})

test('live delete vm returns to list without page crash', async ({ page }) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto(`${live}/platform/vms`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Virtual Machines', exact: true })).toBeVisible({
    timeout: 45_000,
  })

  // VM detail links only (exclude /console and other sub-routes).
  const vmLink = page.locator('a[href^="/platform/vms/"]:not([href*="/console"])').first()
  const hasVm = await vmLink.isVisible().catch(() => false)
  test.skip(!hasVm, 'No VMs on host — run live create spec first or create a VM manually')

  const href = await vmLink.getAttribute('href')
  const vmId = href?.split('/').pop() ?? ''
  expect(vmId.length).toBeGreaterThan(8)

  await vmLink.click()
  await expect(page.locator('button.btn-danger').filter({ hasText: 'Delete' })).toBeVisible({
    timeout: 20_000,
  })

  page.once('dialog', (d) => d.accept())
  const deleteReq = page.waitForResponse(
    (r) => r.url().includes(`/vms/${vmId}/delete`) && r.request().method() === 'POST',
    { timeout: 60_000 },
  )
  await page.locator('button.btn-danger').filter({ hasText: 'Delete' }).click()
  const res = await deleteReq
  expect(res.status()).toBeLessThan(500)

  await expect(page).toHaveURL(/\/platform\/vms\/?$/, { timeout: 20_000 })
  await expect(page.getByText('Application error|Something went wrong')).toHaveCount(0)
  expect(errors.filter((e) => !e.includes('ResizeObserver'))).toEqual([])

  // Reloading deleted detail must not white-screen (404 → redirect to list)
  await page.goto(`${live}/platform/vms/${vmId}`)
  await expect(page).toHaveURL(/\/platform\/vms\/?$/, { timeout: 15_000 })
  await expect(page.getByText('Application error|Something went wrong')).toHaveCount(0)
})
