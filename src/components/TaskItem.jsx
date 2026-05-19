import { useState, useRef, useCallback, useEffect } from 'react'
import { PriorityBadge } from './PriorityBadge'
import styles from './TaskItem.module.css'

const LONG_PRESS_MS = 1000
const MOVE_THRESHOLD = 8   // px before long-press is cancelled
const HOLDING_FEEDBACK_MS = 80 // how soon the charging cue appears

export function TaskItem({ task, index = 0, onComplete, onPriorityChange, onTextChange, onAddAfter, onDragReady, isBeingDragged, isCompleting, autoFocus }) {
  const [completing, setCompleting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(task.text)
  const [holding, setHolding] = useState(false)
  const longPressTimerRef = useRef(null)  // long-press drag trigger
  const holdingTimerRef = useRef(null)    // visual charge cue
  const textareaRef = useRef(null)

  // completing = local state (immediate on click) OR driven externally (for orphaned rows still animating)
  const effectiveCompleting = completing || !!isCompleting

  // When undo fires, the parent clears isCompleting. Reset local state so the same React component
  // instance (same key) doesn't keep showing the completing animation after the task is restored.
  useEffect(() => {
    if (!isCompleting && completing) setCompleting(false)
  }, [isCompleting]) // eslint-disable-line
  const itemRef = useRef(null)
  const pressStartRef = useRef(null)

  // ── Long-press detection ──────────────────────────────────────────
  const cancelLongPress = useCallback(() => {
    clearTimeout(longPressTimerRef.current)
    clearTimeout(holdingTimerRef.current)
    longPressTimerRef.current = null
    pressStartRef.current = null
    setHolding(false)
  }, [])

  const handlePointerDown = useCallback((e) => {
    if (editing) return
    if (e.button != null && e.button !== 0) return // left-click / touch only

    const cx = e.clientX
    const cy = e.clientY
    pressStartRef.current = { x: cx, y: cy }

    // Show visual cue shortly after press starts
    holdingTimerRef.current = setTimeout(() => setHolding(true), HOLDING_FEEDBACK_MS)

    // Trigger drag after full hold
    longPressTimerRef.current = setTimeout(() => {
      setHolding(false)
      pressStartRef.current = null
      // Suppress the click that fires on pointerup (prevents checkbox/badge activation)
      const suppressClick = (ev) => { ev.stopPropagation(); ev.preventDefault() }
      window.addEventListener('click', suppressClick, { capture: true, once: true })
      onDragReady?.(task, cx, cy, itemRef.current)
    }, LONG_PRESS_MS)
  }, [editing, task, onDragReady])

  const handlePointerMove = useCallback((e) => {
    if (!pressStartRef.current) return
    const dx = e.clientX - pressStartRef.current.x
    const dy = e.clientY - pressStartRef.current.y
    if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD) cancelLongPress()
  }, [cancelLongPress])

  // ── Checkbox ──────────────────────────────────────────────────────
  const handleCheck = () => {
    setCompleting(true)
    onComplete(task)  // fires immediately — App manages the 1.8s display window
  }

  // Auto-focus when created via Enter (onAddAfter)
  useEffect(() => {
    if (!autoFocus) return
    setEditing(true)
    setTimeout(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }, 0)
  }, []) // eslint-disable-line

  // ── Text editing ──────────────────────────────────────────────────
  const handleTextClick = (clickOffset = null) => {
    setEditing(true)
    setTimeout(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      const pos = clickOffset !== null ? Math.min(clickOffset, el.value.length) : el.value.length
      el.setSelectionRange(pos, pos)
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }, 0)
  }

  const handleTextChange = (e) => {
    setEditText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = e.target.scrollHeight + 'px'
  }

  const handleTextBlur = useCallback(() => {
    setEditing(false)
    const trimmed = editText.trim()
    if (trimmed && trimmed !== task.text) {
      onTextChange(task, trimmed)
    } else {
      setEditText(task.text)
    }
  }, [editText, task, onTextChange])

  const handleTextKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); textareaRef.current?.blur() }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      textareaRef.current?.blur()   // save current task first
      onAddAfter?.(task)
    }
  }

  const handleRowClick = (e) => {
    if (e.target.closest('button')) return
    if (!editing) {
      // Capture click-point character offset from the rendered span.
      // caretRangeFromPoint can return offset 0 for clicks in padding/whitespace
      // even when the actual text is far to the right — validate before trusting it.
      let clickOffset = null
      try {
        let textNode = null
        let rawOffset = null

        if (document.caretRangeFromPoint) {
          const range = document.caretRangeFromPoint(e.clientX, e.clientY)
          if (range?.startContainer?.nodeType === Node.TEXT_NODE) {
            textNode  = range.startContainer
            rawOffset = range.startOffset
          }
        } else if (document.caretPositionFromPoint) {
          const pos = document.caretPositionFromPoint(e.clientX, e.clientY)
          if (pos?.offsetNode?.nodeType === Node.TEXT_NODE) {
            textNode  = pos.offsetNode
            rawOffset = pos.offset
          }
        }

        if (textNode !== null && rawOffset !== null) {
          // Offset 0 is only trustworthy when the click is genuinely near the
          // start of the text. Validate by checking the first character's rect.
          if (rawOffset === 0 && textNode.length > 0) {
            const testRange = document.createRange()
            testRange.setStart(textNode, 0)
            testRange.setEnd(textNode, 1)
            const charRect = testRange.getBoundingClientRect()
            // If the click is clearly to the right of the first character's
            // leading edge, the offset-0 is a false result — discard it.
            if (charRect.width > 0 && e.clientX > charRect.left + charRect.width * 0.5) {
              rawOffset = null
            }
          }
          if (rawOffset !== null) clickOffset = rawOffset
        }
      } catch {}
      handleTextClick(clickOffset)
    }
  }

  return (
    <div
      ref={itemRef}
      className={[
        styles.item,
        'taskRow',
        effectiveCompleting ? styles.completing : '',
        holding ? styles.holding : '',
        isBeingDragged ? styles.dragging : '',
      ].join(' ')}
      style={effectiveCompleting ? undefined : { animationDelay: `${index * 28}ms` }}
      onClick={handleRowClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onPointerLeave={cancelLongPress}
    >
      <button className={styles.checkbox} onClick={handleCheck} aria-label="Complete task">
        <span className={styles.square}>
          {effectiveCompleting && (
            <svg className={styles.checkTick} viewBox="0 0 16 16" fill="none">
              <path d="M3.5 8.5l3 3 6-7" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </span>
      </button>

      <div className={styles.textWrap}>
        {editing ? (
          <textarea
            ref={textareaRef}
            className={styles.textInput}
            value={editText}
            onChange={handleTextChange}
            onBlur={handleTextBlur}
            onKeyDown={handleTextKeyDown}
            rows={1}
          />
        ) : (
          <span className={styles.text}>{task.text}</span>
        )}
      </div>

      <div className={styles.priorityWrap}>
        <PriorityBadge priority={task.priority ?? null} onChange={(p) => onPriorityChange(task, p)} />
      </div>
    </div>
  )
}
