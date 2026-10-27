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
    const closeBtn = document.querySelector('[data-aio-cat-close]')
    const layout = panel?.getAttribute('data-aio-cat-layout')
      || document.querySelector('[data-aio-cat-layout]')?.getAttribute('data-aio-cat-layout')
    const nameFs = name ? parseFloat(getComputedStyle(name).fontSize) : null
    const descFs = desc ? parseFloat(getComputedStyle(desc).fontSize) : null
    const descTransform = desc ? getComputedStyle(desc).transform : null
    const descVisualFs = (() => {
      if (!desc) return null
      const t = getComputedStyle(desc).transform
      if (t && t !== 'none') {
        const m = t.match(/matrix\(([^)]+)\)/)
        if (m) {
          const scale = parseFloat(m[1].split(',')[0])
          return +(descFs * scale).toFixed(2)
        }
      }
      return descFs
    })()
    const fab = document.querySelector('[data-agentation-toolbar]')
    const fabHidden = !fab || getComputedStyle(fab).display === 'none' || getComputedStyle(fab).visibility === 'hidden'
    const titleX = textLeft(catTitle)
    const purposeX = textLeft(purpose)
    const addX = textLeft(add)
    const nameX = textLeft(name)
    const descX = textLeft(desc)
    const borderLeft = panel ? getComputedStyle(panel).borderLeftWidth : null
    const boxShadow = panel ? getComputedStyle(panel).boxShadow : null
    return {
      panel: box(panel),
      layout,
      borderLeft,
      boxShadow,
      row: box(row),
      dot: box(dot),
      name: box(name),
      desc: box(desc),
      more: box(more),
      moreIcon: box(moreIcon),
      title: { x: titleX },
      purpose: { x: purposeX },
      add: { x: addX },
      textLefts: { title: titleX, purpose: purposeX, name: nameX, desc: descX, add: addX },
      nameMidY: name ? +(name.getBoundingClientRect().top + name.getBoundingClientRect().height / 2).toFixed(1) : null,
      dotCy: dot ? +(dot.getBoundingClientRect().top + dot.getBoundingClientRect().height / 2).toFixed(1) : null,
      moreCy: moreIcon ? +(moreIcon.getBoundingClientRect().top + moreIcon.getBoundingClientRect().height / 2).toFixed(1) : null,
      nameFontSize: nameFs,
      descVisual: { fontSize: descFs, visualFontSize: descVisualFs, transform: descTransform },
      hasClose: !!closeBtn,
      fabHidden,
      moreColor: more ? getComputedStyle(more).color : null,
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

      const textEdge = catM.textLefts?.name
      const catLines = []
      if (textEdge != null) catLines.push({ orient: 'v', at: textEdge, color: 'rgba(0,100,255,0.95)' })
      if (catM.textLefts?.title != null) catLines.push({ orient: 'v', at: catM.textLefts.title, color: 'rgba(180,0,255,0.7)' })
      if (catM.textLefts?.purpose != null) catLines.push({ orient: 'v', at: catM.textLefts.purpose, color: 'rgba(0,180,80,0.7)' })
      if (catM.textLefts?.add != null) catLines.push({ orient: 'v', at: catM.textLefts.add, color: 'rgba(255,140,0,0.7)' })
      if (catM.dot) {
        catLines.push({ orient: 'v', at: catM.dot.cx, color: 'rgba(255,0,0,0.7)' })
        catLines.push({ orient: 'h', at: catM.dot.cy, color: 'rgba(255,0,0,0.5)' })
      }
      if (catM.nameMidY != null) catLines.push({ orient: 'h', at: catM.nameMidY, color: 'rgba(0,100,255,0.5)' })
      if (catM.panel) {
        catLines.push({ orient: 'v', at: catM.panel.x, color: 'rgba(255,0,180,0.6)' })
      }
      if (catM.checkbox) catLines.push({ orient: 'v', at: catM.checkbox.x, color: 'rgba(255,80,0,0.7)' })
      await drawRulers(page, catLines, `${key} open: blue=name L, purple=title, green=guide, orange=add, red=dot, pink=rail L`)
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

      const textEdges = catM.textLefts || {}
      const edgeTarget = textEdges.name
      const edgeDeltas = {}
      for (const [k, v] of Object.entries(textEdges)) {
        edgeDeltas[k] = typeof v === 'number' && typeof edgeTarget === 'number'
          ? round1(v - edgeTarget)
          : null
      }

      const closedCheck = mainM.checkbox?.x
      const closedText = mainM.taskText?.x
      const openCheck = catM.checkbox?.x
      const openText = catM.taskText?.x
      const internalGapClosed = closedCheck != null && closedText != null
        ? round1(closedText - closedCheck)
        : null
      const internalGapOpen = openCheck != null && openText != null
        ? round1(openText - openCheck)
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
        textEdgeDeltas: edgeDeltas,
        panelWidth: catM.panel?.w ?? null,
        mainPaneShrink: mainM.mainPaneWidth != null && catM.mainPaneWidth != null
          ? round1(mainM.mainPaneWidth - catM.mainPaneWidth)
          : null,
        taskShift: closedCheck != null && openCheck != null
          ? round1(openCheck - closedCheck)
          : null,
        internalGapClosed,
        internalGapOpen,
        internalGapDelta: internalGapClosed != null && internalGapOpen != null
          ? round1(internalGapOpen - internalGapClosed)
          : null,
      }

      await context.close()
    }
  }

  await browser.close()

  const table = []
  for (const [key, data] of Object.entries(report)) {
    const e = data.deltas?.textEdgeDeltas || {}
    table.push({
      viewport: key,
      checkboxLeft: data.main?.checkbox?.x,
      taskTextLeft: data.main?.taskText?.x,
      openCheckLeft: data.categories?.checkbox?.x,
      layout: data.categories?.layout,
      panelW: data.deltas?.panelWidth,
      mainShrink: data.deltas?.mainPaneShrink,
      taskShift: data.deltas?.taskShift,
      gapClosed: data.deltas?.internalGapClosed,
      gapOpen: data.deltas?.internalGapOpen,
      gapDelta: data.deltas?.internalGapDelta,
      catTextEdge: data.categories?.textLefts?.name,
      dTitle: e.title,
      dPurpose: e.purpose,
      dName: e.name,
      dDesc: e.desc,
      dAdd: e.add,
      dotVsName: data.deltas?.dotCentreVsNameMidY,
      moreVsName: data.deltas?.moreCentreVsNameMidY,
      hasClose: data.categories?.hasClose,
      pillPressed: data.categories?.pillPressed,
      fabHidden: data.categories?.fabHidden,
      borderLeft: data.categories?.borderLeft,
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
      iconVsCheck: report[row.viewport]?.deltas?.sidebarIconVsCheckboxLeft,
      titleVsTask: report[row.viewport]?.deltas?.titleVsTaskTextLeft,
      dotVsName: row.dotVsName,
      moreVsName: row.moreVsName,
      dTitle: row.dTitle,
      dPurpose: row.dPurpose,
      dDesc: row.dDesc,
      dAdd: row.dAdd,
      gapDelta: row.gapDelta,
    })) {
      if (typeof v === 'number' && Math.abs(v) > 1) {
        failures.push(`${row.viewport} ${k}=${v}`)
      }
    }

    // Closed alignment targets at 1440
    if (row.viewport.startsWith('1440')) {
      if (typeof row.checkboxLeft === 'number' && Math.abs(row.checkboxLeft - 396) > 1) {
        failures.push(`${row.viewport} checkboxLeft=${row.checkboxLeft} (want ~396)`)
      }
      if (typeof row.taskTextLeft === 'number' && Math.abs(row.taskTextLeft - 422) > 1) {
        failures.push(`${row.viewport} taskTextLeft=${row.taskTextLeft} (want ~422)`)
      }
      if (row.layout !== 'push') failures.push(`${row.viewport} layout=${row.layout} (want push)`)
      if (typeof row.panelW === 'number' && Math.abs(row.panelW - 360) > 1) {
        failures.push(`${row.viewport} panelW=${row.panelW}`)
      }
      if (typeof row.mainShrink === 'number' && Math.abs(row.mainShrink - 360) > 1) {
        failures.push(`${row.viewport} mainShrink=${row.mainShrink} (want ~360)`)
      }
      if (!row.hasClose) failures.push(`${row.viewport} missingClose`)
      if (!row.pillPressed) failures.push(`${row.viewport} pillNotPressed`)
    }

    if (row.viewport.startsWith('1280')) {
      if (row.layout !== 'push') failures.push(`${row.viewport} layout=${row.layout} (want push)`)
      if (typeof row.panelW === 'number' && Math.abs(row.panelW - 360) > 1) {
        failures.push(`${row.viewport} panelW=${row.panelW}`)
      }
      if (typeof row.mainShrink === 'number' && Math.abs(row.mainShrink - 360) > 1) {
        failures.push(`${row.viewport} mainShrink=${row.mainShrink}`)
      }
      if (!row.hasClose) failures.push(`${row.viewport} missingClose`)
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
    'viewport', 'checkboxLeft', 'taskTextLeft', 'openCheckLeft', 'layout', 'panelW',
    'mainShrink', 'taskShift', 'gapClosed', 'gapOpen', 'gapDelta',
    'catTextEdge', 'dTitle', 'dPurpose', 'dDesc', 'dAdd',
    'dotVsName', 'moreVsName', 'hasClose', 'pillPressed', 'fabHidden',
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
