import { openLoggedIn, closeAndSave, waitReady } from "./lib.mjs";

const t0 = Date.now();
const mark = (label) => console.log(`t=${((Date.now() - t0) / 1000).toFixed(1)}s ${label}`);

const { browser, context, page } = await openLoggedIn("raw/seg02-dashboard-console");
await waitReady(page);
mark("post-login-ready");

// Command Center dashboard: hold on hero + launchpad
await page.mouse.move(700, 300);
await page.waitForTimeout(2500);
mark("hero-hold-done");
await page.mouse.wheel(0, 350);
await page.waitForTimeout(2000);
mark("launchpad-hold-done");
await page.mouse.wheel(0, 350);
await page.waitForTimeout(1500);
mark("hosts-hold-done");

// Open the demo-cinema VM's Command Center (live console) panel
const card = page.getByText("demo-cinema-jt", { exact: false }).first();
await card.click({ timeout: 10000 }).catch(() => {});
await page.waitForTimeout(3500);
mark("vm-panel-open");
await page.waitForTimeout(2500);
mark("serial-console-hold-done");

await closeAndSave(browser, context);
console.log("seg02-dashboard-console done");
