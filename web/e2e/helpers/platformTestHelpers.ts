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
