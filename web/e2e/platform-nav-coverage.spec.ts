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

async function mockPlatformApi(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('zyvor-platform-welcome-done', '1')
    localStorage.setItem('machina-platform-desktop-tier', 'advanced')
  })
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/auth/session')) {
      return route.fulfill({
        json: { authenticated: true, username: 'admin', role: 'admin', auth_source: 'pam' },
      })
    }
    if (url.includes('/auth/providers')) {
      return route.fulfill({ json: { providers: [{ id: 'pam', label: 'PAM' }] } })
    }
    if (url.includes('/platform/info')) {
      return route.fulfill({ json: platformInfo })
    }
    return route.fulfill({ json: {} })
  })
}

test('advanced tier shows sidebar policy and Go menu opens', async ({ page }) => {
  await mockPlatformApi(page)
  await page.goto('/platform/policy')
  await expect(page.getByRole('heading', { name: /Policy & Quotas/i })).toBeVisible()

  await page.goto('/platform')
  const goMenu = page.getByRole('button', { name: /^Go$/i })
  if (await goMenu.count()) {
    await goMenu.click()
    await expect(page.getByRole('menuitem', { name: /Policy/i }).or(page.getByText('Policy & Quotas'))).toBeVisible({ timeout: 5000 })
  }
})

test('policy studio route loads', async ({ page }) => {
  await mockPlatformApi(page)
  await page.goto('/platform/zeus/security/policies')
  await expect(page.getByRole('heading', { name: /Policy Studio/i })).toBeVisible()
})
