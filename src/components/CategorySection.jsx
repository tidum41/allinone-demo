import { useState, useRef, useEffect, useCallback } from 'react'
import { TaskItem } from './TaskItem'
import styles from './CategorySection.module.css'

const PRIORITY_ORDER = { Urgent: 0, Soon: 1, Eventually: 2 }

export function CategorySection({
  category, tasks,
  onComplete, onPriorityChange, onCategoryChange, onTextChange, onAddAfter,
  onDeleteSelected,
  // completing animation props
  completingTaskIds,
  // drag props
  sectionRef, isDragTarget, draggingTaskId, onDragReady,
  // inline-add state
  newTaskId,
}) {
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem(`cat-open-${category}`)
    return saved === null ? true : saved === 'true'
  })
  const [rowSel, setRowSel] = useState(null)   // { anchor, focus } | null
  const tasksInnerRef = useRef(null)
  const dragAnchorRef = useRef(null)           // { idx, active }

  const toggle = () => setIsOpen(v => {
    const next = !v
    localStorage.setItem(`cat-open-${category}`, String(next))
    return next
  })

  // ── Row hit-test ─────────────────────────────────────────────────────
  const getRowIdxFromY = useCallback((y) => {
    const rows = tasksInnerRef.current?.querySelectorAll('.taskRow') ?? []
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect()
      if (y >= r.top - 8 && y <= r.bottom + 8) return i
    }
    return -1
  }, [])

  // ── Pointer handlers for cross-row drag selection ─────────────────────
  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return
    // Skip if a task is currently being edited
    if (tasksInnerRef.current?.querySelector('textarea:focus')) return
    const idx = getRowIdxFromY(e.clientY)
    if (idx === -1) return
    dragAnchorRef.current = { idx, active: false }
  }, [getRowIdxFromY])

  const handlePointerMove = useCallback((e) => {
    if (!(e.buttons & 1) || !dragAnchorRef.current) return
    const curIdx = getRowIdxFromY(e.clientY)
    if (curIdx === -1) return
    if (curIdx !== dragAnchorRef.current.idx || dragAnchorRef.current.active) {
      if (!dragAnchorRef.current.active) {
        dragAnchorRef.current.active = true
        // Apply user-select:none only during drag (direct DOM — no React re-render needed)
        tasksInnerRef.current?.classList.add(styles.tasksSelecting)
      }
      setRowSel({ anchor: dragAnchorRef.current.idx, focus: curIdx })
      try { window.getSelection().removeAllRanges() } catch {}
    }
  }, [getRowIdxFromY])

  const handlePointerUp = useCallback(() => {
    tasksInnerRef.current?.classList.remove(styles.tasksSelecting)
    // Plain click (not a cross-row drag) → clear selection
    if (dragAnchorRef.current && !dragAnchorRef.current.active) {
      setRowSel(null)
    }
    dragAnchorRef.current = null
  }, [])

  // ── Keyboard delete / escape while selection is active ───────────────
  useEffect(() => {
    if (!rowSel) return
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setRowSel(null)
        return
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        const lo = Math.min(rowSel.anchor, rowSel.focus)
        const hi = Math.max(rowSel.anchor, rowSel.focus)
        const rows = [...(tasksInnerRef.current?.querySelectorAll('.taskRow') ?? [])]
        const ids = rows.slice(lo, hi + 1).map(el => el.dataset.taskId).filter(Boolean)
        if (ids.length) onDeleteSelected?.(ids)
        setRowSel(null)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [rowSel, onDeleteSelected])

  // ─────────────────────────────────────────────────────────────────────

  if (!tasks.length) return null

  const sorted = [...tasks].sort((a, b) =>
    (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
  )

  const selLo = rowSel ? Math.min(rowSel.anchor, rowSel.focus) : -1
  const selHi = rowSel ? Math.max(rowSel.anchor, rowSel.focus) : -1

  return (
    <section
      ref={sectionRef}
      className={`${styles.section} ${isDragTarget ? styles.dragTarget : ''}`}
    >
      <div className={styles.header} onClick={toggle}>
        <span className={styles.name}>{category.toLowerCase()}</span>
        <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
            <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </div>

      <div className={styles.divider} />

      <div className={`${styles.tasksWrap} ${isOpen ? styles.tasksOpen : ''}`}>
        <div
          ref={tasksInnerRef}
          className={styles.tasksInner}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {sorted.map((task, idx) => (
            <div
              key={task.id}
              className={completingTaskIds?.has(task.id) ? styles.exitShell : undefined}
            >
              <TaskItem
                task={task}
                index={idx}
                onComplete={onComplete}
                onPriorityChange={onPriorityChange}
                onCategoryChange={onCategoryChange}
                onTextChange={onTextChange}
                onAddAfter={onAddAfter}
                onDragReady={onDragReady}
                isBeingDragged={task.id === draggingTaskId}
                isCompleting={completingTaskIds?.has(task.id)}
                autoFocus={task.id === newTaskId}
                isSelected={idx >= selLo && idx <= selHi}
              />
            </div>
          ))}
        </div>
        {isDragTarget && <div className={styles.dropIndicator} />}
      </div>
    </section>
  )
}
