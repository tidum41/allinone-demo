import { useEffect, useState } from 'react'
import { NotebookIcon, NoteIcon, PlusIcon } from './icons'
import styles from './Sidebar.module.css'

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M12.75 10.1A5.75 5.75 0 0 1 5.9 3.25 5.75 5.75 0 1 0 12.75 10.1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="8" y1="1.5" x2="8" y2="3.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8" y1="12.75" x2="8" y2="14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="1.5" y1="8" x2="3.25" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="12.75" y1="8" x2="14.5" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="3.2" y1="3.2" x2="4.4" y2="4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="11.6" y1="11.6" x2="12.8" y2="12.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="12.8" y1="3.2" x2="11.6" y2="4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="4.4" y1="11.6" x2="3.2" y2="12.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function Sidebar({ open, onClose, notes, onSelectNote, onCreate, onSelectMain }) {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark'
  )

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const toggleTheme = () => {
    const next = !isDark
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
    localStorage.setItem('theme', next ? 'dark' : 'light')
    setIsDark(next)
  }

  return (
    <nav className={styles.sidebar} aria-label="Notes" aria-hidden={!open}>
        <div className={styles.inner}>
          <button className={styles.mainEntry} onClick={() => { onSelectMain(); onClose() }}>
            <span className={styles.entryIcon}><NotebookIcon /></span>
            <span className={styles.mainEntryTitle}>All in one</span>
          </button>

          <div className={styles.divider} />

          <div className={styles.notesList}>
            {notes.length === 0 ? (
              <p className={styles.empty}>No other notes yet.</p>
            ) : (
              notes.map(note => (
                <button
                  key={note.id}
                  className={styles.noteItem}
                  onClick={() => { onSelectNote(note); onClose() }}
                >
                  <span className={styles.entryIcon}><NoteIcon /></span>
                  <span className={styles.noteTitle}>{note.title || 'Untitled'}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.newBtn} onClick={() => { onCreate(); onClose() }}>
            <PlusIcon />
            New note
          </button>

          <button className={styles.themeBtn} onClick={toggleTheme} aria-label="Toggle dark mode">
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </nav>
  )
}
