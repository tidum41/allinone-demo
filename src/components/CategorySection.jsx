import { useState } from 'react'
import { TaskItem } from './TaskItem'
import styles from './CategorySection.module.css'

const PRIORITY_ORDER = { Urgent: 0, Soon: 1, Eventually: 2 }

export function CategorySection({
  category, tasks,
  onComplete, onPriorityChange, onCategoryChange, onTextChange,
  // completing animation props
  completingTaskIds,
  // drag props
  sectionRef, isDragTarget, draggingTaskId, onDragReady,
}) {
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem(`cat-open-${category}`)
    return saved === null ? true : saved === 'true'
  })

  const toggle = () => setIsOpen(v => {
    const next = !v
    localStorage.setItem(`cat-open-${category}`, String(next))
    return next
  })

  if (!tasks.length) return null

  const sorted = [...tasks].sort((a, b) =>
    (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
  )

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
        <div className={styles.tasksInner}>
          {sorted.map((task, idx) => (
            // exitShell collapses height to 0 while TaskItem fades, so siblings
            // smoothly close the gap instead of jumping when the DOM node is removed
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
                onDragReady={onDragReady}
                isBeingDragged={task.id === draggingTaskId}
                isCompleting={completingTaskIds?.has(task.id)}
              />
            </div>
          ))}
        </div>
        {isDragTarget && <div className={styles.dropIndicator} />}
      </div>
    </section>
  )
}
