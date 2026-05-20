import { useState, useRef, useCallback, useEffect } from 'react'
import { Blob, makeTextLine } from './Blob'
import { ArchiveView } from './ArchiveView'
import styles from './NoteEditor.module.css'

// Matches the empty-square icon used in the main MenuBar
function ChecklistIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
      <rect x="1" y="1" width="16" height="16" rx="3.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}

function BulletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
      <circle cx="3" cy="5" r="1.5" fill="currentColor"/>
      <line x1="7" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="3" cy="10" r="1.5" fill="currentColor"/>
      <line x1="7" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="3" cy="15" r="1.5" fill="currentColor"/>
      <line x1="7" y1="15" x2="17" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <rect x="1.5" y="1.5" width="17" height="17" rx="3" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="7" y1="1.5" x2="7" y2="18.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}

function parseNoteLines(body) {
  if (!body) return [makeTextLine('')]
  try {
    const parsed = JSON.parse(body)
    if (Array.isArray(parsed)) return parsed.length > 0 ? parsed : [makeTextLine('')]
  } catch {}
  return body.split('\n').map(makeTextLine)
}

export function NoteEditor({ note, onSave, onDelete, onBack, onSidebarOpen, isSidebarOpen }) {
  const [title, setTitle] = useState(note?.title || '')
  const [lines, setLines] = useState(() => parseNoteLines(note?.body || ''))
  const [formatOpen, setFormatOpen] = useState(false)
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false })
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const debounceRef = useRef(null)
  const noteIdRef = useRef(note?.id || null)
  const blobRef = useRef(null)
  const aaRef = useRef(null)
  const deleteWrapRef = useRef(null)
  const deleteConfirmTimerRef = useRef(null)

  const isArchive = note?.title?.toLowerCase() === 'completed archive'

  const refreshFormats = useCallback(() => {
    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
      })
    } catch {}
  }, [])

  // Track active formats at cursor position
  useEffect(() => {
    document.addEventListener('selectionchange', refreshFormats)
    return () => document.removeEventListener('selectionchange', refreshFormats)
  }, [refreshFormats])

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

  // Auto-reset delete confirm on outside click or after 4s
  useEffect(() => {
    if (!deleteConfirm) return
    const handler = (e) => {
      if (deleteWrapRef.current && !deleteWrapRef.current.contains(e.target)) {
        setDeleteConfirm(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler, { passive: true })
    deleteConfirmTimerRef.current = setTimeout(() => setDeleteConfirm(false), 4000)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
      clearTimeout(deleteConfirmTimerRef.current)
    }
  }, [deleteConfirm])

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

  const handleDeletePress = () => {
    setDeleteConfirm(v => !v)
  }

  const handleDeleteConfirm = () => {
    if (noteIdRef.current) onDelete(noteIdRef.current)
    onBack()
  }

  const applyFormat = (type) => {
    blobRef.current?.format(type)
    requestAnimationFrame(refreshFormats)
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.menuBar}>
        <button className={`${styles.backBtn} ${isSidebarOpen ? styles.backBtnActive : ''}`} onClick={onSidebarOpen} aria-label="Open notes">
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
                    className={`${styles.formatBtn} ${activeFormats.italic ? styles.formatBtnOn : ''}`}
                    onMouseDown={e => { e.preventDefault(); applyFormat('italic') }}
                    onTouchStart={e => e.preventDefault()}
                    onTouchEnd={e => { e.preventDefault(); applyFormat('italic') }}
                    aria-label="Italic"
                  >
                    <span className={styles.fmtItalicLabel}>I</span>
                  </button>
                  <button
                    className={`${styles.formatBtn} ${activeFormats.underline ? styles.formatBtnOn : ''}`}
                    onMouseDown={e => { e.preventDefault(); applyFormat('underline') }}
                    onTouchStart={e => e.preventDefault()}
                    onTouchEnd={e => { e.preventDefault(); applyFormat('underline') }}
                    aria-label="Underline"
                  >
                    <span className={styles.fmtUnderlineLabel}>U</span>
                  </button>
                </div>
              )}
            </div>
          )}
          {!isArchive && (
            <button
              className={styles.iconBtn}
              onMouseDown={e => e.preventDefault()}
              onClick={() => blobRef.current?.toggleBullet()}
              aria-label="Toggle bullet"
            >
              <BulletIcon />
            </button>
          )}
          {!isArchive && (
            <button
              className={styles.iconBtn}
              onMouseDown={e => e.preventDefault()}
              onClick={() => blobRef.current?.toggleChecklist()}
              aria-label="Toggle checklist"
            >
              <ChecklistIcon />
            </button>
          )}
          <button
            className={styles.iconBtn}
            onClick={() => { const el = blobRef.current; if (el?.undo) el.undo(); else document.execCommand('undo') }}
            aria-label="Undo"
          >
            <UndoIcon />
          </button>
          <div ref={deleteWrapRef} className={styles.deleteWrap}>
            {deleteConfirm && (
              <div className={styles.deletePopover}>
                <span className={styles.deletePopoverLabel}>delete note?</span>
                <button
                  className={styles.deletePopoverConfirm}
                  onMouseDown={e => e.preventDefault()}
                  onClick={handleDeleteConfirm}
                >
                  confirm
                </button>
              </div>
            )}
            <button
              className={`${styles.deleteBtn} ${deleteConfirm ? styles.deleteBtnActive : ''}`}
              onMouseDown={e => e.preventDefault()}
              onClick={handleDeletePress}
            >
              delete
            </button>
          </div>
        </div>
      </header>

      {isArchive
        ? <ArchiveView lines={lines} />
        : <Blob ref={blobRef} lines={lines} onChange={handleLines} disabled={false} />
      }
    </div>
  )
}
