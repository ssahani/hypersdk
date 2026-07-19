import { chromium } from 'playwright'

const BASE = 'https://212.8.248.187:5092'
const OUT = '/private/tmp/claude-501/-Users-ssahani-tt-machina/40782bab-df15-4f61-b14c-03fc7d8a6d5f/scratchpad'

const browser = await chromium.launch()
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 } })
const page = await ctx.newPage()
page.on('console', (m) => { if (m.type() === 'error') console.log('  [browser error]', m.text().slice(0, 160)) })

console.log('1. login page')
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(2500)
await page.screenshot({ path: `${OUT}/01-login.png` })

// Fill whatever username/password fields the login shell renders.
const user = page.locator('input[name="username"], input[type="text"]').first()
const pass = page.locator('input[type="password"]').first()
await user.fill('sus')
await pass.fill('max')
await pass.press('Enter')
await page.waitForTimeout(6000)
console.log('2. after login →', page.url())
await page.screenshot({ path: `${OUT}/02-dashboard.png` })

console.log('3. content library')
await page.goto(`${BASE}/platform/content`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(4000)
await page.screenshot({ path: `${OUT}/03-content-library.png`, fullPage: true })

console.log('4. open Upload sheet')
const uploadBtn = page.getByRole('button', { name: /upload/i }).first()
if (await uploadBtn.count()) {
  await uploadBtn.click()
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/04-upload-sheet.png` })
  console.log('   sheet opened')

  // Show the file-picker mode explicitly (it is the default tab).
  const filePill = page.getByRole('button', { name: /upload from this computer/i }).first()
  if (await filePill.count()) {
    await filePill.click()
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}/05-upload-file-mode.png` })
    console.log('   file mode shown')
  } else {
    console.log('   !! file-mode pill NOT found')
  }
} else {
  console.log('   !! Upload button NOT found')
}

console.log('5. create-from-ISO wizard')
await page.goto(`${BASE}/platform/create-iso`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(4000)
await page.screenshot({ path: `${OUT}/06-create-from-iso.png`, fullPage: true })

await browser.close()
console.log('done')
