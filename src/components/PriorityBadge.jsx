import { ChevronDownIcon } from './icons'
import styles from './PriorityBadge.module.css'

// Cycles: null → Urgent → Soon → Eventually → null
const CYCLE = [null, 'Urgent', 'Soon', 'Eventually']

export function PriorityBadge({ priority, onChange }) {
  const handleClick = (e) => {
    e.stopPropagation()
    const idx = CYCLE.indexOf(priority)
    const next = CYCLE[(idx + 1) % CYCLE.length]
    onChange(next)
  }

  if (!priority) {
    return (
      <button
        type="button"
        className={styles.badgeEmpty}
        onClick={handleClick}
        aria-label="Add urgency"
        title="Add urgency"
      >
        +
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`${styles.badge} ${styles[priority.toLowerCase()]}`}
      onClick={handleClick}
      aria-label={`${priority}. Change urgency`}
      title="Change urgency"
      data-aio-priority-badge
    >
      <span className={styles.label}>{priority.toLowerCase()}</span>
      <span className={styles.chevron} aria-hidden="true">
        <ChevronDownIcon />
      </span>
    </button>
  )
}
