// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockAuthenticatedApi } from './helpers/authMock'

test.describe('classic operator UX', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedApi(page)
  })

  test('/vms loads virtual machines list', async ({ page }) => {
    await page.goto('/vms')
    await expect(page.getByRole('heading', { name: /virtual machines/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('vm-1').or(page.getByText('No guests on this host'))).toBeVisible()
  })

  test('/networks shows networks page', async ({ page }) => {
    await page.goto('/networks')
    await expect(page.getByRole('heading', { name: 'Networks', exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('No libvirt networks')).toBeVisible()
  })

  test('/jobs shows jobs page with empty or list state', async ({ page }) => {
    await page.goto('/jobs')
    await expect(page.getByRole('heading', { name: 'Jobs', exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Recent jobs' })).toBeVisible()
  })

  test('live metrics page renders', async ({ page }) => {
    await page.goto('/events')
    await expect(page.getByRole('heading', { name: /live metrics/i })).toBeVisible({ timeout: 15_000 })
  })
})
