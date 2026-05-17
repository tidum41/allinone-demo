import { useState, useRef, useCallback, useEffect } from 'react'
import { Blob, makeTextLine } from './Blob'
import { ArchiveView } from './ArchiveView'
import styles from './NoteEditor.module.css'

function ChecklistIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="1" y="1" width="16" height="16" rx="3.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4.5 9.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function UndoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M3 7H11C13.209 7 15 8.791 15 11s-1.791 4-4 4H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 4L3 7L6 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function SidebarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="1.5" y="1.5" width="17" height="17" rx="3" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="7" y1="1.5" x2="7" y2="18.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}

function parseNoteLines(body) {
  if (!body) return [makeTextLine('')]
  try {
    const parsed = JSON.parse(body)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
  } catch {}
  return body.split('\n').map(makeTextLine)
}

export function NoteEditor({ note, onSave, onDelete, onBack, onSidebarOpen }) {
  const [title, setTitle] = useState(note?.title || '')
  const [lines, setLines] = useState(() => parseNoteLines(note?.body || ''))
  const [formatOpen, setFormatOpen] = useState(false)
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false })
  const debounceRef = useRef(null)
  const noteIdRef = useRef(note?.id || null)
  const blobRef = useRef(null)
  const aaRef = useRef(null)

  const isArchive = note?.title?.toLowerCase() === 'completed archive'

  // Track active formats at cursor position
  useEffect(() => {
    const handler = () => {
      try {
        setActiveFormats({
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline'),
        })
      } catch {}
    }
    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [])

  // Close format popover on outside click
  useEffect(() => {
    if (!formatOpen) return
    const handler = (e) => {
      if (aaRef.current && !aaRef.current.contains(e.target)) setFormatOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [formatOpen])

  const hasActiveFormat = activeFormats.bold || activeFormats.italic || activeFormats.underline
  const aaActive = formatOpen || hasActiveFormat

  const save = useCallback((t, l) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const id = await onSave(noteIdRef.current, t, JSON.stringify(l))
      if (id) noteIdRef.current = id
    }, 500)
  }, [onSave])

  const handleTitle = (e) => {
    setTitle(e.target.value)
    save(e.target.value, lines)
  }

  const handleLines = (newLines) => {
    setLines(newLines)
    save(title, newLines)
  }

  const handleDelete = () => {
    if (noteIdRef.current) onDelete(noteIdRef.current)
    onBack()
  }

  const applyFormat = (type) => {
    blobRef.current?.format(type)
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.menuBar}>
        <button className={styles.backBtn} onClick={onSidebarOpen} aria-label="Open notes">
          <SidebarIcon />
        </button>

        <input
          className={styles.titleInput}
          value={title}
          onChange={handleTitle}
          placeholder="untitled"
          aria-label="Note title"
          autoFocus
        />

        <div className={styles.actions}>
          {!isArchive && (
            <div ref={aaRef} className={styles.aaWrap}>
              <button
                className={`${styles.iconBtn} ${aaActive ? styles.iconBtnActive : ''}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => setFormatOpen(v => !v)}
                aria-label="Formatting"
                aria-expanded={formatOpen}
              >
                <span className={styles.aaLabel}>Aa</span>
              </button>
              {formatOpen && (
                <div className={styles.formatPopover}>
                  <button
                    className={`${styles.formatBtn} ${activeFormats.bold ? styles.formatBtnOn : ''}`}
                    onMouseDown={e => { e.preventDefault(); applyFormat('bold') }}
                    onTouchStart={e => e.preventDefault()}
                    onTouchEnd={e => { e.preventDefault(); applyFormat('bold') }}
                    aria-label="Bold"
                  >
                    <b>B</b>
                  </button>
                  <button
                    className={`${styles.formatBtn} ${styles.fmtItalic} ${activeFormats.italic ? styles.formatBtnOn : ''}`}
                    onMouseDown={e => { e.preventDefault(); applyFormat('italic') }}
                    onTouchStart={e => e.preventDefault()}
                    onTouchEnd={e => { e.preventDefault(); applyFormat('italic') }}
                    aria-label="Italic"
                  >
                    <i>I</i>
                  </button>
                  <button
                    className={`${styles.formatBtn} ${styles.fmtUnderline} ${activeFormats.underline ? styles.formatBtnOn : ''}`}
                    onMouseDown={e => { e.preventDefault(); applyFormat('underline') }}
                    onTouchStart={e => e.preventDefault()}
                    onTouchEnd={e => { e.preventDefault(); applyFormat('underline') }}
                    aria-label="Underline"
                  >
                    <u>U</u>
                  </button>
                </div>
              )}
            </div>
          )}
          {!isArchive && (
            <button
              className={styles.iconBtn}
              onClick={() => blobRef.current?.toggleChecklist()}
              aria-label="Toggle checklist"
            >
              <ChecklistIcon />
            </button>
          )}
          <button
            className={styles.iconBtn}
            onClick={() => document.execCommand('undo')}
            aria-label="Undo"
          >
            <UndoIcon />
          </button>
          <button className={styles.deleteBtn} onClick={handleDelete}>delete</button>
        </div>
      </header>

      {isArchive
        ? <ArchiveView lines={lines} />
        : <Blob ref={blobRef} lines={lines} onChange={handleLines} disabled={false} />
      }
    </div>
  )
}
