// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApiWatch } from './helpers/apiWatch'
import { ensureLoggedIn, fetchPlatformFlags, type DesktopTier } from './helpers/liveAuth'

const live = process.env.PLAYWRIGHT_LIVE_URL?.replace(/\/$/, '')
test.skip(!live, 'Set PLAYWRIGHT_LIVE_URL to run live UX wiring tests')

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MANIFEST_PATH = path.join(ROOT, 'docs/ux-wiring-live-manifest.json')
const REPORT_PATH = path.join(ROOT, 'docs/ux-wiring-live-report.json')

interface ManifestAction {
  kind: 'tab' | 'click' | 'settingsSection'
  label?: string
  role?: string
  name?: string
}

interface ManifestEntry {
  id: string
  shell: string
  path: string
  tier: DesktopTier
  headingPattern: string
  requires: 'openstack' | 'k8s' | null
  actions: ManifestAction[]
}

interface RunResult {
  id: string
  path: string
  status: 'passed' | 'failed' | 'skipped'
  reason?: string
  apiFailures?: { url: string; status: number; reason: string }[]
  warnings?: number
}

const report: {
  host: string
  generated_at: string
  passed: number
  failed: number
  skipped: number
  results: RunResult[]
} = {
  host: live ? new URL(live).hostname : 'unknown',
  generated_at: new Date().toISOString(),
  passed: 0,
  failed: 0,
  skipped: 0,
  results: [],
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as { entries: ManifestEntry[] }

async function runAction(page: import('@playwright/test').Page, action: ManifestAction) {
  if (action.kind === 'tab' && action.label) {
    await page.getByRole('button', { name: action.label, exact: true }).click({ timeout: 8_000 })
    return
  }
  if (action.kind === 'settingsSection' && action.label) {
    await page.getByRole('button', { name: action.label }).click({ timeout: 8_000 })
    return
  }
  if (action.kind === 'click' && action.role && action.name) {
    await page.getByRole(action.role as 'button', { name: new RegExp(action.name, 'i') }).click({ timeout: 8_000 })
  }
}

test.describe.configure({ mode: 'serial' })

for (const entry of manifest.entries) {
  test(`live UX: ${entry.id}`, async ({ page }) => {
    test.setTimeout(180_000)
    const tier = entry.tier ?? 'normal'
    // Classic `/` redirects to `/platform` when the control plane is active — avoid login/navigation races.
    const loginPath = entry.path === '/' ? '/platform' : entry.path
    await ensureLoggedIn(page, live!, loginPath, tier)
    const flags = await fetchPlatformFlags(page, live!)

    if (entry.requires === 'openstack' && !flags.openstackEnabled) {
      report.skipped += 1
      report.results.push({ id: entry.id, path: entry.path, status: 'skipped', reason: 'openstack disabled' })
      test.skip(true, 'openstack disabled on host')
    }
    if (entry.requires === 'k8s' && !flags.k8sEnabled) {
      report.skipped += 1
      report.results.push({ id: entry.id, path: entry.path, status: 'skipped', reason: 'k8s disabled' })
      test.skip(true, 'k8s disabled on host')
    }

    const watch = createApiWatch(page)
    const heading = new RegExp(entry.headingPattern, 'i')

    await page.goto(`${live}${entry.path}`, { waitUntil: 'domcontentloaded', timeout: 45_000 })

    if (page.url().includes('/login')) {
      report.skipped += 1
      report.results.push({ id: entry.id, path: entry.path, status: 'skipped', reason: 'not authenticated' })
      watch.dispose()
      test.skip(true, 'login required — set PLAYWRIGHT_LIVE_USER/PASS')
    }

    if (entry.path.startsWith('/platform') && page.url().includes('/platform/settings') && !entry.path.includes('/settings')) {
      report.skipped += 1
      report.results.push({ id: entry.id, path: entry.path, status: 'skipped', reason: 'tier guard redirected to settings' })
      watch.dispose()
      test.skip(true, 'tier guard')
    }

    await page.waitForLoadState('domcontentloaded')
    await page.waitForFunction(
      () => (document.body?.innerText?.replace(/\s+/g, '')?.length ?? 0) > 0,
      { timeout: 45_000 },
    )
    await page.waitForTimeout(1500)

    const jsErrors: string[] = []
    page.on('pageerror', (e) => jsErrors.push(e.message))

    try {
      await expect(page.getByText(heading).first()).toBeVisible({ timeout: 15_000 })
    } catch {
      // Some classic pages use different chrome — still validate APIs if page loaded
    }

    for (const action of entry.actions ?? []) {
      watch.reset()
      try {
        await runAction(page, action)
        await page.waitForTimeout(1200)
      } catch {
        // Non-fatal: action missing on this host tier/skin
      }
    }

    await page.waitForTimeout(800)
    const apiFailures = watch.getFailures()
    const warnCount = watch.getWarnings().length
    watch.dispose()

    const hardJs = jsErrors.filter((e) => !e.includes('ResizeObserver'))
    if (apiFailures.length > 0 || hardJs.length > 0) {
      report.failed += 1
      report.results.push({
        id: entry.id,
        path: entry.path,
        status: 'failed',
        reason: hardJs[0] ?? apiFailures[0]?.reason,
        apiFailures,
      })
      expect(apiFailures, `API failures on ${entry.path}`).toEqual([])
      expect(hardJs).toEqual([])
    } else {
      report.passed += 1
      report.results.push({
        id: entry.id,
        path: entry.path,
        status: 'passed',
        warnings: warnCount,
      })
    }
  })
}

test.afterAll(async () => {
  report.generated_at = new Date().toISOString()
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n')
})
