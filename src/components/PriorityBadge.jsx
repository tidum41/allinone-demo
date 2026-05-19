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
        className={styles.badgeEmpty}
        onClick={handleClick}
        aria-label="Add priority"
      >
        +
      </button>
    )
  }

  return (
    <button
      className={`${styles.badge} ${styles[priority.toLowerCase()]}`}
      onClick={handleClick}
      aria-label={`Priority: ${priority}. Tap to change.`}
    >
      {priority.toLowerCase()}
    </button>
  )
}
