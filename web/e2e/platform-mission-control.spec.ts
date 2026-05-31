// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'

const platformInfo = {
  version: '0.1.0-test',
  tls: { enabled: false },
  auth: { pam_service: 'sshd', oidc_enabled: false },
  control_plane: {
    proxy_url: '/api/v1/platform/controller',
    direct_url: 'http://127.0.0.1:5093',
  },
  kubevirt: { exec_enabled: false },
  openstack: { enabled: false, configured: false },
}

const missionOverview = {
  sites: [
    {
      name: 'Pune',
      racks: [
        {
          name: 'Rack 01',
          hosts: [
            {
              id: 'e5caecb1-f1c0-48c4-8721-276eecb1f747',
              hostname: 'NLDW3-6-18-28',
              address: '127.0.0.1',
              state: 'online',
              maintenance_mode: false,
              vm_count: 5,
              cpu_percent: 42,
              memory_used_mib: 8192,
              memory_total_mib: 32768,
              site: 'Pune',
              rack: 'Rack 01',
              rack_u: 12,
            },
          ],
        },
      ],
    },
  ],
  unassigned_hosts: [],
  summary: { hosts: 1, vms: 5, hosts_online: 1, health_pct: 100 },
}

async function mockPlatformApi(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('zyvor-platform-welcome-done', '1')
    localStorage.setItem('machina-platform-desktop-tier', 'normal')
  })
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/auth/session')) {
      return route.fulfill({
        json: { authenticated: true, username: 'admin', role: 'admin', auth_source: 'pam' },
      })
    }
    if (url.includes('/auth/providers')) {
      return route.fulfill({
        json: { pam: { enabled: true }, ldap: { enabled: false }, oidc: { enabled: false } },
      })
    }
    if (url.includes('/system/platform-info')) {
      return route.fulfill({ json: platformInfo })
    }
    if (url.includes('fleet/mission')) {
      return route.fulfill({ json: missionOverview })
    }
    if (url.includes('/platform/controller/api/v1/fleet/desktop')) {
      return route.fulfill({
        json: {
          summary: '1 host online · 5 VMs',
          zeus_status: 'idle',
          zeus_highlights: [],
          slo_count: 0,
          slo_breach_count: 0,
          p95_latency_ms: 0,
          hosts_online: 1,
          hosts_total: 1,
          vm_count: 5,
          active_tasks: 0,
          failed_tasks_24h: 0,
          unread_notifications: 0,
          pressure_hosts: 0,
          linux_summary: 'OK',
        },
      })
    }
    if (url.includes('/platform/controller/api/v1/hosts')) {
      return route.fulfill({
        json: [{
          id: 'e5caecb1-f1c0-48c4-8721-276eecb1f747',
          hostname: 'NLDW3-6-18-28',
          address: '127.0.0.1',
          state: 'online',
          maintenance_mode: false,
          vm_count: 5,
        }],
      })
    }
    if (url.includes('/platform/controller/api/v1/vms')) {
      return route.fulfill({ json: [] })
    }
    if (url.includes('/platform/controller/api/v1/tasks')) {
      return route.fulfill({ json: [] })
    }
    if (url.includes('/platform/controller/api/v1/cluster')) {
      return route.fulfill({ json: { name: 'e2e-cluster', hosts: 1, vms: 5 } })
    }
    if (url.includes('/ai/')) {
      return route.fulfill({ json: { forecasts: [], highlights: [], status: 'idle', tagline: 'OK' } })
    }
    if (url.includes('/events/stream') || url.includes('/ws/')) {
      return route.abort()
    }
    return route.fulfill({ json: [] })
  })
}

test('platform mission control overlay and infrastructure earth', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  await mockPlatformApi(page)
  await page.goto('/platform')
  await expect(page.getByText('Machina Intelligence')).toBeVisible({ timeout: 15_000 })
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('machina-open-mission-control')))
  await expect(page.getByRole('dialog', { name: 'Mission Control' })).toBeVisible({ timeout: 15_000 })
  expect(errors).toEqual([])
})

test('platform jarvis briefing strip', async ({ page }) => {
  await mockPlatformApi(page)
  await page.goto('/platform')
  await expect(page.getByText('Machina Intelligence')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: /Ask Machina/i })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mission Control' })).toBeVisible()
})
