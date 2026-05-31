// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import type { Page } from '@playwright/test'

/** Wait until platform session + info mocks have responded (shell bridge depends on info). */
export async function waitForPlatformSession(page: Page) {
  await page.waitForResponse(
    (r) => {
      const url = r.url()
      return url.includes('/api/v1/') && (
        url.includes('/auth/session')
        || url.includes('/system/platform-info')
        || url.includes('/auth/providers')
      )
    },
    { timeout: 20_000 },
  ).catch(() => { /* already fulfilled */ })
}
