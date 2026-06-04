// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('create vm wizard blocks finish when template not ready', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power', templateNotReady: true })
  await page.goto('/platform/vms?create=test-vm')
  await expect(page.getByRole('heading', { name: 'Create Virtual Machine' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Missing disk image')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.locator('button.btn-primary.min-w-\\[7rem\\]').filter({ hasText: /^Create VM$/ })).toBeDisabled()
})

test('storage pool wizard shows Next through review', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power', emptyStorage: true })
  await page.goto('/platform/storage?tab=pools')
  await page.getByRole('button', { name: 'Add pool wizard' }).click()
  await expect(page.getByRole('heading', { name: 'Add storage pool' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next' })).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Path on host')).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Backend: directory')).toBeVisible()
})

test('templates page can prefetch missing golden images', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/templates')
  await expect(page.getByText('Marketplace golden images')).toBeVisible({ timeout: 15_000 })
  const prefetchReq = page.waitForResponse(
    (r) => r.url().includes('prefetch-missing') && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /Download 1 image/ }).click()
  const res = await prefetchReq
  expect(res.ok()).toBeTruthy()
  const body = (await res.json()) as { task_id?: string }
  expect(body.task_id).toBe('prefetch-task-1')
})

test('template readiness shows auto-fetch on first create', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power', templateAutoFetch: true })
  await page.goto('/platform/vms?create=test-vm')
  await expect(page.getByRole('heading', { name: 'Create Virtual Machine' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Will download on first create')).toBeVisible({ timeout: 10_000 })
})

test('network wizard shows discover hint when inventory empty', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power', emptyNetworks: true })
  await page.goto('/platform/networks')
  await expect(page.getByText('No networks yet')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Create network' }).click()
  await expect(page.getByRole('heading', { name: 'Add network' })).toBeVisible()
  await expect(page.getByText('No networks in inventory yet')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next' })).toBeVisible()
})
