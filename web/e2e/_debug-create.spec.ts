// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('create page renders', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
  await mockPlatformApi(page)
  const chunkPromise = page.waitForResponse((r) => r.url().includes('CreateVM') && r.url().endsWith('.js'), { timeout: 30_000 }).catch(() => null)
  await page.goto('/create')
  const chunk = await chunkPromise
  console.log('CHUNK', chunk?.url() ?? 'none', chunk?.status())
  await page.waitForTimeout(3000)
  console.log('URL', page.url())
  const h1s = await page.locator('h1').allTextContents()
  console.log('H1S', h1s)
  console.log('ERRORS_EARLY', errors)
  await expect(page.getByRole('heading', { name: 'Create new guest VM' })).toBeVisible({ timeout: 20_000 })
  console.log('INSTALL_CARD', await page.getByText('Install from media').count())
  console.log('GOLDEN_CARD', await page.getByText('Clone from golden image').count())
  console.log('WIZARD', await page.getByText('Single-page form').count())
  console.log('HTML_LEN', (await page.content()).length)
  console.log('ERRORS', errors)
  await expect(page.getByText('Installation source')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('libvirt-templates-panel')).toBeVisible({ timeout: 10_000 })
  expect(errors, 'page should render without runtime errors').toEqual([])
})
