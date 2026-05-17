import styles from './SkeletonLoader.module.css'

// Each section mirrors a real CategorySection: dot + name, divider, task rows
// Text is replaced with █ block characters at the same font-size — they
// inherit line-height automatically and flow exactly like the real content.
const SECTIONS = [
  {
    cat: 6,
    rows: [
      { len: 24, badge: true },
      { len: 17, badge: false },
      { len: 22, badge: true },
    ],
  },
  {
    cat: 14,
    rows: [
      { len: 20, badge: false },
      { len: 28, badge: true },
    ],
  },
  {
    cat: 11,
    rows: [
      { len: 18, badge: false },
      { len: 25, badge: true },
      { len: 14, badge: false },
    ],
  },
]

function SkeletonRow({ len, badge }) {
  return (
    <div className={styles.row}>
      <span className={styles.checkWrap}>
        <span className={styles.sq} />
      </span>
      <span className={styles.textArea}>
        <span className={styles.blk}>{'█'.repeat(len)}</span>
      </span>
      {badge && <span className={styles.badgePill} />}
    </div>
  )
}

function SkeletonSection({ cat, rows }) {
  return (
    <div className={styles.section}>
      <div className={styles.head}>
        <span className={`${styles.blk} ${styles.catBlk}`}>{'█'.repeat(cat)}</span>
      </div>
      <div className={styles.divider} />
      {rows.map((r, i) => (
        <SkeletonRow key={i} {...r} />
      ))}
    </div>
  )
}

export function SkeletonLoader() {
  return (
    <div className={styles.wrap} aria-label="Sorting…" aria-busy="true">
      {SECTIONS.map((s, i) => (
        <SkeletonSection key={i} {...s} />
      ))}
    </div>
  )
}
