// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('Network canvas renders PacketWolf Network Brain panels', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'normal' })
  await page.goto('/platform/network-canvas')
  await expect(page.getByRole('heading', { name: /network canvas/i })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/PacketWolf Network Brain connected/i)).toBeVisible()
  await expect(page.getByTestId('network-service-map-graph')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Workloads' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Fleet timeline' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Threat pulse' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Kubernetes nodes' })).toBeVisible()
  await expect(page.getByText('Suspicious shell')).toBeVisible()
  await expect(page.getByText('node-a')).toBeVisible()
})
