import { chromium } from "playwright";

export const BASE = process.env.MACH_URL || "https://80.79.5.173:5092";
export const USER = process.env.MACH_USER || "sus";
export const PASS = process.env.MACH_PASS || "max";

export async function openLoggedIn(videoDir, { skipLogin = true } = {}) {
  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  if (skipLogin) {
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.fill("#login-username", USER);
    await page.fill("#login-password", PASS);
    await page.click('button:has-text("Sign in")');
    await page.waitForTimeout(5000);
    for (let i = 0; i < 5; i++) {
      const onClassic = await page.getByText("Back to Platform").count();
      if (onClassic > 0) {
        await page.getByText("Back to Platform").first().click();
        await page.waitForTimeout(3000);
      } else break;
    }
  }
  return { browser, context, page };
}

export async function waitReady(page, timeout = 15000) {
  await page.waitForFunction(
    () => !/scanning fleet|loading/i.test(document.body.innerText) && document.body.innerText.trim().length > 100,
    { timeout }
  ).catch(() => {});
}

export async function closeAndSave(browser, context) {
  const page = context.pages()[0];
  await page.close();
  await context.close();
  await browser.close();
}
