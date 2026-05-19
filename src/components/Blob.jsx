import { useState, useRef, useEffect, forwardRef, useCallback, useImperativeHandle } from 'react'
import styles from './Blob.module.css'

// Walk up the DOM to find the nearest contenteditable ancestor (or self)
function getContentEditable(node) {
  let n = node?.nodeType === 3 ? node.parentElement : node
  while (n) {
    if (n.hasAttribute?.('contenteditable')) return n
    n = n.parentElement
  }
  return null
}

// Returns true if the cursor (collapsed selection) is at the very start of el
function isCursorAtStart(el) {
  try {
    const sel = window.getSelection()
    if (!sel?.isCollapsed || !sel.rangeCount) return false
    const range = sel.getRangeAt(0)
    const testRange = document.createRange()
    testRange.selectNodeContents(el)
    testRange.collapse(true)
    return range.compareBoundaryPoints(Range.START_TO_START, testRange) === 0
  } catch { return false }
}

export function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

export function makeTextLine(content = '') {
  return { id: makeId(), type: 'text', content }
}

export function makeCheckLine(content = '') {
  return { id: makeId(), type: 'check', content, checked: false }
}

export function makeBulletLine(content = '') {
  return { id: makeId(), type: 'bullet', content }
}

// Single contenteditable line — plain text, bullet, or checklist item
const BlobLine = forwardRef(function BlobLine(
  { line, isFirst, isSelected, onChange, onKeyDown, onToggleCheck, onFocus },
  fwdRef
) {
  const innerRef = useRef(null)
  const syncedRef = useRef(line.content)

  // Combined ref: forwards to parent AND sets initial innerHTML on mount
  const setRef = useCallback((el) => {
    innerRef.current = el
    if (typeof fwdRef === 'function') fwdRef(el)
    else if (fwdRef) fwdRef.current = el

    if (el) {
      const html = line.content || ''
      el.innerHTML = html
      syncedRef.current = html
      el.dataset.empty = html === '' || html === '<br>' ? 'true' : 'false'
    }
  }, []) // empty deps — mount only; external changes handled by effect below

  // Sync when content is changed externally (e.g. preSortLines restore)
  useEffect(() => {
    const el = innerRef.current
    if (!el || line.content === syncedRef.current) return
    syncedRef.current = line.content
    el.innerHTML = line.content || ''
    el.dataset.empty = !line.content || line.content === '<br>' ? 'true' : 'false'
  }, [line.content])

  const handleInput = useCallback((e) => {
    const html = e.currentTarget.innerHTML
    const normalised = html === '<br>' || html === '<br/>' ? '' : html
    syncedRef.current = normalised
    e.currentTarget.dataset.empty = normalised === '' ? 'true' : 'false'
    onChange(normalised)
  }, [onChange])

  return (
    <div className={`${styles.line} ${isSelected ? styles.lineSelected : ''}`}>
      {line.type === 'check' && (
        <button
          className={`${styles.square} ${line.checked ? styles.squareChecked : ''}`}
          onClick={onToggleCheck}
          aria-label={line.checked ? 'Uncheck' : 'Check'}
          tabIndex={-1}
          onPointerDown={e => e.currentTarget.releasePointerCapture(e.pointerId)}
        />
      )}
      {line.type === 'bullet' && (
        <span className={styles.bullet} aria-hidden="true">•</span>
      )}
      <div
        ref={setRef}
        contentEditable
        suppressContentEditableWarning
        className={`${styles.lineInput} ${line.type === 'check' && line.checked ? styles.strikethrough : ''}`}
        onInput={handleInput}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={(e) => {
          const sel = window.getSelection()
          if (sel?.rangeCount > 0) e.currentTarget._savedRange = sel.getRangeAt(0).cloneRange()
        }}
        data-placeholder={isFirst ? 'thought dump...' : ''}
      />
    </div>
  )
})

