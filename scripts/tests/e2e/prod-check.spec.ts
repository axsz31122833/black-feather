import { test, expect } from '@playwright/test'

const PROD_URL = process.env.PROD_URL || 'https://black-feather-mcuw7pqjw-feng-jias-projects.vercel.app'

test('Production Autocomplete shows suggestions for 台北', async ({ page }) => {
  await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' })
  const pickup = page.locator('#pickup-input')
  await pickup.waitFor({ state: 'visible', timeout: 20000 })
  await pickup.fill('台北')
  await page.waitForTimeout(1200)
  const pac = page.locator('.pac-container')
  await pac.waitFor({ state: 'visible', timeout: 20000 })
  await page.screenshot({ path: 'tests/e2e/artifacts/prod-autocomplete.png', fullPage: true })
})
