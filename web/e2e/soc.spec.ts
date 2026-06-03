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

test('SOC alerts tab shows detail panel', async ({ page }) => {
  await page.goto('/platform/soc')
  await page.getByRole('button', { name: 'Alerts' }).click()
  await expect(page.getByRole('button', { name: /critical_anomaly/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Alert detail' })).toBeVisible()
  await expect(page.getByText('MITRE ATT&CK')).toBeVisible()
  await expect(page.getByText('T1046')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Acknowledge' })).toBeVisible()
})

test('SOC Splunk integration test', async ({ page }) => {
  await page.goto('/platform/soc')
  await page.getByRole('button', { name: 'Integrations' }).click()
  await expect(page.getByText('Splunk HTTP Event Collector')).toBeVisible()
  await page.getByRole('button', { name: 'Test connection' }).click()
  await expect(page.getByText(/Splunk HEC accepted/i)).toBeVisible({ timeout: 10_000 })
})

test('SOC playbooks tab loads editor', async ({ page }) => {
  await page.goto('/platform/soc')
  await page.getByRole('button', { name: 'Playbooks' }).click()
  await expect(page.getByRole('button', { name: /notify_on_critical/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Global webhook/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Edit: notify_on_critical/ })).toBeVisible()
})
