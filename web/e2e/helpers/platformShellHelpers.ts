// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { expect, type Page } from '@playwright/test'

async function wakeDock(page: Page) {
  const vp = page.viewportSize() ?? { width: 1280, height: 900 }
  await page.mouse.move(vp.width / 2, vp.height - 8)
  await page.waitForTimeout(350)
}

/** Invisible full-screen layers that swallow clicks after partial dismiss. */
export async function assertNoShellClickBlockers(page: Page) {
  await expect(page.locator('.fixed.inset-0.z-40[aria-hidden="true"]')).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'Mission Control' })).toHaveCount(0)
  await expect(page.locator('[aria-labelledby="dock-editor-title"]')).toHaveCount(0)
}

/** Sidebar + dock remain clickable after overlay churn. */
export async function assertShellNavResponsive(page: Page) {
  await assertNoShellClickBlockers(page)

  const sidebarLink = page.locator('.platform-sidebar a[href^="/platform"]').first()
  if (await sidebarLink.count()) {
    const href = await sidebarLink.getAttribute('href')
    await sidebarLink.click()
    if (href) {
      await expect(page).toHaveURL(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\?|$)`))
    }
  }

  const dock = page.getByRole('navigation', { name: 'Platform dock' })
  await wakeDock(page)
  await dock.scrollIntoViewIfNeeded()
  const dockLink = dock.getByRole('link').first()
  await expect(dockLink).toBeVisible()
  await dockLink.click()
  await expect(page).toHaveURL(/\/platform/)
  await assertNoShellClickBlockers(page)
}

export async function clickRandomSidebar(page: Page) {
  const links = page.locator('.platform-sidebar a[href^="/platform"]')
  const count = await links.count()
  if (count === 0) return
  const idx = Math.floor(Math.random() * count)
  const href = await links.nth(idx).getAttribute('href')
  await links.nth(idx).click()
  if (href) {
    await expect(page).toHaveURL(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\?|$)`))
  }
}
