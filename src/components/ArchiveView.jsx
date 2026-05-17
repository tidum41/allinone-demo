import styles from './CompletedSection.module.css'

// Renders the "completed archive" note body using the same visual style as CompletedSection.
// Each line is stored as makeTextLine with content like "Task name  ·  Apr 24".
export function ArchiveView({ lines }) {
  const entries = (lines || [])
    .filter(l => l.content?.trim())
    .map((l) => {
      const sep = '  ·  '
      const idx = l.content.indexOf(sep)
      if (idx !== -1) {
        return { id: l.id, text: l.content.slice(0, idx), date: l.content.slice(idx + sep.length) }
      }
      return { id: l.id, text: l.content, date: '' }
    })

  if (entries.length === 0) return null

  return (
    <div className={styles.section}>
      <div className={styles.tasksInner}>
        {entries.map((entry) => (
          <div key={entry.id} className={styles.item}>
            <span className={styles.checkbox} style={{ pointerEvents: 'none' }}>
              <span className={styles.squareFilled} />
            </span>
            <div className={styles.textRow}>
              <span className={styles.text}>{entry.text}</span>
              {entry.date && <span className={styles.date}>{entry.date}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
