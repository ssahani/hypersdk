import { openLoggedIn, closeAndSave, waitReady } from "./lib.mjs";

const t0 = Date.now();
const mark = (label) => console.log(`t=${((Date.now() - t0) / 1000).toFixed(1)}s ${label}`);

const { browser, context, page } = await openLoggedIn("raw/seg03-cinema-wall");
await waitReady(page);
mark("post-login-ready");

await page.getByText("demo-cinema-jt", { exact: false }).first().click({ timeout: 10000 }).catch(() => {});
await page.waitForTimeout(3000);
mark("vm-panel-open");

const openCinemaCount = await page.getByText("Open Cinema").count();
if (openCinemaCount > 0) {
  await page.getByText("Open Cinema").last().click();
  await page.waitForTimeout(3000);
  mark("cinema-nav-done");
  // Wake the console canvas/terminal so it paints, matching the established pattern
  // for VNC/serial consoles that stay blank until focused.
  const canvas = page.locator("canvas").first();
  if (await canvas.count().then((c) => c > 0).catch(() => false)) {
    const box = await canvas.boundingBox().catch(() => null);
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(400);
      await page.keyboard.press("Enter").catch(() => {});
    }
  } else {
    await page.mouse.click(1150, 850);
  }
  await page.waitForTimeout(2500);
  mark("cinema-woken");
  await page.waitForTimeout(2500);
  mark("cinema-hold-done");
}

// Live Preview Wall — fleet grid
await page.getByText("Live Preview Wall", { exact: true }).first().click({ timeout: 8000 }).catch(() => {});
await waitReady(page);
mark("wall-ready");
await page.waitForTimeout(3000);
mark("wall-hold-done");

await closeAndSave(browser, context);
console.log("seg03-cinema-wall done");
