// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test.describe('Cockpit parity surfaces (mock)', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlatformApi(page, { tier: 'power' })
  })

  test('VM overview compute panel opens CPU topology modal', async ({ page }) => {
    await page.goto('/platform/vms/v1')
    await expect(page.getByRole('heading', { name: 'vm-1' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Compute' })).toBeVisible()
    await expect(page.getByText('1×2×1')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Edit CPU' }).click()
    await expect(page.getByText(/CPU topology — vm-1/i)).toBeVisible()
    await expect(page.getByText('Active vCPUs:')).toBeVisible()
  })

  test('VM overview shows hypervisor resources panel', async ({ page }) => {
    await page.goto('/platform/vms/v1')
    await expect(page.getByRole('heading', { name: 'Hypervisor resources' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Filesystems' })).toBeVisible()
  })

  test('Storage pool volumes expand and list', async ({ page }) => {
    await page.goto('/platform/storage')
    await page.getByRole('tab', { name: 'Pools' }).click()
    await expect(page.getByTestId('storage-pool-default')).toBeVisible({ timeout: 15_000 })
    const toggle = page.getByTestId('pool-volumes-toggle-default')
    if (!(await toggle.textContent())?.includes('Hide volumes')) {
      await toggle.click()
    }
    await expect(page.getByText('vol-a')).toBeVisible()
  })

  test('Machine Finder shows guest IP from batch fallback', async ({ page }) => {
    await page.goto('/platform/vms?lens=table')
    await expect(page.getByRole('heading', { name: /Machine Finder/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('192.168.122.50').first()).toBeVisible({ timeout: 15_000 })
  })

  test('Snapshots panel loads with precheck API', async ({ page }) => {
    await page.goto('/platform/vms/v1')
    await page.getByRole('button', { name: 'More' }).click()
    await page.getByRole('menuitem', { name: 'Snapshots', exact: true }).click()
    await expect(page.getByTestId('vm-snapshots-panel')).toBeVisible({ timeout: 15_000 })
  })

  test('VM overview shows live CPU and memory usage bars', async ({ page }) => {
    await page.goto('/platform/vms/v1')
    await expect(page.getByTestId('vm-usage-bars')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('vm-usage-cpu')).toBeVisible()
    await expect(page.getByTestId('vm-usage-memory')).toBeVisible()
  })

  test('Machine Finder resource strip shows pool and network counts', async ({ page }) => {
    await page.goto('/platform/vms?lens=table')
    const strip = page.getByTestId('machine-finder-resource-strip')
    await expect(strip).toBeVisible({ timeout: 15_000 })
    await expect(strip.getByText(/active/i).first()).toBeVisible()
  })

  test('Host detail storage tab shows Cockpit storaged inventory', async ({ page }) => {
    await page.goto('/platform/hosts/h1?tab=storage')
    await expect(page.getByTestId('host-cockpit-storage')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('RAID (mdadm)')).toBeVisible()
    await expect(page.getByText('/dev/md0')).toBeVisible()
  })

  test('Host detail system tab shows kdump and SELinux panels', async ({ page }) => {
    await page.goto('/platform/hosts/h1?tab=system')
    await expect(page.getByTestId('host-cockpit-system')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Enforcing' })).toBeVisible()
  })
})
