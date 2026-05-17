import styles from './PriorityBadge.module.css'

const CYCLE = ['Urgent', 'Soon', 'Eventually']

export function PriorityBadge({ priority, onChange }) {
  if (!priority) return null

  const handleClick = (e) => {
    e.stopPropagation()
    const idx = CYCLE.indexOf(priority)
    const next = CYCLE[(idx + 1) % CYCLE.length]
    onChange(next)
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
