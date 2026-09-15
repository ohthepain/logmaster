import type { Page } from 'playwright'

/** NauticExpo sits behind Cloudflare; plain HTTP and default headless fail with 403. */
export const PLAYWRIGHT_LAUNCH_ARGS = [
  '--disable-blink-features=AutomationControlled',
] as const

export const PLAYWRIGHT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export async function applyStealthInitScript(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    })
  })
}

export async function waitForNauticExpoContent(page: Page): Promise<boolean> {
  await page.waitForLoadState('domcontentloaded')
  // Crawlee's Cloudflare helper waits 5s on 403; give the challenge time to resolve.
  await page.waitForTimeout(5_000)
  const ready = await page
    .waitForFunction(
      () => {
        const title = document.title.toLowerCase()
        if (title.includes('just a moment')) return false
        const body = document.body?.innerText ?? ''
        if (/performing security verification/i.test(body)) return false
        if (/enable javascript and cookies/i.test(body)) return false
        return true
      },
      { timeout: 60_000 },
    )
    .then(() => true)
    .catch(() => false)
  if (!ready) return false
  await page
    .waitForSelector('h1, a[href*="/prod/"], a[href*="/cat/"]', {
      timeout: 20_000,
    })
    .catch(() => undefined)
  return true
}
