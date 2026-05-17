import styles from './NotesList.module.css'

export function NotesList({ notes, onSelect, onCreate, onBack }) {
  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button className={styles.back} onClick={onBack} aria-label="Back">‹</button>
        <span className={styles.title}>Notes</span>
        <button className={styles.create} onClick={onCreate} aria-label="New note">+</button>
      </header>
      <div className={styles.list}>
        {notes.length === 0 ? (
          <p className={styles.empty}>No notes yet. Tap + to create one.</p>
        ) : (
          notes.map(note => (
            <button
              key={note.id}
              className={styles.item}
              onClick={() => onSelect(note)}
            >
              <span className={styles.noteTitle}>
                {note.title || 'Untitled'}
              </span>
              <span className={styles.noteDate}>
                {note.updatedAt
                  ? new Date(note.updatedAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric'
                    })
                  : ''}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
