import { useRef, useState, useCallback } from 'react'
import { CategorySection } from './CategorySection'
import { CompletedSection } from './CompletedSection'
import styles from './SortedView.module.css'

const CATEGORY_ORDER = ['School', 'Product Design', 'Involvement', 'Home', 'Personal', 'Thinking']

function formatLastSorted(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return `sorted today at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()}`
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'sorted yesterday'
  return `sorted ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

export function SortedView({ tasks, completingItems = {}, onComplete, onPriorityChange, onCategoryChange, onTextChange, onAddAfter, newTaskId, onDeleteSelected, completedTasks, onUncheck, completedSectionRef }) {
  const completingTaskIds = new Set(Object.keys(completingItems))

  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    const regular = tasks.filter(t => t.category === cat)
    // Append any completing items that belong to this category (still in 1.8s window)
    const completing = Object.values(completingItems).filter(t => t.category === cat)
    acc[cat] = [...regular, ...completing]
    return acc
  }, {})

  // ── Drag state ────────────────────────────────────────────────────
  const sectionRefs = useRef({})          // cat → section DOM el
  const dragStateRef = useRef(null)       // live drag data (no re-render)
  const [draggingTaskId, setDraggingTaskId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)  // category string | null

  const handleDragReady = useCallback((task, clientX, clientY, itemEl) => {
    if (!itemEl) return

    // Soft haptic on supported devices
    navigator.vibrate?.(30)

    const rect = itemEl.getBoundingClientRect()
    const offsetX = clientX - rect.left
    const offsetY = clientY - rect.top

    // Clone the item element as the drag ghost
    const ghost = itemEl.cloneNode(true)
    Object.assign(ghost.style, {
      position: 'fixed',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      minHeight: `${rect.height}px`,
      zIndex: '9999',
      pointerEvents: 'none',
      borderRadius: '10px',
      boxShadow: '0 16px 48px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
      transform: 'scale(1.04)',
      opacity: '0.97',
      transition: 'box-shadow 200ms ease, transform 200ms ease',
      background: 'var(--color-bg)',
      // Remove animation from cloned element
      animation: 'none',
    })
    document.body.appendChild(ghost)
    document.body.style.userSelect = 'none'
    document.body.style.webkitUserSelect = 'none'

    dragStateRef.current = { task, ghost, offsetX, offsetY, overCat: null }
    setDraggingTaskId(task.id)

    const detectDropTarget = (cx, cy) => {
      let found = null
      for (const [cat, el] of Object.entries(sectionRefs.current)) {
        if (!el || cat === task.category) continue // skip source section
        const r = el.getBoundingClientRect()
        if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
          found = cat
          break
        }
      }
      return found
    }

    const onMove = (e) => {
      const cx = e.clientX
      const cy = e.clientY
      const ds = dragStateRef.current
      if (!ds) return

      ghost.style.left = `${cx - offsetX}px`
      ghost.style.top  = `${cy - offsetY}px`

      const over = detectDropTarget(cx, cy)
      if (over !== ds.overCat) {
        ds.overCat = over
        setDropTarget(over)
      }
    }

    const endDrag = (e) => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', endDrag)
      document.removeEventListener('pointercancel', endDrag)
      document.body.style.userSelect = ''
      document.body.style.webkitUserSelect = ''

      // Fade ghost out
      ghost.style.transition = 'opacity 150ms ease, transform 150ms ease'
      ghost.style.opacity = '0'
      ghost.style.transform = 'scale(0.97)'
      setTimeout(() => ghost.remove(), 160)

      const finalCat = dragStateRef.current?.overCat
      const originalCat = task.category
      dragStateRef.current = null
      setDraggingTaskId(null)
      setDropTarget(null)

      if (finalCat && finalCat !== originalCat) {
        onCategoryChange(task, finalCat)
      }
    }

    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerup', endDrag)
    document.addEventListener('pointercancel', endDrag)
  }, [onCategoryChange])

  // ─────────────────────────────────────────────────────────────────

  if (!tasks.length && !completedTasks?.length) {
    return <p className={styles.empty}>add tasks above, then tap sort ↑</p>
  }

  const lastSortedLabel = formatLastSorted(localStorage.getItem('lastSortedAt'))

  return (
    <div className={styles.wrap}>
      {CATEGORY_ORDER.map(cat =>
        grouped[cat].length > 0 ? (
          <CategorySection
            key={cat}
            category={cat}
            tasks={grouped[cat]}
            completingTaskIds={completingTaskIds}
            onComplete={onComplete}
            onPriorityChange={onPriorityChange}
            onCategoryChange={onCategoryChange}
            onTextChange={onTextChange}
            onAddAfter={onAddAfter}
            newTaskId={newTaskId}
            onDeleteSelected={onDeleteSelected}
            sectionRef={el => { sectionRefs.current[cat] = el }}
            isDragTarget={dropTarget === cat}
            draggingTaskId={draggingTaskId}
            onDragReady={handleDragReady}
          />
        ) : null
      )}
      <CompletedSection ref={completedSectionRef} tasks={completedTasks} onUncheck={onUncheck} />
      {lastSortedLabel && (
        <p className={styles.sortedAt}>{lastSortedLabel}</p>
      )}
    </div>
  )
}
