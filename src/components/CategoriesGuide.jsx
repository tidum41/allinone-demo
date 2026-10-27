import styles from './CategoriesGuide.module.css'

export function CategoriesGuide({ onEdit }) {
  return (
    <p className={styles.guide} data-aio-enter="guide">
      Sort groups tasks by your categories.{' '}
      <button type="button" className={styles.link} onClick={onEdit}>
        Edit categories
      </button>
    </p>
  )
}
