/**
 * PriorityBadge discoverability shots: 1440 hover + 390 rest, light/dark.
 */
import { chromium, devices } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:3200'
const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts/priority-badge'
const PREVIEW = process.env.PREVIEW_DIR || '/workspace/preview/shots/priority-badge'

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
  {
    id: 'pb4',
    text: 'check on my brother',
    category: 'Personal',
    priority: null,
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

async function measureBadge(page) {
  return page.evaluate(() => {
    const badge = document.querySelector('[data-aio-priority-badge]')
    if (!badge) return null
    const chevron = badge.querySelector('[class*="chevron"]')
    const r = badge.getBoundingClientRect()
    const cs = getComputedStyle(badge)
    const ch = chevron ? getComputedStyle(chevron) : null
    return {
      title: badge.getAttribute('title'),
      aria: badge.getAttribute('aria-label'),
      width: +r.width.toFixed(1),
      cursor: cs.cursor,
      boxShadow: cs.boxShadow,
      chevronOpacity: ch ? parseFloat(ch.opacity) : null,
      emptyTitle: document.querySelector('[aria-label="Add urgency"]')?.getAttribute('title') || null,
    }
  })
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  mkdirSync(PREVIEW, { recursive: true })
  const dirs = [OUT, PREVIEW]
  const report = {}

  const browser = await chromium.launch({ headless: true })

  for (const theme of ['light', 'dark']) {
    // 1440 hover
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      })
      const page = await context.newPage()
      await seed(page)
      await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 })
      await setTheme(page, theme)
      await page.reload({ waitUntil: 'networkidle' })
      await setTheme(page, theme)
      await page.waitForSelector('[data-aio-priority-badge]', { timeout: 15000 })
      await page.waitForTimeout(200)

      const badge = page.locator('[data-aio-priority-badge]').first()
      const before = await measureBadge(page)
      await badge.hover()
      await page.waitForTimeout(200)
      const after = await measureBadge(page)
      report[`1440-${theme}-hover`] = { before, after }
      await shot(page, dirs, `1440-${theme}-hover`)
      await context.close()
    }

    // 390 rest (touch-ish: hover none via iPhone emulation)
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
      await seed(page)
      await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 })
      await setTheme(page, theme)
      await page.reload({ waitUntil: 'networkidle' })
      await setTheme(page, theme)
      await page.waitForSelector('[data-aio-priority-badge]', { timeout: 15000 })
      await page.waitForTimeout(200)
      const rest = await measureBadge(page)
      // Confirm hover:none media matches
      const touchMedia = await page.evaluate(() => window.matchMedia('(hover: none)').matches)
      report[`390-${theme}-rest`] = { rest, touchMedia }
      await shot(page, dirs, `390-${theme}-rest`)
      await context.close()
    }
  }

  await browser.close()

  writeFileSync(join(OUT, 'measure.json'), JSON.stringify(report, null, 2))
  writeFileSync(join(PREVIEW, 'measure.json'), JSON.stringify(report, null, 2))

  const rows = Object.entries(report).map(([k, v]) => {
    const m = v.after || v.rest
    return {
      shot: k,
      title: m?.title,
      aria: m?.aria,
      width: m?.width,
      cursor: m?.cursor,
      chevronOpacity: m?.chevronOpacity,
      hasInsetRing: m?.boxShadow?.includes('inset') && !m?.boxShadow?.includes('rgba(0, 0, 0, 0)') && m?.boxShadow !== 'none',
      boxShadow: m?.boxShadow,
      emptyTitle: m?.emptyTitle ?? v.after?.emptyTitle ?? v.before?.emptyTitle,
      touchMedia: v.touchMedia ?? false,
      widthJump: v.before && v.after ? Math.abs(v.after.width - v.before.width) : 0,
    }
  })

  const cols = ['shot', 'title', 'chevronOpacity', 'width', 'widthJump', 'cursor', 'hasInsetRing', 'emptyTitle', 'touchMedia']
  const md = [
    `| ${cols.join(' | ')} |`,
    `| ${cols.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${cols.map((c) => r[c] ?? '').join(' | ')} |`),
    '',
  ].join('\n')
  writeFileSync(join(OUT, 'measurements.md'), md)
  writeFileSync(join(PREVIEW, 'measurements.md'), md)
  console.log(md)
  console.log('Artifacts:', OUT)

  const failures = []
  for (const r of rows) {
    if (r.title !== 'Change urgency') failures.push(`${r.shot} title=${r.title}`)
    if (r.cursor !== 'pointer') failures.push(`${r.shot} cursor=${r.cursor}`)
    if (r.emptyTitle !== 'Add urgency') failures.push(`${r.shot} emptyTitle=${r.emptyTitle}`)
    if (r.shot.includes('1440')) {
      if (!(r.chevronOpacity >= 0.9)) failures.push(`${r.shot} chevronOpacity=${r.chevronOpacity}`)
      if (r.widthJump > 1) failures.push(`${r.shot} widthJump=${r.widthJump}`)
      if (!r.hasInsetRing && !(r.boxShadow || '').includes('inset')) {
        failures.push(`${r.shot} missingInsetRing boxShadow=${r.boxShadow}`)
      }
    }
    if (r.shot.includes('390')) {
      if (!(r.chevronOpacity > 0.2 && r.chevronOpacity < 0.8)) {
        failures.push(`${r.shot} touchChevronOpacity=${r.chevronOpacity}`)
      }
      if (!r.touchMedia) failures.push(`${r.shot} hoverNoneNotMatched`)
    }
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
