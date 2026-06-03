// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test.beforeEach(async ({ page }) => {
  await mockPlatformApi(page)
})

test('SOC hub overview loads', async ({ page }) => {
  await page.goto('/platform/soc')
  await expect(page.getByRole('heading', { name: 'Security Operations Center' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Open alerts')).toBeVisible()
  await expect(page.getByText('Unusual port activity')).toBeVisible()
})

test('SOC alerts tab shows queue', async ({ page }) => {
  await page.goto('/platform/soc')
  await page.getByRole('button', { name: 'Alerts' }).click()
  await expect(page.getByText('critical_anomaly')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ack' }).first()).toBeVisible()
})

test('SOC Splunk integration test', async ({ page }) => {
  await page.goto('/platform/soc')
  await page.getByRole('button', { name: 'Integrations' }).click()
  await expect(page.getByText('Splunk HTTP Event Collector')).toBeVisible()
  await page.getByRole('button', { name: 'Test connection' }).click()
  await expect(page.getByText(/Splunk HEC accepted/i)).toBeVisible({ timeout: 10_000 })
})
