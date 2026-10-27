/**
 * Interaction audit shots: 1440/390 × light/dark
 * States: rest, hover (icon/badge), pressed, focus, menu open, check mid-frame.
 */
import { chromium, devices } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:3200'
const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts/interaction-audit'
const PREVIEW = process.env.PREVIEW_DIR || '/workspace/preview/shots/interaction-audit'

const SAMPLE_TASKS = [
  {
    id: 'pb1',
    text: 'read Norman chapter 3 before UX class tomorrow',
    category: 'School',
    priority: 'Urgent',
    dateAdded: new Date().toISOString(),
  },
  {
    id: 'pb2',
    text: 'add an about section and PS3 sounds to my portfolio site',
    category: 'Product design',
    priority: 'Soon',
    dateAdded: new Date().toISOString(),
  },
  {
    id: 'pb3',
    text: 'look for a standing desk',
    category: 'Home',
    priority: 'Eventually',
    dateAdded: new Date().toISOString(),
  },
]

async function seed(page) {
  await page.addInitScript((tasks) => {
    sessionStorage.setItem('demo:v11:tasks', JSON.stringify(tasks))
  }, SAMPLE_TASKS)
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    localStorage.setItem('theme', t)
    document.documentElement.setAttribute('data-theme', t)
    document.documentElement.style.colorScheme = t
  }, theme)
}

async function shot(page, dirs, name) {
  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true })
    await page.screenshot({ path: join(dir, `${name}.png`), fullPage: false })
  }
}

async function prepare(page, theme) {
  await seed(page)
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 })
  await setTheme(page, theme)
  await page.reload({ waitUntil: 'networkidle' })
  await setTheme(page, theme)
  await page.waitForSelector('[data-aio-priority-badge]', { timeout: 15000 })
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  mkdirSync(PREVIEW, { recursive: true })
  const dirs = [OUT, PREVIEW]
  const report = { tokens: null, shots: [] }
  const browser = await chromium.launch({ headless: true })

  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()
    await prepare(page, theme)

    report.tokens = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement)
      return {
        easeOut: s.getPropertyValue('--ease-out').trim(),
        durFast: s.getPropertyValue('--dur-fast').trim(),
        durBase: s.getPropertyValue('--dur-base').trim(),
        pressScale: s.getPropertyValue('--press-scale').trim(),
      }
    })

    const badge = page.locator('[data-aio-priority-badge]').first()
    await badge.scrollIntoViewIfNeeded()
    await page.waitForTimeout(200)
    await shot(page, dirs, `1440-${theme}-rest`)
    report.shots.push(`1440-${theme}-rest`)

    // Hover badge
    await badge.hover()
    await page.waitForTimeout(160)
    await shot(page, dirs, `1440-${theme}-hover-badge`)
    report.shots.push(`1440-${theme}-hover-badge`)

    // Pressed (mouse down only — avoid click toggle)
    const box = await badge.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.waitForTimeout(80)
      await shot(page, dirs, `1440-${theme}-pressed-badge`)
      report.shots.push(`1440-${theme}-pressed-badge`)
      await page.mouse.up()
      // mouseup may fire click and open the menu — close it
      await page.keyboard.press('Escape')
      await page.waitForTimeout(100)
      await page.evaluate(() => document.body.click())
      await page.waitForTimeout(80)
    }

    // Focus categories pill
    await page.locator('[data-aio-categories]').focus()
    await page.waitForTimeout(80)
    await shot(page, dirs, `1440-${theme}-focus-categories`)
    report.shots.push(`1440-${theme}-focus-categories`)

    // Menu open
    await page.keyboard.press('Escape')
    await page.waitForTimeout(60)
    await badge.click()
    await page.waitForSelector('[data-aio-popover-menu][data-menu="priority"]', { timeout: 5000 })
    await page.waitForTimeout(180)
    await shot(page, dirs, `1440-${theme}-menu-open`)
    report.shots.push(`1440-${theme}-menu-open`)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(100)

    // Check animation mid-frame — complete first sorted task
    const check = page.locator('.taskRow [data-aio-checkbox]').first()
    await check.scrollIntoViewIfNeeded()
    const mid = page.waitForFunction(
      () => {
        const row = document.querySelector('.taskRow[class*="completing"]')
        return !!row
      },
      null,
      { timeout: 3000 }
    ).catch(() => null)
    await check.click()
    await mid
    await page.waitForTimeout(50)
    await shot(page, dirs, `1440-${theme}-check-mid`)
    report.shots.push(`1440-${theme}-check-mid`)
    await context.close()

    // 390
    const iPhone = devices['iPhone 13']
    const mctx = await browser.newContext({
      ...iPhone,
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: true,
    })
    const mpage = await mctx.newPage()
    await prepare(mpage, theme)
    const mbadge = mpage.locator('[data-aio-priority-badge]').first()
    await mbadge.scrollIntoViewIfNeeded()
    await mpage.waitForTimeout(200)
    await shot(mpage, dirs, `390-${theme}-rest`)
    report.shots.push(`390-${theme}-rest`)
    await mbadge.tap()
    await mpage.waitForSelector('[data-aio-popover-menu][data-menu="priority"]', { timeout: 5000 })
    await mpage.waitForTimeout(180)
    await shot(mpage, dirs, `390-${theme}-menu-open`)
    report.shots.push(`390-${theme}-menu-open`)
    await mctx.close()
  }

  await browser.close()
  writeFileSync(join(OUT, 'measure.json'), JSON.stringify(report, null, 2))
  writeFileSync(join(PREVIEW, 'measure.json'), JSON.stringify(report, null, 2))
  const md = [
    '# Interaction audit shots',
    '',
    `Tokens: \`${JSON.stringify(report.tokens)}\``,
    '',
    ...report.shots.map((s) => `- ${s}.png`),
    '',
  ].join('\n')
  writeFileSync(join(OUT, 'shots.md'), md)
  writeFileSync(join(PREVIEW, 'shots.md'), md)
  console.log(md)
  console.log('Artifacts:', OUT)

  const t = report.tokens || {}
  const failures = []
  if (!t.easeOut) failures.push('missing --ease-out')
  if (t.durFast !== '150ms') failures.push(`durFast=${t.durFast}`)
  if (t.durBase !== '200ms') failures.push(`durBase=${t.durBase}`)
  if (t.pressScale !== '0.97') failures.push(`pressScale=${t.pressScale}`)
  if (failures.length) {
    console.error('FAILURES:', failures.join('; '))
    process.exitCode = 2
  } else {
    console.log('Token checks pass.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
