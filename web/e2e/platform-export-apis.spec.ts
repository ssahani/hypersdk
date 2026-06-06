// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { test, expect } from '@playwright/test'
import { mockPlatformApi } from './platformMock'

test('reports tab exposes AI export URL links', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/reports')
  await expect(page.getByText('Machina Compliance')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('reports-compliance-export-url').first()).toHaveAttribute('href', /\/ai\/compliance\/export/)
  await expect(page.getByTestId('reports-cost-export-url')).toHaveAttribute('href', /\/ai\/cost\/export\.csv/)
  await expect(page.getByTestId('reports-capacity-export-url')).toHaveAttribute('href', /\/ai\/capacity\/export\.csv/)
})

test('create VM shows libvirt templates, cloud-init generate, and RHEL URL', async ({ page }) => {
  await mockPlatformApi(page)
  await page.goto('/create')
  await expect(page.getByTestId('libvirt-templates-panel')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('debian-12-small')).toBeVisible()
  await page.getByRole('button', { name: 'Single-page form' }).click()
  await page.getByText('Automatic OS install').click()
  await page.locator('#os-preset').selectOption({ label: /AlmaLinux 9/ })
  await page.locator('input[placeholder="offline access token"]').fill('e2e-token')
  await page.getByTestId('rhel-image-url').click()
  await expect(page.getByTestId('rhel-image-result')).toContainText('access.redhat.com', { timeout: 10_000 })
  await page.locator('#vm-name').fill('e2e-vm')
  await page.getByPlaceholder('ubuntu').fill('ubuntu')
  await page.getByTestId('cloud-init-generate').click()
  await expect(page.getByText('Seed ISO: /var/lib/libvirt/images/seed-e2e.iso')).toBeVisible({ timeout: 10_000 })
})

test('fleet page loads prometheus scrape targets', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/fleet')
  await expect(page.getByTestId('fleet-prometheus-targets-load')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('fleet-prometheus-targets-load').click()
  await expect(page.getByTestId('fleet-prometheus-targets')).toContainText('1 scrape config', { timeout: 10_000 })
})

test('SOC playbooks reload from API', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'advanced' })
  await page.goto('/platform/soc')
  await page.getByRole('button', { name: 'Playbooks' }).click({ force: true })
  await expect(page.getByRole('button', { name: /notify_on_critical/ })).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('soc-playbook-reload').click()
  await expect(page.getByText('Reloaded notify_on_critical')).toBeVisible({ timeout: 10_000 })
})

test('migration hypersdk POST proxy', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'advanced' })
  await page.goto('/platform/migration')
  await expect(page.getByText('HyperSDK is connected')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('HyperSDK proxy explorer')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('hypersdk-proxy-post').click()
  await expect(page.getByText('POST proxy OK')).toBeVisible({ timeout: 10_000 })
})

test('disk images kubevirt POST bundle rebuild', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/disk-images')
  await expect(page.getByText('ubuntu.qcow2', { exact: true }).first()).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'KubeVirt' }).click({ force: true })
  await expect(page.getByText('Upload qcow2 to Kubernetes')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('kubevirt-post-bundle').click()
  await expect(page.getByText('Bundle rebuilt via POST')).toBeVisible({ timeout: 10_000 })
})

test('platform settings saves controller config', async ({ page }) => {
  await mockPlatformApi(page, { tier: 'power' })
  await page.goto('/platform/settings')
  await expect(page.getByText('Controller connection')).toBeVisible({ timeout: 15_000 })
  await page.getByPlaceholder('http://127.0.0.1:5093').fill('http://127.0.0.1:5093')
  await page.getByTestId('controller-config-save').click()
  await expect(page.getByText('Controller connection saved locally')).toBeVisible({ timeout: 10_000 })
})
