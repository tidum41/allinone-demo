/**
 * Verify blob Enter/paste newline handling.
 * 1) Type three checklist lines → Sort → three separate tasks
 * 2) Paste multiline plain text → three separate lines in the dump
 * Saves screenshots under /opt/cursor/artifacts/
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts'

mkdirSync(OUT, { recursive: true })
mkdirSync(dirname('/workspace/preview/shots/blob-newlines/x'), { recursive: true })

async function clearBlob(page) {
  await page.evaluate(() => {
    sessionStorage.setItem('demo:v11:lines', JSON.stringify([
      { id: 'seed1', type: 'check', content: '', checked: false },
    ]))
    sessionStorage.setItem('demo:v11:tasks', JSON.stringify([]))
    sessionStorage.setItem('demo:v11:completed', JSON.stringify([]))
  })
  await page.reload({ waitUntil: 'networkidle' })
}

async function readLines(page) {
  return page.evaluate(() => {
    try {
      return JSON.parse(sessionStorage.getItem('demo:v11:lines') || '[]')
    } catch {
      return []
    }
  })
}

async function blobPlainText(page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[contenteditable]')]
    return nodes.map((el) => (el.innerText || '').trim()).filter(Boolean)
  })
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })

// Intercept categorize so Sort works offline and returns one task per newline
await page.route('**/api/categorize', async (route) => {
  const body = route.request().postDataJSON()
  const text = String(body?.text || '')
  const parts = text.split('\n').map((s) => s.trim()).filter(Boolean)
  const tasks = parts.map((t, i) => ({
    id: `t${i + 1}`,
    text: t,
    category: 'Home',
    priority: 'Soon',
  }))
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(tasks),
  })
})

await page.goto(BASE, { waitUntil: 'networkidle' })
await clearBlob(page)

// ── Check 1: type three lines with Enter, then Sort ────────────────────
const first = page.locator('[contenteditable]').first()
await first.click()
await page.keyboard.type('buy milk tomorrow')
await page.keyboard.press('Enter')
await page.waitForFunction(() => document.querySelectorAll('[contenteditable]').length >= 2)
await page.keyboard.type('Pick up suit')
await page.keyboard.press('Enter')
await page.waitForFunction(() => document.querySelectorAll('[contenteditable]').length >= 3)
await page.keyboard.type('call mom')
await page.waitForTimeout(100)

const typedLines = await readLines(page)
const typedTexts = typedLines.map((l) => l.content.replace(/<[^>]*>/g, '').trim()).filter(Boolean)
console.log('typed line count:', typedTexts.length, typedTexts)

if (typedTexts.length !== 3) {
  throw new Error(`Expected 3 typed lines, got ${typedTexts.length}: ${JSON.stringify(typedTexts)}`)
}

await page.locator('[data-aio-sort]').click()
await page.waitForTimeout(600)

const tasksAfterSort = await page.evaluate(() => {
  try { return JSON.parse(sessionStorage.getItem('demo:v11:tasks') || '[]') } catch { return [] }
})
console.log('sorted tasks:', tasksAfterSort.map((t) => t.text))

if (tasksAfterSort.length !== 3) {
  throw new Error(`Expected 3 sorted tasks, got ${tasksAfterSort.length}: ${JSON.stringify(tasksAfterSort)}`)
}
const expected = ['buy milk tomorrow', 'Pick up suit', 'call mom']
for (const t of expected) {
  if (!tasksAfterSort.some((task) => task.text === t)) {
    throw new Error(`Missing task "${t}" in ${JSON.stringify(tasksAfterSort)}`)
  }
}

const shot1 = `${OUT}/blob-newline-typed-sort.png`
await page.screenshot({ path: shot1, fullPage: true })
await page.screenshot({ path: '/workspace/preview/shots/blob-newlines/typed-sort.png', fullPage: true })
console.log('saved', shot1)

// ── Check 2: paste multiline text into a fresh checklist dump ──────────
await clearBlob(page)
await page.locator('[contenteditable]').first().click()
await page.evaluate(async () => {
  const text = 'alpha task\nbeta task\ngamma task'
  const dt = new DataTransfer()
  dt.setData('text/plain', text)
  dt.setData('text/html', '<b>alpha task</b><div><i>beta task</i></div><div>gamma task</div>')
  const el = document.querySelector('[contenteditable]')
  el.dispatchEvent(new ClipboardEvent('paste', {
    clipboardData: dt,
    bubbles: true,
    cancelable: true,
  }))
})

await page.waitForTimeout(300)
const pastedLines = await readLines(page)
const pastedTexts = pastedLines.map((l) => l.content.replace(/<[^>]*>/g, '').trim()).filter(Boolean)
const visible = await blobPlainText(page)
console.log('pasted line count:', pastedTexts.length, pastedTexts, 'visible:', visible)

if (pastedTexts.length !== 3) {
  throw new Error(`Expected 3 pasted lines, got ${pastedTexts.length}: ${JSON.stringify(pastedTexts)}`)
}
// Rich formatting must be stripped (no <b>/<i> left in stored content)
for (const l of pastedLines) {
  if (/<[bi]>/i.test(l.content || '')) {
    throw new Error(`Rich formatting was not stripped: ${l.content}`)
  }
}

const shot2 = `${OUT}/blob-newline-paste.png`
await page.screenshot({ path: shot2, fullPage: true })
await page.screenshot({ path: '/workspace/preview/shots/blob-newlines/paste.png', fullPage: true })
console.log('saved', shot2)

// ── Check 3: reading path — embedded div/br still yields separate tasks ─
await page.evaluate(() => {
  sessionStorage.setItem('demo:v11:lines', JSON.stringify([
    {
      id: 'merged',
      type: 'check',
      content: 'finish essay tomorrow<div>Pick up suit</div><br>call mom',
      checked: false,
    },
  ]))
  sessionStorage.setItem('demo:v11:tasks', JSON.stringify([]))
})
await page.reload({ waitUntil: 'networkidle' })

let capturedBody = null
await page.unroute('**/api/categorize')
await page.route('**/api/categorize', async (route) => {
  capturedBody = route.request().postDataJSON()
  const parts = String(capturedBody?.text || '').split('\n').map((s) => s.trim()).filter(Boolean)
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(parts.map((t, i) => ({
      id: `m${i}`, text: t, category: 'Home', priority: 'Soon',
    }))),
  })
})

await page.locator('[data-aio-sort]').click()
await page.waitForTimeout(400)
console.log('merged-line sort payload:', capturedBody?.text)
const payloadLines = String(capturedBody?.text || '').split('\n').filter(Boolean)
if (payloadLines.length !== 3) {
  throw new Error(`Expected 3 lines in sort payload, got ${payloadLines.length}: ${capturedBody?.text}`)
}

console.log('OK: typing, paste, and HTML→newline reading all passed')
await browser.close()
