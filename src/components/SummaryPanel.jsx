import styles from './SummaryPanel.module.css'

function isToday(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

function isBeforeToday(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return d < today
}

export function SummaryPanel({ tasks, onClose }) {
  const addedToday = tasks.filter(t => isToday(t.dateAdded))
  const urgent = tasks.filter(t => t.priority === 'Urgent')
  const incomplete = tasks.filter(t =>
    (t.priority === 'Urgent' || t.priority === 'Soon') && isBeforeToday(t.dateAdded)
  )

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className={styles.sheet} role="dialog" aria-label="Summary">
        <div className={styles.handle} />
        <div className={styles.titleRow}>
          <span className={styles.title}>Summary</span>
          <button className={styles.close} onClick={onClose}>Done</button>
        </div>

        <div className={styles.content}>
          <SummarySection label="Added today" tasks={addedToday} />
          <SummarySection label="Urgent" tasks={urgent} />
          <SummarySection label="Incomplete" tasks={incomplete} empty="All caught up." />
        </div>
      </div>
    </>
  )
}

function SummarySection({ label, tasks, empty = 'None.' }) {
  return (
    <div className={styles.section}>
      <p className={styles.sectionLabel}>{label}</p>
      {tasks.length === 0 ? (
        <p className={styles.empty}>{empty}</p>
      ) : (
        tasks.map((t, i) => (
          <div key={t.id || i} className={styles.item}>
            <span className={styles.cat}>{t.category}</span>
            <span className={styles.text}>{t.text}</span>
          </div>
        ))
      )}
    </div>
  )
}
