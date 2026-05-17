import { useRef, useEffect, forwardRef, useCallback, useImperativeHandle } from 'react'
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

export function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

export function makeTextLine(content = '') {
  return { id: makeId(), type: 'text', content }
}

export function makeCheckLine(content = '') {
  return { id: makeId(), type: 'check', content, checked: false }
}

// Single contenteditable line — plain text or checklist item
const BlobLine = forwardRef(function BlobLine(
  { line, isFirst, onChange, onKeyDown, onToggleCheck, onFocus },
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
    if (!el) return
    if (line.content === syncedRef.current) return
    syncedRef.current = line.content
    el.innerHTML = line.content || ''
    el.dataset.empty = !line.content || line.content === '<br>' ? 'true' : 'false'
  }, [line.content])

  const handleInput = useCallback((e) => {
    const html = e.currentTarget.innerHTML
    // Normalise: treat bare <br> as empty
    const normalised = html === '<br>' || html === '<br/>' ? '' : html
    syncedRef.current = normalised
    e.currentTarget.dataset.empty = normalised === '' ? 'true' : 'false'
    onChange(normalised)
  }, [onChange])

  return (
    <div className={styles.line}>
      {line.type === 'check' && (
        <button
          className={`${styles.square} ${line.checked ? styles.squareChecked : ''}`}
          onClick={onToggleCheck}
          aria-label={line.checked ? 'Uncheck' : 'Check'}
          tabIndex={-1}
        />
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
          // Snapshot the selection so format() can restore it after focus is lost
          // (iOS tapping a toolbar button blurs the contenteditable before the press fires)
          const sel = window.getSelection()
          if (sel?.rangeCount > 0) e.currentTarget._savedRange = sel.getRangeAt(0).cloneRange()
        }}
        data-placeholder={isFirst ? 'thought dump...' : ''}
      />
    </div>
  )
})

