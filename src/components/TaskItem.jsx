import { useState, useRef, useCallback, useEffect } from 'react'
import { PriorityBadge } from './PriorityBadge'
import styles from './TaskItem.module.css'

const LONG_PRESS_MS = 1000
const MOVE_THRESHOLD = 8   // px before long-press is cancelled
const HOLDING_FEEDBACK_MS = 80 // how soon the charging cue appears

export function TaskItem({ task, index = 0, onComplete, onPriorityChange, onTextChange, onDragReady, isBeingDragged, isCompleting }) {
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

  // ── Text editing ──────────────────────────────────────────────────
  const handleTextClick = () => {
    setEditing(true)
    setTimeout(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); textareaRef.current?.blur() }
  }

  const handleRowClick = (e) => {
    if (e.target.closest('button')) return
    if (!editing) handleTextClick()
  }

  return (
    <div
      ref={itemRef}
      className={[
        styles.item,
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

      {task.priority && (
        <div className={styles.priorityWrap}>
          <PriorityBadge priority={task.priority} onChange={(p) => onPriorityChange(task, p)} />
        </div>
      )}
    </div>
  )
}
