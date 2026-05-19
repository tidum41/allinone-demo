import { useEffect, useState } from 'react'
import styles from './Sidebar.module.css'

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M14 10.8A7 7 0 0 1 5.2 2 7 7 0 1 0 14 10.8z"
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
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="8" y1="1" x2="8" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8" y1="13" x2="8" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="1" y1="8" x2="3" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="13" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="3.05" y1="3.05" x2="4.46" y2="4.46" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="11.54" y1="11.54" x2="12.95" y2="12.95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="12.95" y1="3.05" x2="11.54" y2="4.46" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="4.46" y1="11.54" x2="3.05" y2="12.95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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
            <span className={styles.mainEntryTitle}>all in one</span>
          </button>

          <div className={styles.divider} />

          <div className={styles.notesList}>
            {notes.length === 0 ? (
              <p className={styles.empty}>no other notes yet.</p>
            ) : (
              notes.map(note => (
                <button
                  key={note.id}
                  className={styles.noteItem}
                  onClick={() => { onSelectNote(note); onClose() }}
                >
                  <span className={styles.noteTitle}>{note.title || 'untitled'}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.newBtn} onClick={() => { onCreate(); onClose() }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            new note
          </button>

          <button className={styles.themeBtn} onClick={toggleTheme} aria-label="Toggle dark mode">
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </nav>
  )
}
