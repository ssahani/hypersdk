// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { expect, type Page } from '@playwright/test'

/** Fleet insights on the dashboard collapse DNA / enterprise strips by default. */
export async function expandFleetInsights(page: Page) {
  const toggle = page.getByTestId('platform-fleet-insights-toggle')
  await expect(toggle).toBeVisible({ timeout: 15_000 })
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  }
}

/** Assert the page scrolls like a normal document (not trapped in an inner pane). */
export async function expectPageScrolls(page: Page, opts?: { viewportHeight?: number }) {
  if (opts?.viewportHeight) {
    const size = page.viewportSize() ?? { width: 1280, height: 720 }
    await page.setViewportSize({ width: size.width, height: opts.viewportHeight })
  }
  const scrollable = await page.evaluate(
    () => document.documentElement.scrollHeight > document.documentElement.clientHeight + 40,
  )
  expect(scrollable).toBe(true)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const atBottom = await page.evaluate(
    () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 80,
  )
  expect(atBottom).toBe(true)
}
