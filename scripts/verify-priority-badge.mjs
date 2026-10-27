/**
 * PriorityBadge discoverability shots:
 * 1440 hover × each urgency × light/dark; 390 rest × light/dark.
 */
import { chromium, devices } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:3200'
const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts/priority-badge'
const PREVIEW = process.env.PREVIEW_DIR || '/workspace/preview/shots/priority-badge'

const URGENCIES = ['urgent', 'soon', 'eventually']

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

async function measureBadge(locator) {
  return locator.evaluate((badge) => {
    const label = badge.querySelector('[class*="label"]')
    const chevron = badge.querySelector('[class*="chevron"]')
    const r = badge.getBoundingClientRect()
    const cs = getComputedStyle(badge)
    const ls = label ? getComputedStyle(label) : null
    const ch = chevron ? getComputedStyle(chevron) : null
    return {
      text: label?.textContent || null,
      title: badge.getAttribute('title'),
      width: +r.width.toFixed(1),
      cursor: cs.cursor,
      color: cs.color,
      labelColor: ls?.color || null,
      labelOpacity: ls ? parseFloat(ls.opacity) : null,
      boxShadow: cs.boxShadow,
      chevronOpacity: ch ? parseFloat(ch.opacity) : null,
    }
  })
}

function parseRgb(str) {
  if (!str) return null
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return null
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]
}

function colorsEqual(a, b) {
  const A = parseRgb(a)
  const B = parseRgb(b)
  if (!A || !B) return a === b
  return A[0] === B[0] && A[1] === B[1] && A[2] === B[2]
}

/** Ring uses currentColor at ~35–45% alpha (color-mix). */
function ringAlphaOk(boxShadow, labelColor) {
  if (!boxShadow || !boxShadow.includes('inset')) return false
  // Chromium may report color-mix as color(srgb r g b / a) or rgba(...)
  const srgb = boxShadow.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\/\s*([\d.]+)\)/)
  if (srgb) {
    const alpha = parseFloat(srgb[4])
    if (!(alpha >= 0.35 && alpha <= 0.45)) return false
    const ringRgb = `rgb(${Math.round(parseFloat(srgb[1]) * 255)}, ${Math.round(parseFloat(srgb[2]) * 255)}, ${Math.round(parseFloat(srgb[3]) * 255)})`
    return colorsEqual(ringRgb, labelColor)
  }
  const m = boxShadow.match(/rgba?\(([^)]+)\)/)
  if (!m) return false
  const parts = m[1].split(',').map((s) => s.trim())
  if (parts.length < 4) return false
  const alpha = parseFloat(parts[3])
  if (!(alpha >= 0.35 && alpha <= 0.45)) return false
  const ringRgb = `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`
  return colorsEqual(ringRgb, labelColor)
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  mkdirSync(PREVIEW, { recursive: true })
  const dirs = [OUT, PREVIEW]
  const report = {}
  const rows = []

  const browser = await chromium.launch({ headless: true })

  for (const theme of ['light', 'dark']) {
    // 1440 — hover each urgency
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

      for (const urgency of URGENCIES) {
        const badge = page.locator('[data-aio-priority-badge]', { hasText: urgency }).first()
        await badge.scrollIntoViewIfNeeded()
        await page.waitForTimeout(120)
        const before = await measureBadge(badge)
        await badge.hover()
        await page.waitForTimeout(200)
        const after = await measureBadge(badge)
        const key = `1440-${theme}-hover-${urgency}`
        report[key] = { before, after }
        await shot(page, dirs, key)

        // Move pointer away so the next badge starts from rest
        await page.mouse.move(8, 8)
        await page.waitForTimeout(120)

        rows.push({
          shot: key,
          labelColorBefore: before.labelColor,
          labelColorAfter: after.labelColor,
          labelStable: colorsEqual(before.labelColor, after.labelColor) && before.labelOpacity === 1 && after.labelOpacity === 1,
          ringOk: ringAlphaOk(after.boxShadow, after.labelColor),
          boxShadow: after.boxShadow,
          chevronOpacity: after.chevronOpacity,
          widthJump: Math.abs(after.width - before.width),
          cursor: after.cursor,
          title: after.title,
        })
      }
      await context.close()
    }

    // 390 rest
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
      const badge = page.locator('[data-aio-priority-badge]').first()
      await badge.scrollIntoViewIfNeeded()
      await page.waitForTimeout(200)
      const rest = await measureBadge(badge)
      const touchMedia = await page.evaluate(() => window.matchMedia('(hover: none)').matches)
      const key = `390-${theme}-rest`
      report[key] = { rest, touchMedia }
      await shot(page, dirs, key)
      rows.push({
        shot: key,
        labelColorBefore: rest.labelColor,
        labelColorAfter: rest.labelColor,
        labelStable: rest.labelOpacity === 1,
        ringOk: true, // rest has no ring
        boxShadow: rest.boxShadow,
        chevronOpacity: rest.chevronOpacity,
        widthJump: 0,
        cursor: rest.cursor,
        title: rest.title,
        touchMedia,
      })
      await context.close()
    }
  }

  await browser.close()

  writeFileSync(join(OUT, 'measure.json'), JSON.stringify(report, null, 2))
  writeFileSync(join(PREVIEW, 'measure.json'), JSON.stringify(report, null, 2))

  const cols = [
    'shot', 'labelStable', 'labelColorAfter', 'ringOk', 'chevronOpacity',
    'widthJump', 'cursor', 'title',
  ]
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
    if (!r.labelStable) failures.push(`${r.shot} labelUnstable ${r.labelColorBefore}→${r.labelColorAfter}`)
    if (r.cursor !== 'pointer') failures.push(`${r.shot} cursor=${r.cursor}`)
    if (r.title !== 'Change urgency') failures.push(`${r.shot} title=${r.title}`)
    if (r.shot.includes('1440')) {
      if (!r.ringOk) failures.push(`${r.shot} ringBad shadow=${r.boxShadow}`)
      if (!(r.chevronOpacity >= 0.9)) failures.push(`${r.shot} chevron=${r.chevronOpacity}`)
      if (r.widthJump > 1) failures.push(`${r.shot} widthJump=${r.widthJump}`)
    }
    if (r.shot.includes('390')) {
      if (!(r.chevronOpacity > 0.2 && r.chevronOpacity < 0.8)) {
        failures.push(`${r.shot} touchChevron=${r.chevronOpacity}`)
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