export const Blob = forwardRef(function Blob({ lines, onChange, onBeforeLineDelete, onLineTypeChange, disabled, collapsed }, ref) {
  const inputRefs = useRef([])
  const focusedIdx = useRef(0)
  const blobContainerRef = useRef(null)           // direct DOM ref for class toggling
  const [lineSel, setLineSel] = useState(null)    // { anchor, focus } | null
  const dragAnchorRef = useRef(null)              // { idx, active }
  const skipNextFocusClearRef = useRef(false)     // suppress focus-based clear during Shift+Arrow

  const clearLineSel = useCallback(() => setLineSel(null), [])

  // ── Helpers ─────────────────────────────────────────────────────────

  const getLineIdxFromY = useCallback((y) => {
    const refs = inputRefs.current
    for (let i = 0; i < refs.length; i++) {
      const el = refs[i]
      if (!el) continue
      const rect = el.getBoundingClientRect()
      // Extend each line's hit zone by 8px above/below to cover inter-line gaps
      if (y >= rect.top - 8 && y <= rect.bottom + 8) return i
    }
    // Clamp to first / last
    if (refs[0] && y < refs[0].getBoundingClientRect().top) return 0
    const last = refs.filter(Boolean).length - 1
    return last >= 0 ? last : 0
  }, [])

  // ── Container pointer events for cross-line drag selection ──────────

  const handleBlobPointerDown = useCallback((e) => {
    if (e.button !== 0) return
    dragAnchorRef.current = { idx: getLineIdxFromY(e.clientY), active: false }
  }, [getLineIdxFromY])

  const handleBlobPointerMove = useCallback((e) => {
    if (!(e.buttons & 1) || !dragAnchorRef.current) return
    const curIdx = getLineIdxFromY(e.clientY)
    if (curIdx !== dragAnchorRef.current.idx || dragAnchorRef.current.active) {
      if (!dragAnchorRef.current.active) {
        dragAnchorRef.current.active = true
        // Apply user-select:none only while drag is in progress (via direct DOM —
        // avoids React re-render and prevents the class from blocking post-drag clicks)
        blobContainerRef.current?.classList.add(styles.blobSelecting)
      }
      setLineSel({ anchor: dragAnchorRef.current.idx, focus: curIdx })
      try { window.getSelection().removeAllRanges() } catch {}
    }
  }, [getLineIdxFromY])

  const handleBlobPointerUp = useCallback(() => {
    // Remove user-select:none regardless of whether it was a drag
    blobContainerRef.current?.classList.remove(styles.blobSelecting)
    // Plain click (no cross-line drag) → clear selection
    if (dragAnchorRef.current && !dragAnchorRef.current.active) {
      clearLineSel()
    }
    dragAnchorRef.current = null
  }, [clearLineSel])

  // ── Per-line key handler ─────────────────────────────────────────────

  const handleChange = useCallback((idx, content) => {
    onChange(lines.map((l, i) => i === idx ? { ...l, content } : l))
  }, [lines, onChange])

  const handleKeyDown = useCallback((idx, e) => {
    // Escape: clear multi-line selection
    if (e.key === 'Escape' && lineSel) {
      e.preventDefault()
      clearLineSel()
      return
    }

    // Shift+Arrow: extend multi-line selection
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.shiftKey) {
      const atEdge = e.key === 'ArrowUp' ? isCursorAtStart(e.currentTarget) : true
      if (lineSel || atEdge) {
        e.preventDefault()
        const anchor = lineSel ? lineSel.anchor : idx
        const prevFocus = lineSel ? lineSel.focus : idx
        const nextFocus = e.key === 'ArrowUp'
          ? Math.max(0, prevFocus - 1)
          : Math.min(lines.length - 1, prevFocus + 1)
        skipNextFocusClearRef.current = true   // focus move must not clear selection
        setLineSel({ anchor, focus: nextFocus })
        setTimeout(() => inputRefs.current[nextFocus]?.focus(), 0)
        return
      }
    }

    // Backspace / Delete
    if (e.key === 'Backspace' || e.key === 'Delete') {
      // 1. Multi-line selection delete
      if (lineSel) {
        e.preventDefault()
        onBeforeLineDelete?.(lines)   // snapshot for undo before mutating
        const lo = Math.min(lineSel.anchor, lineSel.focus)
        const hi = Math.max(lineSel.anchor, lineSel.focus)
        const kept = lines.filter((_, i) => i < lo || i > hi)
        onChange(kept.length > 0 ? kept : [makeTextLine('')])
        clearLineSel()
        setTimeout(() => inputRefs.current[Math.max(0, lo - 1)]?.focus(), 0)
        return
      }

      // 2. Cross-line browser selection (rare but handle it)
      const sel = window.getSelection()
      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        const anchorCE = getContentEditable(sel.anchorNode)
        const focusCE  = getContentEditable(sel.focusNode)
        if (anchorCE && focusCE && anchorCE !== focusCE) {
          e.preventDefault()
          const allCEs = inputRefs.current
          const aIdx = allCEs.indexOf(anchorCE)
          const fIdx = allCEs.indexOf(focusCE)
          if (aIdx === -1 || fIdx === -1) return
          const loIdx = Math.min(aIdx, fIdx)
          const hiIdx = Math.max(aIdx, fIdx)
          const loCE  = allCEs[loIdx]
          const hiCE  = allCEs[hiIdx]

          const preRange = document.createRange()
          preRange.setStart(loCE, 0)
          preRange.setEnd(range.startContainer, range.startOffset)
          const preDiv = document.createElement('div')
          preDiv.appendChild(preRange.cloneContents())
          const preHtml    = preDiv.innerHTML
          const preTextLen = preDiv.textContent.length

          const postRange = document.createRange()
          postRange.setStart(range.endContainer, range.endOffset)
          postRange.setEnd(hiCE, hiCE.childNodes.length || 0)
          const postDiv = document.createElement('div')
          postDiv.appendChild(postRange.cloneContents())
          const postHtml = postDiv.innerHTML

          const merged = preHtml + postHtml
          const cleanMerged = merged === '<br>' || merged === '<br/>' ? '' : merged
          onChange([...lines.slice(0, loIdx), { ...lines[loIdx], content: cleanMerged }, ...lines.slice(hiIdx + 1)])

          setTimeout(() => {
            const targetEl = inputRefs.current[loIdx]
            if (!targetEl) return
            targetEl.focus()
            try {
              const sel2 = window.getSelection()
              const r    = document.createRange()
              const walker = document.createTreeWalker(targetEl, NodeFilter.SHOW_TEXT, null, false)
              let remaining = preTextLen, placed = false, node
              while ((node = walker.nextNode())) {
                if (remaining <= node.textContent.length) {
                  r.setStart(node, remaining); r.collapse(true)
                  sel2.removeAllRanges(); sel2.addRange(r)
                  placed = true; break
                }
                remaining -= node.textContent.length
              }
              if (!placed) { r.selectNodeContents(targetEl); r.collapse(false); sel2.removeAllRanges(); sel2.addRange(r) }
            } catch {}
          }, 0)
          return
        }
      }

      // 3. Backspace at start of bullet/check → convert to plain text (empty or not)
      if (e.key === 'Backspace') {
        const cur = lines[idx]
        const hasContent = !!e.currentTarget.textContent?.trim()
        if ((cur.type === 'check' || cur.type === 'bullet') && isCursorAtStart(e.currentTarget)) {
          e.preventDefault()
          onChange(lines.map((l, i) => i === idx ? { ...l, type: 'text' } : l))
          setTimeout(() => {
            const el = inputRefs.current[idx]
            if (!el) return
            el.focus()
            try {
              const s = window.getSelection(); const r = document.createRange()
              r.selectNodeContents(el); r.collapse(true)
              s.removeAllRanges(); s.addRange(r)
            } catch {}
          }, 0)
          return
        }

        // 4. Empty line → remove it
        if (!hasContent && lines.length > 1) {
          e.preventDefault()
          onChange(lines.filter((_, i) => i !== idx))
          setTimeout(() => inputRefs.current[Math.max(0, idx - 1)]?.focus(), 0)
          return
        }
      }
    }

    // Clear multi-line selection on any normal (non-modifier) key
    if (lineSel && !e.shiftKey && !['Shift', 'Meta', 'Control', 'Alt'].includes(e.key)) {
      clearLineSel()
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const cur = lines[idx]
      const isEmpty = !e.currentTarget.textContent?.trim()
      if ((cur.type === 'check' || cur.type === 'bullet') && isEmpty && idx === lines.length - 1) {
        onChange(lines.map((l, i) => i === idx ? { ...l, type: 'text' } : l))
        return
      }
      const newLine = cur.type === 'check'  ? makeCheckLine()
                    : cur.type === 'bullet' ? makeBulletLine()
                    : makeTextLine()
      onChange([...lines.slice(0, idx + 1), newLine, ...lines.slice(idx + 1)])
      setTimeout(() => inputRefs.current[idx + 1]?.focus(), 0)
    }
  }, [lines, onChange, lineSel, clearLineSel])

  const handleToggleCheck = useCallback((idx) => {
    onChange(lines.map((l, i) => i === idx ? { ...l, checked: !l.checked } : l))
  }, [lines, onChange])

  useImperativeHandle(ref, () => ({
    toggleChecklist() {
      const idx = focusedIdx.current
      const cur = lines[idx]
      if (!cur) {
        const newLine = makeCheckLine()
        onChange([...lines, newLine])
        onLineTypeChange?.('check')
        setTimeout(() => inputRefs.current[lines.length]?.focus(), 0)
        return
      }
      const newType = cur.type === 'check' ? 'text' : 'check'
      onChange(lines.map((l, i) =>
        i === idx ? { ...l, type: newType, checked: false } : l
      ))
      onLineTypeChange?.(newType)
      setTimeout(() => inputRefs.current[idx]?.focus(), 0)
    },

    toggleBullet() {
      const idx = focusedIdx.current
      const cur = lines[idx]
      if (!cur) {
        const newLine = makeBulletLine()
        onChange([...lines, newLine])
        onLineTypeChange?.('bullet')
        setTimeout(() => inputRefs.current[lines.length]?.focus(), 0)
        return
      }
      const newType = cur.type === 'bullet' ? 'text' : 'bullet'
      onChange(lines.map((l, i) =>
        i === idx ? { ...l, type: newType } : l
      ))
      onLineTypeChange?.(newType)
      setTimeout(() => inputRefs.current[idx]?.focus(), 0)
    },

    format(type) {
      const el = inputRefs.current[focusedIdx.current]
      if (!el) return
      el.focus()
      if (el._savedRange) {
        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(el._savedRange)
        el._savedRange = null
      }
      const prevHTML = el.innerHTML
      const sel = window.getSelection()
      const wasCollapsed = !sel || sel.isCollapsed
      document.execCommand(type, false, null)
      if (wasCollapsed && el.innerHTML === prevHTML) {
        document.execCommand('insertText', false, '​')
      }
      el.dispatchEvent(new InputEvent('input', { bubbles: true }))
    },

    queryFormat(type) {
      try { return document.queryCommandState(type) } catch { return false }
    },

    undo() {
      const el = inputRefs.current[focusedIdx.current]
      if (el) el.focus()
      document.execCommand('undo', false, null)
    }
  }), [lines, onChange, onLineTypeChange])

  const handleContainerClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      inputRefs.current[lines.length - 1]?.focus()
    }
  }, [lines.length])

  const selLo = lineSel ? Math.min(lineSel.anchor, lineSel.focus) : -1
  const selHi = lineSel ? Math.max(lineSel.anchor, lineSel.focus) : -1

  return (
    <div
      ref={blobContainerRef}
      className={`${styles.blob} ${disabled ? styles.disabled : ''} ${collapsed ? styles.collapsed : ''}`}
      onClick={handleContainerClick}
      onPointerDown={handleBlobPointerDown}
      onPointerMove={handleBlobPointerMove}
      onPointerUp={handleBlobPointerUp}
      onPointerLeave={handleBlobPointerUp}
    >
      {lines.map((line, idx) => (
        <BlobLine
          key={line.id}
          ref={el => {
            inputRefs.current[idx] = el
            // Also store wrapper via a data attribute lookup — wrapped in a callback below
          }}
          line={line}
          isFirst={idx === 0}
          isSelected={idx >= selLo && idx <= selHi}
          onChange={(content) => handleChange(idx, content)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onToggleCheck={() => handleToggleCheck(idx)}
          onFocus={() => {
            focusedIdx.current = idx
            onLineTypeChange?.(lines[idx].type)
            // Keyboard navigation (Tab, etc.) clears selection.
            // Mouse clicks are handled by pointerUp; Shift+Arrow is suppressed via skip flag.
            if (lineSel && !skipNextFocusClearRef.current && !dragAnchorRef.current) {
              clearLineSel()
            }
            skipNextFocusClearRef.current = false
          }}
        />
      ))}
    </div>
  )
})
