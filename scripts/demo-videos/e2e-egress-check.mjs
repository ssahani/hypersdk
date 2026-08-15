#!/usr/bin/env node
/** One-off: create a libvirt sprite with network_egress via the real UI, for a host-side DHCP-lease check. */
import { openLoggedIn, closeAndSave, waitReady, BASE } from './lib.mjs';

const { browser, context, page } = await openLoggedIn('raw/_e2e-egress-check');
await waitReady(page);
await page.goto(`${BASE}/sprites`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await waitReady(page);
await page.waitForTimeout(1500);

await page.getByRole('button', { name: /New Sprite/i }).click();
await page.waitForTimeout(1000);
const dialog = page.locator('[role="dialog"]').last();
await dialog.locator('#sprite-golden-image').waitFor({ timeout: 15000 });
await dialog.locator('#sprite-golden-image').selectOption('ubuntu-test').catch(() => {});
await dialog.locator('#sprite-ttl').selectOption('900').catch(() => {});
await dialog.getByRole('checkbox').check();
await page.waitForTimeout(300);
await dialog.getByRole('button', { name: /^Create$/ }).click();
await dialog.waitFor({ state: 'detached', timeout: 30000 });
await page.waitForTimeout(1500);

const toastText = await page.locator('text=/Sprite .* booting/').first().textContent().catch(() => null);
const match = toastText?.match(/Sprite '([a-f0-9-]+)' booting/);
console.log(`SPRITE_ID=${match ? match[1] : 'UNKNOWN'}`);

await closeAndSave(browser, context);
