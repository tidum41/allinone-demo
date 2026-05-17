import styles from './ReassignMenu.module.css'

const CATEGORIES = [
  { name: 'School', colorVar: '--color-school' },
  { name: 'Product Design', colorVar: '--color-product-design' },
  { name: 'Involvement', colorVar: '--color-involvement' },
  { name: 'Home', colorVar: '--color-home' },
  { name: 'Personal', colorVar: '--color-personal' },
  { name: 'Thinking', colorVar: '--color-thinking' },
]

export function ReassignMenu({ task, onSelect, onClose }) {
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className={styles.sheet} role="dialog" aria-label="Reassign category">
        <div className={styles.handle} />
        <p className={styles.label}>Move to…</p>
        {CATEGORIES.map(cat => (
          <button
            key={cat.name}
            className={`${styles.row} ${task.category === cat.name ? styles.active : ''}`}
            onClick={() => onSelect(cat.name)}
          >
            <span
              className={styles.dot}
              style={{ background: `var(${cat.colorVar})` }}
            />
            {cat.name}
          </button>
        ))}
      </div>
    </>
  )
}
