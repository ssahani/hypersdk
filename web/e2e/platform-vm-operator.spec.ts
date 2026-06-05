// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('missing VM folder shows prune control', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  page.on('dialog', (d) => d.accept())
  await page.goto('/platform/vms?folder=missing')
  await expect(page.getByRole('button', { name: 'Prune missing records' })).toBeVisible({ timeout: 15_000 })
  const pruneReq = page.waitForResponse(
    (r) => r.url().includes('/vms/prune-missing') && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Prune missing records' }).click()
  expect((await pruneReq).ok()).toBeTruthy()
})

test('vm network tab shows hypervisor NAT port forwards', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/vms/v1?tab=network')
  await expect(page.getByRole('heading', { name: 'Hypervisor NAT (port forwards)' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('9080→80')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Expose' })).toBeVisible()
})

test('host linux tab shows GPU inventory', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/hosts/h1')
  await expect(page.getByRole('heading', { name: 'host-1', level: 1 })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('tab', { name: 'Linux' }).click()
  await expect(page.getByRole('heading', { name: 'GPU inventory' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('NVIDIA L40', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'GPU Command Center' })).toBeVisible()
})

test('doctor tab deep-links GuestKit migrate plan on guest health', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/vms/v1?tab=doctor')
  await expect(page.getByRole('button', { name: 'Run migrate plan' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Run migrate plan' }).click()
  await expect(page).toHaveURL(/tab=guestHealth/)
  await expect(page.getByText('KVM migration plan')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('82%')).toBeVisible()
})
