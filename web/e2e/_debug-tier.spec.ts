// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('debug create templates response', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/create', { waitUntil: 'networkidle' })
  const res = await page.waitForResponse((r) => r.url().includes('/api/v1/templates') && r.request().method() === 'GET')
  console.log('TEMPLATE_JSON', await res.json())
  await page.waitForTimeout(1500)
  console.log('URL', page.url())
  console.log('HEADING', await page.getByRole('heading', { name: 'Create new guest VM' }).count())
  console.log('PANEL', await page.getByTestId('libvirt-templates-panel').count())
  console.log('INSTALL_FLOW', await page.getByText('Installation source').count())
  console.log('SNIP', (await page.locator('body').innerText()).slice(0, 400))
  console.log('MAIN', await page.locator('#main-content').innerText().catch(() => ''))
  console.log('ERRORS', errors)
})

test('debug soc tier redirect', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/soc')
  await page.waitForTimeout(1500)
  console.log('URL', page.url())
  console.log('SOC_HEADING', await page.getByRole('heading', { name: 'Security Operations Center' }).count())
})

test('debug migration hypersdk', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/migration', { waitUntil: 'networkidle' })
  await page.waitForResponse((r) => r.url().includes('/system/platform-info'))
  await page.waitForTimeout(3000)
  console.log('URL', page.url())
  const info = await page.evaluate(async () => {
    const res = await fetch('/api/v1/system/platform-info', { credentials: 'same-origin' })
    return res.json()
  })
  console.log('INFO_HYPERSDK', info?.hypersdk)
  console.log('RADAR', await page.getByText('Migration Radar').count())
  console.log('HYPERSDK_TEXT', await page.getByText('HyperSDK', { exact: true }).count())
  console.log('SNIP', (await page.locator('body').innerText()).slice(0, 500))
  console.log('ERRORS', errors)
})
