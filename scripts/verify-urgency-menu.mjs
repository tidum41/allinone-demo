/**
 * Urgency badge redesign: rest, menu open, mid-morph.
 * 1440 + 390 × light/dark.
 */
import { chromium, devices } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:3200'
const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts/urgency-menu'
const PREVIEW = process.env.PREVIEW_DIR || '/workspace/preview/shots/urgency-menu'

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
  const report = {}
  const browser = await chromium.launch({ headless: true })

  for (const theme of ['light', 'dark']) {
    // 1440
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      })
      const page = await context.newPage()
      await prepare(page, theme)

      const badge = page.locator('[data-aio-priority-badge]').first()
      await badge.scrollIntoViewIfNeeded()
      await page.waitForTimeout(200)

      const rest = await badge.evaluate((el) => ({
        label: el.querySelector('[data-aio-priority-label]')?.textContent,
        expanded: el.getAttribute('aria-expanded'),
        width: +el.getBoundingClientRect().width.toFixed(1),
      }))
      report[`1440-${theme}-rest`] = rest
      await shot(page, dirs, `1440-${theme}-rest`)

      await badge.click()
      await page.waitForSelector('[data-aio-popover-menu][data-menu="priority"]', { timeout: 5000 })
      await page.waitForTimeout(150)
      const menu = await page.evaluate(() => {
        const m = document.querySelector('[data-aio-popover-menu][data-menu="priority"]')
        if (!m) return null
        const cs = getComputedStyle(m)
        const items = [...m.querySelectorAll('[role="menuitemradio"]')].map((el) => ({
          text: el.textContent.trim(),
          checked: el.getAttribute('aria-checked') === 'true',
        }))
        return {
          radius: cs.borderRadius,
          padding: cs.padding,
          shadow: cs.boxShadow,
          itemMinH: m.querySelector('[role="menuitemradio"]')
            ? getComputedStyle(m.querySelector('[role="menuitemradio"]')).minHeight
            : null,
          items,
        }
      })
      report[`1440-${theme}-menu`] = menu
      await shot(page, dirs, `1440-${theme}-menu`)

      // Mid-morph: pick Eventually from Urgent
      const morphPromise = page.waitForFunction(
        () => document.querySelector('[data-aio-priority-morphing="true"]'),
        null,
        { timeout: 2000 }
      ).catch(() => null)
      await page.getByRole('menuitemradio', { name: 'Eventually' }).click()
      await morphPromise
      await page.waitForTimeout(40)
      const morphing = await page.evaluate(() => {
        const el = document.querySelector('[data-aio-priority-badge]')
        return {
          morphing: el?.getAttribute('data-aio-priority-morphing') === 'true',
          label: el?.querySelector('[data-aio-priority-label]')?.textContent,
          width: el ? +el.getBoundingClientRect().width.toFixed(1) : null,
          opacity: el?.querySelector('[data-aio-priority-label]')
            ? parseFloat(getComputedStyle(el.querySelector('[data-aio-priority-label]')).opacity)
            : null,
        }
      })
      report[`1440-${theme}-morph`] = morphing
      await shot(page, dirs, `1440-${theme}-morph`)
      await page.waitForTimeout(250)
      await context.close()
    }

    // 390
    {
      const iPhone = devices['iPhone 13']
      const context = await browser.newContext({
        ...iPhone,
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
      })
      const page = await context.newPage()
      await prepare(page, theme)
      const badge = page.locator('[data-aio-priority-badge]').first()
      await badge.scrollIntoViewIfNeeded()
      await page.waitForTimeout(200)
      await shot(page, dirs, `390-${theme}-rest`)

      await badge.tap()
      await page.waitForSelector('[data-aio-popover-menu][data-menu="priority"]', { timeout: 5000 })
      await page.waitForTimeout(150)
      const menuMobile = await page.evaluate(() => {
        const m = document.querySelector('[data-aio-popover-menu][data-menu="priority"]')
        return m ? {
          itemCount: m.querySelectorAll('[role="menuitemradio"]').length,
          tags: [...m.querySelectorAll('[role="menuitemradio"]')].map((el) => el.textContent.trim()),
        } : null
      })
      report[`390-${theme}-menu`] = menuMobile
      await shot(page, dirs, `390-${theme}-menu`)

      await page.getByRole('menuitemradio', { name: 'Soon' }).tap()
      await page.waitForTimeout(80)
      await shot(page, dirs, `390-${theme}-morph`)
      await context.close()
    }
  }

  await browser.close()
  writeFileSync(join(OUT, 'measure.json'), JSON.stringify(report, null, 2))
  writeFileSync(join(PREVIEW, 'measure.json'), JSON.stringify(report, null, 2))

  const lines = [
    '| shot | notes |',
    '| --- | --- |',
  ]
  for (const [k, v] of Object.entries(report)) {
    lines.push(`| ${k} | \`${JSON.stringify(v).slice(0, 120)}\` |`)
  }
  const md = `${lines.join('\n')}\n`
  writeFileSync(join(OUT, 'measurements.md'), md)
  writeFileSync(join(PREVIEW, 'measurements.md'), md)
  console.log(md)
  console.log('Artifacts:', OUT)

  const failures = []
  for (const theme of ['light', 'dark']) {
    const menu = report[`1440-${theme}-menu`]
    if (!menu) failures.push(`missing menu ${theme}`)
    else {
      if (menu.radius !== '10px') failures.push(`${theme} radius=${menu.radius}`)
      if (menu.itemMinH !== '36px') failures.push(`${theme} itemMinH=${menu.itemMinH}`)
      if (menu.items?.length !== 4) failures.push(`${theme} items=${menu.items?.length}`)
      const labels = menu.items?.map((i) => i.text) || []
      for (const want of ['Urgent', 'Soon', 'Eventually', 'No urgency']) {
        if (!labels.includes(want)) failures.push(`${theme} missing ${want}`)
      }
      if (!menu.items?.some((i) => i.checked)) failures.push(`${theme} none checked`)
    }
    const mob = report[`390-${theme}-menu`]
    if (mob?.itemCount !== 4) failures.push(`390-${theme} itemCount=${mob?.itemCount}`)
  }
  if (failures.length) {
    console.error('FAILURES:', failures.join('; '))
    process.exitCode = 2
  } else {
    console.log('All checks pass.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