export const Blob = forwardRef(function Blob({ lines, onChange, disabled, collapsed }, ref) {
  const inputRefs = useRef([])
  const focusedIdx = useRef(0)

  const handleChange = useCallback((idx, content) => {
    onChange(lines.map((l, i) => i === idx ? { ...l, content } : l))
  }, [lines, onChange])

  const handleKeyDown = useCallback((idx, e) => {
    // Cross-line selection delete: Backspace or Delete with a selection spanning multiple lines
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const sel = window.getSelection()
      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        const anchorCE = getContentEditable(sel.anchorNode)
        const focusCE = getContentEditable(sel.focusNode)
        if (anchorCE && focusCE && anchorCE !== focusCE) {
          e.preventDefault()
          const allCEs = inputRefs.current
          const anchorLineIdx = allCEs.indexOf(anchorCE)
          const focusLineIdx = allCEs.indexOf(focusCE)
          if (anchorLineIdx === -1 || focusLineIdx === -1) return
          const loIdx = Math.min(anchorLineIdx, focusLineIdx)
          const hiIdx = Math.max(anchorLineIdx, focusLineIdx)
          const loCE = allCEs[loIdx]
          const hiCE = allCEs[hiIdx]

          // Content before selection start (in loCE)
          const preRange = document.createRange()
          preRange.setStart(loCE, 0)
          preRange.setEnd(range.startContainer, range.startOffset)
          const preDiv = document.createElement('div')
          preDiv.appendChild(preRange.cloneContents())
          const preHtml = preDiv.innerHTML
          const preTextLen = preDiv.textContent.length

          // Content after selection end (in hiCE)
          const postRange = document.createRange()
          postRange.setStart(range.endContainer, range.endOffset)
          if (hiCE.childNodes.length > 0) {
            postRange.setEnd(hiCE, hiCE.childNodes.length)
          } else {
            postRange.setEnd(hiCE, 0)
          }
          const postDiv = document.createElement('div')
          postDiv.appendChild(postRange.cloneContents())
          const postHtml = postDiv.innerHTML

          const merged = preHtml + postHtml
          const cleanMerged = merged === '<br>' || merged === '<br/>' ? '' : merged

          const newLines = [
            ...lines.slice(0, loIdx),
            { ...lines[loIdx], content: cleanMerged },
            ...lines.slice(hiIdx + 1),
          ]
          onChange(newLines)

          // Place cursor at merge point after re-render
          setTimeout(() => {
            const targetEl = inputRefs.current[loIdx]
            if (!targetEl) return
            targetEl.focus()
            try {
              const sel2 = window.getSelection()
              const r = document.createRange()
              const walker = document.createTreeWalker(targetEl, NodeFilter.SHOW_TEXT, null, false)
              let remaining = preTextLen
              let placed = false
              let node
              while ((node = walker.nextNode())) {
                if (remaining <= node.textContent.length) {
                  r.setStart(node, remaining)
                  r.collapse(true)
                  sel2.removeAllRanges()
                  sel2.addRange(r)
                  placed = true
                  break
                }
                remaining -= node.textContent.length
              }
              if (!placed) {
                r.selectNodeContents(targetEl)
                r.collapse(false)
                sel2.removeAllRanges()
                sel2.addRange(r)
              }
            } catch {}
          }, 0)
          return
        }
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const cur = lines[idx]
      // Empty check-line at the end → escape back to text mode
      if (cur.type === 'check' && !e.currentTarget.textContent?.trim() && idx === lines.length - 1) {
        onChange(lines.map((l, i) => i === idx ? { ...l, type: 'text' } : l))
        return
      }
      const newLine = cur.type === 'check' ? makeCheckLine() : makeTextLine()
      const updated = [...lines.slice(0, idx + 1), newLine, ...lines.slice(idx + 1)]
      onChange(updated)
      setTimeout(() => inputRefs.current[idx + 1]?.focus(), 0)
    }
    if (e.key === 'Backspace' && !e.currentTarget.textContent?.trim() && lines.length > 1) {
      e.preventDefault()
      onChange(lines.filter((_, i) => i !== idx))
      setTimeout(() => inputRefs.current[Math.max(0, idx - 1)]?.focus(), 0)
    }
  }, [lines, onChange])

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
        setTimeout(() => inputRefs.current[lines.length]?.focus(), 0)
        return
      }
      onChange(lines.map((l, i) =>
        i === idx ? { ...l, type: l.type === 'check' ? 'text' : 'check', checked: false } : l
      ))
    },

    // Rich-text formatting via execCommand.
    // Re-focuses the last active line and restores any saved selection range before applying,
    // which handles iOS's tendency to blur the contenteditable when toolbar buttons are tapped.
    format(type) {
      const el = inputRefs.current[focusedIdx.current]
      if (el) {
        el.focus()
        if (el._savedRange) {
          const sel = window.getSelection()
          sel.removeAllRanges()
          sel.addRange(el._savedRange)
          el._savedRange = null
        }
      }
      document.execCommand(type, false, null)
    },

    queryFormat(type) {
      try { return document.queryCommandState(type) } catch { return false }
    },

    undo() {
      const el = inputRefs.current[focusedIdx.current]
      if (el) el.focus()
      document.execCommand('undo', false, null)
    }
  }), [lines, onChange])

  const handleContainerClick = useCallback((e) => {
    // Clicks on the blob padding (not on a line element) → focus last line
    if (e.target === e.currentTarget) {
      inputRefs.current[lines.length - 1]?.focus()
    }
  }, [lines.length])

  return (
    <div
      className={`${styles.blob} ${disabled ? styles.disabled : ''} ${collapsed ? styles.collapsed : ''}`}
      onClick={handleContainerClick}
    >
      {lines.map((line, idx) => (
        <BlobLine
          key={line.id}
          ref={el => { inputRefs.current[idx] = el }}
          line={line}
          isFirst={idx === 0}
          onChange={(content) => handleChange(idx, content)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onToggleCheck={() => handleToggleCheck(idx)}
          onFocus={() => { focusedIdx.current = idx }}
        />
      ))}
    </div>
  )
})
