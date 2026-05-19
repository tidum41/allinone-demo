import { useState, forwardRef, useImperativeHandle } from 'react'
import styles from './CompletedSection.module.css'

export const CompletedSection = forwardRef(function CompletedSection({ tasks = [], onUncheck }, ref) {
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem('cat-open-completed')
    return saved === null ? false : saved === 'true'
  })

  useImperativeHandle(ref, () => ({
    expand() {
      setIsOpen(true)
      localStorage.setItem('cat-open-completed', 'true')
    }
  }), [])

  const toggle = () => setIsOpen(v => {
    const next = !v
    localStorage.setItem('cat-open-completed', String(next))
    return next
  })

  if (tasks.length === 0) return null

  return (
    <section className={styles.section}>
      <div className={styles.header} onClick={toggle}>
        <span className={styles.name}>completed</span>
        <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
            <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </div>
      <div className={styles.divider} />
      <div className={`${styles.tasksWrap} ${isOpen ? styles.tasksOpen : ''}`}>
        <div className={styles.tasksInner}>
          {[...tasks].reverse().map((task, i) => (
            <div key={task.id || i} className={styles.item} style={i === 0 ? undefined : { animation: 'none' }}>
              <button
                className={styles.checkbox}
                onClick={() => onUncheck(task)}
                aria-label="Uncheck task"
              >
                <span className={styles.squareFilled} />
              </button>
              <div className={styles.textRow}>
                <span className={styles.text}>{task.text}</span>
                {task.dateCompleted && (
                  <span className={styles.date}>
                    {new Date(task.dateCompleted).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
})
