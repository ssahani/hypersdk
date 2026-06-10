// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('Machine Finder shows site → rack → host → VM columns', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/platform/hosts/finder')
  await expect(page.getByRole('heading', { name: /Machine Finder/i })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'DC-1' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Rack A' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'host-1' })).toBeVisible()
  await page.getByRole('button', { name: 'host-1' }).click()
  const vmColumn = page.locator('.mac-finder-columns button').filter({ hasText: 'vm-1' })
  await expect(vmColumn.first()).toBeVisible({ timeout: 10_000 })
  await vmColumn.first().click()
  await expect(page.getByRole('link', { name: 'Open VM' })).toBeVisible()
})

test('Machine Finder auto-selects sole unassigned host and opens inspector', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.route('**/fleet/mission**', async (route) => {
    await route.fulfill({
      json: {
        sites: [],
        unassigned_hosts: [
          {
            id: 'host-local',
            hostname: 'localhost',
            address: '127.0.0.1',
            state: 'online',
            maintenance_mode: false,
            vm_count: 2,
            cpu_percent: 12,
            memory_used_mib: 4096,
            memory_total_mib: 16384,
            site: '',
            rack: '',
          },
        ],
        summary: { hosts: 1, vms: 2, hosts_online: 1, health_pct: 100 },
      },
    })
  })
  await page.goto('/platform/hosts/finder')
  await expect(page.getByRole('heading', { name: /Machine Finder/i })).toBeVisible({ timeout: 15_000 })
  await expect(page).toHaveURL(/host=host-local/, { timeout: 10_000 })
  await expect(page.getByRole('link', { name: 'Open host' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTitle('Icon view')).toHaveCount(0)
})

test('Hosts context includes Infrastructure Finder route', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/hosts/finder')
  await expect(page.getByRole('heading', { name: /Machine Finder/i })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('link', { name: 'Mission Control' })).toBeVisible()
})
