/**
 * aio-r7 verification: screenshots + ruler overlays + measurement table.
 * Viewports 1440 and 390, light and dark.
 * States: main, categories open, row menu open, delete confirm.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:3200'
const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts/aio-r7'
const PREVIEW = process.env.PREVIEW_DIR || '/workspace/preview/shots/aio-r7'

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
]
const THEMES = ['light', 'dark']

function round1(n) {
  return Math.round(n * 10) / 10
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    localStorage.setItem('theme', t)
    document.documentElement.setAttribute('data-theme', t)
    document.documentElement.style.colorScheme = t
  }, theme)
}

async function measureMain(page) {
  return page.evaluate(() => {
    const box = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        x: +r.left.toFixed(1),
        y: +r.top.toFixed(1),
        w: +r.width.toFixed(1),
        h: +r.height.toFixed(1),
        cx: +(r.left + r.width / 2).toFixed(1),
        cy: +(r.top + r.height / 2).toFixed(1),
      }
    }
    const checkbox = document.querySelector('[data-aio-checkbox]')
    const sidebarSvg = document.querySelector('[data-aio-sidebar-toggle] svg')
    const title = document.querySelector('[data-aio-title]')
    const taskText = checkbox?.parentElement?.querySelector('[contenteditable], .text, textarea')
      || document.querySelector('[contenteditable]')
    // For blob lines: text is sibling of checkbox
    const line = checkbox?.closest('[class*="line"]')
    const lineText = line?.querySelector('[contenteditable]')
    return {
      checkbox: box(checkbox),
      sidebarIcon: box(sidebarSvg),
      title: box(title),
      taskText: box(lineText || taskText),
      categoriesBtn: box(document.querySelector('[data-aio-categories]')),
      sortBtn: box(document.querySelector('[data-aio-sort]')),
    }
  })
}

async function measureCategories(page) {
  return page.evaluate(() => {
    const box = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        x: +r.left.toFixed(1),
        y: +r.top.toFixed(1),
        w: +r.width.toFixed(1),
        h: +r.height.toFixed(1),
        cx: +(r.left + r.width / 2).toFixed(1),
        cy: +(r.top + r.height / 2).toFixed(1),
      }
    }
    const row = document.querySelector('[data-aio-cat-row]')
    const dot = row?.querySelector('[data-aio-cat-dot]')
    const name = row?.querySelector('[data-aio-cat-name]')
    const more = row?.querySelector('[data-aio-cat-more]')
    const moreIcon = more?.querySelector('svg') || more
    const panel = document.querySelector('[role="dialog"][aria-label="Categories"]')
    return {
      panel: box(panel),
      row: box(row),
      dot: box(dot),
      name: box(name),
      more: box(more),
      moreIcon: box(moreIcon),
      nameMidY: name ? +(name.getBoundingClientRect().top + name.getBoundingClientRect().height / 2).toFixed(1) : null,
      dotCy: dot ? +(dot.getBoundingClientRect().top + dot.getBoundingClientRect().height / 2).toFixed(1) : null,
      moreCy: moreIcon ? +(moreIcon.getBoundingClientRect().top + moreIcon.getBoundingClientRect().height / 2).toFixed(1) : null,
    }
  })
}

async function drawRulers(page, lines, label) {
  await page.evaluate(({ lines, label }) => {
    document.querySelectorAll('[data-aio-ruler]').forEach((n) => n.remove())
    const root = document.createElement('div')
    root.setAttribute('data-aio-ruler', label || '1')
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999;'
    for (const line of lines) {
      const el = document.createElement('div')
      if (line.orient === 'v') {
        el.style.cssText = `position:absolute;top:0;bottom:0;left:${line.at}px;width:1px;background:${line.color || 'rgba(255,0,0,0.85)'};`
      } else {
        el.style.cssText = `position:absolute;left:0;right:0;top:${line.at}px;height:1px;background:${line.color || 'rgba(0,120,255,0.85)'};`
      }
      root.appendChild(el)
    }
    const tag = document.createElement('div')
    tag.textContent = label || ''
    tag.style.cssText = 'position:absolute;top:4px;left:4px;padding:2px 6px;background:rgba(0,0,0,0.7);color:#fff;font:11px/1.2 monospace;'
    root.appendChild(tag)
    document.body.appendChild(root)
  }, { lines, label })
}

async function clearRulers(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[data-aio-ruler]').forEach((n) => n.remove())
  })
}

async function shot(page, dirs, name) {
  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true })
    await page.screenshot({ path: join(dir, `${name}.png`), fullPage: false })
  }
}

async function waitReady(page) {
  await page.waitForSelector('[data-aio-sidebar-toggle]', { timeout: 20000 })
  await page.waitForSelector('[data-aio-checkbox]', { timeout: 20000 })
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  mkdirSync(PREVIEW, { recursive: true })
  const dirs = [OUT, PREVIEW]
  const report = {}

  const browser = await chromium.launch({ headless: true })

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      const key = `${vp.name}-${theme}`
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
      })
      const page = await context.newPage()
      await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 })
      await setTheme(page, theme)
      await page.reload({ waitUntil: 'networkidle' })
      await setTheme(page, theme)
      await waitReady(page)
      await page.waitForTimeout(300)

      const mainM = await measureMain(page)
      report[key] = { main: mainM }

      await shot(page, dirs, `${key}-1-main`)

      // Ruler overlay for main alignment
      const lines = []
      if (mainM.checkbox) lines.push({ orient: 'v', at: mainM.checkbox.x, color: 'rgba(255,0,0,0.9)' })
      if (mainM.sidebarIcon) lines.push({ orient: 'v', at: mainM.sidebarIcon.x, color: 'rgba(0,180,80,0.9)' })
      if (mainM.taskText) lines.push({ orient: 'v', at: mainM.taskText.x, color: 'rgba(0,100,255,0.9)' })
      if (mainM.title) lines.push({ orient: 'v', at: mainM.title.x, color: 'rgba(180,0,255,0.9)' })
      await drawRulers(page, lines, `${key} main: red=check L green=icon L blue=task L purple=title L`)
      await shot(page, dirs, `${key}-1-main-rulers`)
      await clearRulers(page)

      // Open categories
      await page.click('[data-aio-categories]')
      await page.waitForSelector('[role="dialog"][aria-label="Categories"]', { timeout: 10000 })
      await page.waitForTimeout(250)
      const catM = await measureCategories(page)
      report[key].categories = catM
      await shot(page, dirs, `${key}-2-categories`)

      const catLines = []
      if (catM.dot) {
        catLines.push({ orient: 'v', at: catM.dot.cx, color: 'rgba(255,140,0,0.95)' })
        catLines.push({ orient: 'h', at: catM.dot.cy, color: 'rgba(255,140,0,0.7)' })
      }
      if (catM.name) {
        catLines.push({ orient: 'v', at: catM.name.x, color: 'rgba(0,100,255,0.9)' })
        catLines.push({ orient: 'h', at: catM.nameMidY, color: 'rgba(0,100,255,0.7)' })
      }
      if (catM.more) {
        catLines.push({ orient: 'h', at: catM.moreCy, color: 'rgba(0,180,80,0.7)' })
      }
      await drawRulers(page, catLines, `${key} cats: orange=dot centre, blue=name L/mid, green=more mid`)
      await shot(page, dirs, `${key}-2-categories-rulers`)
      await clearRulers(page)

      // Row menu
      await page.click('[data-aio-cat-more]')
      await page.waitForSelector('[role="menu"]', { timeout: 5000 })
      await page.waitForTimeout(150)
      await shot(page, dirs, `${key}-3-row-menu`)

      // Delete confirm
      await page.getByRole('menuitem', { name: 'Delete' }).click()
      await page.waitForSelector('[role="dialog"][aria-label="Delete category"]', { timeout: 5000 })
      await page.waitForTimeout(150)
      const confirmText = await page.locator('[role="dialog"][aria-label="Delete category"] p').innerText()
      const deleteColor = await page.evaluate(() => {
        const btn = document.querySelector('[role="dialog"][aria-label="Delete category"] button:last-child')
        return btn ? getComputedStyle(btn).color : null
      })
      report[key].confirm = { text: confirmText, deleteColor }
      await shot(page, dirs, `${key}-4-delete-confirm`)

      // Align deltas
      const iconDelta = mainM.checkbox && mainM.sidebarIcon
        ? round1(mainM.sidebarIcon.x - mainM.checkbox.x)
        : null
      const titleDelta = mainM.taskText && mainM.title
        ? round1(mainM.title.x - mainM.taskText.x)
        : null
      const dotNameDelta = catM.dotCy != null && catM.nameMidY != null
        ? round1(catM.dotCy - catM.nameMidY)
        : null
      const moreNameDelta = catM.moreCy != null && catM.nameMidY != null
        ? round1(catM.moreCy - catM.nameMidY)
        : null
      report[key].deltas = {
        sidebarIconVsCheckboxLeft: iconDelta,
        titleVsTaskTextLeft: titleDelta,
        dotCentreVsNameMidY: dotNameDelta,
        moreCentreVsNameMidY: moreNameDelta,
      }

      await context.close()
    }
  }

  await browser.close()

  const table = []
  for (const [key, data] of Object.entries(report)) {
    table.push({
      viewport: key,
      checkboxLeft: data.main?.checkbox?.x,
      sidebarIconLeft: data.main?.sidebarIcon?.x,
      taskTextLeft: data.main?.taskText?.x,
      titleLeft: data.main?.title?.x,
      iconVsCheck: data.deltas?.sidebarIconVsCheckboxLeft,
      titleVsTask: data.deltas?.titleVsTaskTextLeft,
      catDotCy: data.categories?.dotCy,
      catNameMidY: data.categories?.nameMidY,
      catMoreCy: data.categories?.moreCy,
      dotVsName: data.deltas?.dotCentreVsNameMidY,
      moreVsName: data.deltas?.moreCentreVsNameMidY,
      confirmText: data.confirm?.text,
      deleteColor: data.confirm?.deleteColor,
    })
  }

  writeFileSync(join(OUT, 'measure.json'), JSON.stringify(report, null, 2))
  writeFileSync(join(PREVIEW, 'measure.json'), JSON.stringify(report, null, 2))
  writeFileSync(join(OUT, 'measurements.md'), markdownTable(table))
  writeFileSync(join(PREVIEW, 'measurements.md'), markdownTable(table))
  console.log(markdownTable(table))
  console.log('\nArtifacts:', OUT)
  console.log('Preview:', PREVIEW)

  // Fail if any alignment delta exceeds 1px
  const failures = []
  for (const row of table) {
    for (const [k, v] of Object.entries({
      iconVsCheck: row.iconVsCheck,
      titleVsTask: row.titleVsTask,
      dotVsName: row.dotVsName,
      moreVsName: row.moreVsName,
    })) {
      if (typeof v === 'number' && Math.abs(v) > 1) {
        failures.push(`${row.viewport} ${k}=${v}`)
      }
    }
  }
  if (failures.length) {
    console.error('ALIGNMENT FAILURES (>1px):', failures.join('; '))
    process.exitCode = 2
  } else {
    console.log('All alignments within 1px.')
  }
}

function markdownTable(rows) {
  const cols = [
    'viewport', 'checkboxLeft', 'sidebarIconLeft', 'taskTextLeft', 'titleLeft',
    'iconVsCheck', 'titleVsTask', 'catDotCy', 'catNameMidY', 'dotVsName', 'moreVsName',
  ]
  const head = `| ${cols.join(' | ')} |`
  const sep = `| ${cols.map(() => '---').join(' | ')} |`
  const body = rows.map((r) => `| ${cols.map((c) => r[c] ?? '').join(' | ')} |`).join('\n')
  return `${head}\n${sep}\n${body}\n`
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
