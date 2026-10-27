/**
 * aio-r7 verification: screenshots + ruler overlays + measurement table.
 * Viewports 1440, 1280 (desktop push rail), and 390 (mobile sheet).
 * States: closed main, categories open; light and dark.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:3200'
const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts/aio-r7'
const PREVIEW = process.env.PREVIEW_DIR || '/workspace/preview/shots/aio-r7'

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1280', width: 1280, height: 800 },
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
    const line = checkbox?.closest('[class*="line"]')
    const lineText = line?.querySelector('[contenteditable]')
    const pill = document.querySelector('[data-aio-categories]')
    return {
      checkbox: box(checkbox),
      sidebarIcon: box(sidebarSvg),
      title: box(title),
      titleText: title ? title.textContent : null,
      titleFullyVisible: title
        ? title.scrollWidth <= title.clientWidth + 1
        : null,
      taskText: box(lineText),
      categoriesBtn: box(pill),
      categoriesPressed: pill?.getAttribute('aria-pressed') === 'true',
      sortBtn: box(document.querySelector('[data-aio-sort]')),
      fabVisible: !!document.querySelector('[data-agentation-toolbar]')
        && getComputedStyle(document.querySelector('[data-agentation-toolbar]')).display !== 'none',
      mainPaneWidth: (() => {
        const p = document.querySelector('.mainPane')
        return p ? +p.getBoundingClientRect().width.toFixed(1) : null
      })(),
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
        right: +r.right.toFixed(1),
        cx: +(r.left + r.width / 2).toFixed(1),
        cy: +(r.top + r.height / 2).toFixed(1),
      }
    }
    const textLeft = (el) => {
      if (!el) return null
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        return +el.getBoundingClientRect().left.toFixed(1)
      }
      const range = document.createRange()
      range.selectNodeContents(el)
      const rects = range.getClientRects()
      if (rects.length) return +rects[0].left.toFixed(1)
      const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0
      return +(el.getBoundingClientRect().left + pad).toFixed(1)
    }
    const row = document.querySelector('[data-aio-cat-row]')
    const dot = row?.querySelector('[data-aio-cat-dot]')
    const name = row?.querySelector('[data-aio-cat-name]')
    const desc = row?.querySelector('[data-aio-cat-desc]')
    const more = row?.querySelector('[data-aio-cat-more]')
    const moreIcon = more?.querySelector('svg') || more
    const panel = document.querySelector('[role="dialog"][aria-label="Categories"]')
    const catTitle = document.querySelector('[data-aio-cat-title]')
    const purpose = document.querySelector('[data-aio-cat-purpose]')
    const add = document.querySelector('[data-aio-cat-add]')
    const addPlus = document.querySelector('[data-aio-cat-add-plus]')
    const addLabel = document.querySelector('[data-aio-cat-add-label]')
    const closeBtn = document.querySelector('[data-aio-cat-close]')
    const layout = panel?.getAttribute('data-aio-cat-layout')
      || document.querySelector('[data-aio-cat-layout]')?.getAttribute('data-aio-cat-layout')
    const fab = document.querySelector('[data-agentation-toolbar]')
    const fabHidden = !fab || getComputedStyle(fab).display === 'none' || getComputedStyle(fab).visibility === 'hidden'
    const titleX = textLeft(catTitle)
    const purposeX = textLeft(purpose)
    // Plus / dot use box left (glyph bearings would falsely offset '+')
    const addPlusX = addPlus ? +addPlus.getBoundingClientRect().left.toFixed(1) : null
    const addLabelX = textLeft(addLabel)
    const nameX = textLeft(name)
    const descX = textLeft(desc)
    const dotLeft = dot ? +dot.getBoundingClientRect().left.toFixed(1) : null
    const closeRight = closeBtn ? +closeBtn.getBoundingClientRect().right.toFixed(1) : null
    const moreRight = more ? +more.getBoundingClientRect().right.toFixed(1) : null
    return {
      panel: box(panel),
      layout,
      row: box(row),
      dot: box(dot),
      name: box(name),
      desc: box(desc),
      more: box(more),
      moreIcon: box(moreIcon),
      close: box(closeBtn),
      outer: {
        title: titleX,
        purpose: purposeX,
        dot: dotLeft,
        addPlus: addPlusX,
      },
      inner: {
        name: nameX,
        desc: descX,
        addLabel: addLabelX,
      },
      right: {
        close: closeRight,
        more: moreRight,
      },
      nameMidY: name ? +(name.getBoundingClientRect().top + name.getBoundingClientRect().height / 2).toFixed(1) : null,
      dotCy: dot ? +(dot.getBoundingClientRect().top + dot.getBoundingClientRect().height / 2).toFixed(1) : null,
      moreCy: moreIcon ? +(moreIcon.getBoundingClientRect().top + moreIcon.getBoundingClientRect().height / 2).toFixed(1) : null,
      hasClose: !!closeBtn,
      fabHidden,
      moreSize: more ? { w: +more.getBoundingClientRect().width.toFixed(1), h: +more.getBoundingClientRect().height.toFixed(1) } : null,
      mainPaneWidth: (() => {
        const p = document.querySelector('.mainPane')
        return p ? +p.getBoundingClientRect().width.toFixed(1) : null
      })(),
      checkbox: (() => {
        const el = document.querySelector('[data-aio-checkbox]')
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { x: +r.left.toFixed(1) }
      })(),
      taskText: (() => {
        const checkbox = document.querySelector('[data-aio-checkbox]')
        const line = checkbox?.closest('[class*="line"]')
        const lineText = line?.querySelector('[contenteditable]')
        if (!lineText) return null
        const r = lineText.getBoundingClientRect()
        return { x: +r.left.toFixed(1) }
      })(),
      pillPressed: document.querySelector('[data-aio-categories]')?.getAttribute('aria-pressed') === 'true',
      add: box(add),
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
    tag.style.cssText = 'position:absolute;top:4px;left:4px;padding:2px 6px;background:rgba(0,0,0,0.7);color:#fff;font:11px/1.2 monospace;max-width:90vw;'
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

      await shot(page, dirs, `${key}-1-closed`)

      const lines = []
      if (mainM.checkbox) lines.push({ orient: 'v', at: mainM.checkbox.x, color: 'rgba(255,0,0,0.9)' })
      if (mainM.sidebarIcon) lines.push({ orient: 'v', at: mainM.sidebarIcon.x, color: 'rgba(0,180,80,0.9)' })
      if (mainM.taskText) lines.push({ orient: 'v', at: mainM.taskText.x, color: 'rgba(0,100,255,0.9)' })
      if (mainM.title) lines.push({ orient: 'v', at: mainM.title.x, color: 'rgba(180,0,255,0.9)' })
      await drawRulers(page, lines, `${key} closed: red=check L green=icon L blue=task L purple=title L`)
      await shot(page, dirs, `${key}-1-closed-rulers`)
      await clearRulers(page)

      await page.click('[data-aio-categories]')
      await page.waitForSelector('[role="dialog"][aria-label="Categories"]', { timeout: 10000 })
      // Wait for 200ms rail slide + settle
      await page.waitForTimeout(280)
      const catM = await measureCategories(page)
      report[key].categories = catM
      await shot(page, dirs, `${key}-2-open`)

      const outerX = catM.outer?.title
      const innerX = catM.inner?.name
      const rightX = catM.right?.more
      const catLines = []
      if (outerX != null) catLines.push({ orient: 'v', at: outerX, color: 'rgba(255,0,0,0.95)' })
      if (innerX != null) catLines.push({ orient: 'v', at: innerX, color: 'rgba(0,100,255,0.95)' })
      if (rightX != null) catLines.push({ orient: 'v', at: rightX, color: 'rgba(0,180,80,0.95)' })
      await drawRulers(page, catLines, `${key} open: red=outer L, blue=inner name L, green=right action R`)
      await shot(page, dirs, `${key}-2-open-rulers`)
      await clearRulers(page)

      if (vp.name !== '390') {
        await page.click('[data-aio-cat-more]')
        await page.waitForSelector('[role="menu"]', { timeout: 5000 })
        await page.waitForTimeout(150)
        await shot(page, dirs, `${key}-3-row-menu`)

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
        await page.keyboard.press('Escape')
        await page.waitForTimeout(100)
      } else {
        await page.click('[data-aio-cat-more]')
        await page.waitForSelector('[role="menu"]', { timeout: 5000 })
        await page.waitForTimeout(150)
        await shot(page, dirs, `${key}-3-row-menu`)

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
      }

      const outerTarget = catM.outer?.title
      const outerDeltas = {}
      for (const [k, v] of Object.entries(catM.outer || {})) {
        outerDeltas[k] = typeof v === 'number' && typeof outerTarget === 'number'
          ? round1(v - outerTarget)
          : null
      }
      const innerTarget = catM.inner?.name
      const innerDeltas = {}
      for (const [k, v] of Object.entries(catM.inner || {})) {
        innerDeltas[k] = typeof v === 'number' && typeof innerTarget === 'number'
          ? round1(v - innerTarget)
          : null
      }
      const rightDelta = catM.right?.close != null && catM.right?.more != null
        ? round1(catM.right.close - catM.right.more)
        : null

      report[key].deltas = {
        sidebarIconVsCheckboxLeft: mainM.checkbox && mainM.sidebarIcon
          ? round1(mainM.sidebarIcon.x - mainM.checkbox.x) : null,
        titleVsTaskTextLeft: mainM.taskText && mainM.title
          ? round1(mainM.title.x - mainM.taskText.x) : null,
        dotCentreVsNameMidY: catM.dotCy != null && catM.nameMidY != null
          ? round1(catM.dotCy - catM.nameMidY) : null,
        moreCentreVsNameMidY: catM.moreCy != null && catM.nameMidY != null
          ? round1(catM.moreCy - catM.nameMidY) : null,
        outerDeltas,
        innerDeltas,
        rightDelta,
        outerEdge: outerTarget,
        innerEdge: innerTarget,
        rightEdge: catM.right?.more ?? null,
        panelWidth: catM.panel?.w ?? null,
        mainPaneShrink: mainM.mainPaneWidth != null && catM.mainPaneWidth != null
          ? round1(mainM.mainPaneWidth - catM.mainPaneWidth)
          : null,
      }

      await context.close()
    }
  }

  await browser.close()

  const table = []
  for (const [key, data] of Object.entries(report)) {
    const o = data.deltas?.outerDeltas || {}
    const i = data.deltas?.innerDeltas || {}
    table.push({
      viewport: key,
      layout: data.categories?.layout,
      outer: data.deltas?.outerEdge,
      dPurpose: o.purpose,
      dDot: o.dot,
      dAddPlus: o.addPlus,
      inner: data.deltas?.innerEdge,
      dDesc: i.desc,
      dAddLabel: i.addLabel,
      right: data.deltas?.rightEdge,
      dCloseVsMore: data.deltas?.rightDelta,
      hasClose: data.categories?.hasClose,
      pillPressed: data.categories?.pillPressed,
      fabHidden: data.categories?.fabHidden,
      panelW: data.deltas?.panelWidth,
    })
  }

  writeFileSync(join(OUT, 'measure.json'), JSON.stringify(report, null, 2))
  writeFileSync(join(PREVIEW, 'measure.json'), JSON.stringify(report, null, 2))
  writeFileSync(join(OUT, 'measurements.md'), markdownTable(table))
  writeFileSync(join(PREVIEW, 'measurements.md'), markdownTable(table))
  console.log(markdownTable(table))
  console.log('\nArtifacts:', OUT)

  const failures = []
  for (const row of table) {
    for (const [k, v] of Object.entries({
      dPurpose: row.dPurpose,
      dDot: row.dDot,
      dAddPlus: row.dAddPlus,
      dDesc: row.dDesc,
      dAddLabel: row.dAddLabel,
      dCloseVsMore: row.dCloseVsMore,
      dotVsNameY: report[row.viewport]?.deltas?.dotCentreVsNameMidY,
      moreVsNameY: report[row.viewport]?.deltas?.moreCentreVsNameMidY,
    })) {
      if (typeof v === 'number' && Math.abs(v) > 1) {
        failures.push(`${row.viewport} ${k}=${v}`)
      }
    }

    if (row.viewport.startsWith('1440') || row.viewport.startsWith('1280')) {
      if (row.layout !== 'push') failures.push(`${row.viewport} layout=${row.layout} (want push)`)
      if (typeof row.panelW === 'number' && Math.abs(row.panelW - 360) > 1) {
        failures.push(`${row.viewport} panelW=${row.panelW}`)
      }
      if (!row.hasClose) failures.push(`${row.viewport} missingClose`)
      if (!row.pillPressed) failures.push(`${row.viewport} pillNotPressed`)
      if (row.dCloseVsMore == null) failures.push(`${row.viewport} missingRightEdge`)
    }

    if (row.viewport.startsWith('390')) {
      if (row.layout !== 'sheet') failures.push(`${row.viewport} layout=${row.layout} (want sheet)`)
      if (row.hasClose) failures.push(`${row.viewport} unexpectedCloseOnSheet`)
      if (row.fabHidden === false) failures.push(`${row.viewport} fabStillVisible`)
    }
  }
  if (failures.length) {
    console.error('FAILURES:', failures.join('; '))
    process.exitCode = 2
  } else {
    console.log('All checks within 1px / pass.')
  }
}

function markdownTable(rows) {
  const cols = [
    'viewport', 'layout', 'outer', 'dPurpose', 'dDot', 'dAddPlus',
    'inner', 'dDesc', 'dAddLabel', 'right', 'dCloseVsMore',
    'hasClose', 'pillPressed', 'panelW',
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
