// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('vm detail shows daily access strip with connect copy ports export', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/vms/v1')
  await expect(page.getByRole('heading', { name: 'vm-1' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Daily access' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Spec', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'XML', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'VNC' }).first()).toBeVisible()
})

test('vm detail shows lifecycle power actions and SSH when guest IP present', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/vms/v1')
  await expect(page.getByRole('heading', { name: 'vm-1' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Shutdown' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Force stop' })).toBeVisible()
  await expect(page.getByText('ubuntu@192.168.122.50').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'SSH', exact: true }).first()).toBeVisible()
})

test('create vm wizard accepts SSH public key import', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/vms?create=test-vm')
  await expect(page.getByRole('heading', { name: 'Create Virtual Machine' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /Advanced/ }).click()
  await expect(page.getByText('matching private key')).toBeVisible()
  const pubkey = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI test@e2e'
  await page.getByPlaceholder('ssh-ed25519 AAAA').fill(pubkey)
  await expect(page.getByPlaceholder('ssh-ed25519 AAAA')).toHaveValue(pubkey)
})
