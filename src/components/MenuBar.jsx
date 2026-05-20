import { useState, useEffect, useRef, useCallback } from 'react'
import styles from './MenuBar.module.css'

// Outlined square only — no checkmark
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
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
      <path d="M3 7H11C13.209 7 15 8.791 15 11s-1.791 4-4 4H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 4L3 7L6 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function SummaryIcon() {
  return (
    <svg width="16" height="13" viewBox="0 0 18 14" fill="none">
      <line x1="0.75" y1="1" x2="17.25" y2="1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="0.75" y1="7" x2="17.25" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="0.75" y1="13" x2="17.25" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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

export function MenuBar({ onSidebarOpen, onSort, onSummary, onChecklist, onBullet, onUndo, loading, sortDone, title, onFormat, isSidebarOpen, activeLineType }) {
  const [formatOpen, setFormatOpen] = useState(false)
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false })
  const aaRef = useRef(null)

  // Read actual format state from the DOM — only when selection is inside a contenteditable.
  // Called when the popover opens and after each format button click (via RAF).
  const refreshFormats = useCallback(() => {
    const sel = document.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const anchor = sel.anchorNode
    const el = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor
    if (!el?.closest?.('[contenteditable]')) return
    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
      })
    } catch {}
  }, [])

  // Refresh when the popover is opened so it shows correct state immediately
  useEffect(() => {
    if (formatOpen) refreshFormats()
  }, [formatOpen, refreshFormats])

  // After calling onFormat (which restores selection then runs execCommand),
  // read queryCommandState synchronously — selection is in the right place at this point.
  const handleFormat = useCallback((type) => {
    onFormat?.(type)
    try {
      const isOn = document.queryCommandState(type)
      setActiveFormats(prev => ({ ...prev, [type]: isOn }))
    } catch {}
    requestAnimationFrame(refreshFormats)
  }, [onFormat, refreshFormats])

  // Close popover on outside click / touch
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
  // Aa is "active" (filled) when popover is open OR a format is currently on
  const aaActive = formatOpen || hasActiveFormat

  return (
    <header className={styles.menuBar}>
      <button
        className={`${styles.sidebarBtn} ${isSidebarOpen ? styles.sidebarBtnActive : ''}`}
        onClick={onSidebarOpen}
        aria-label="Open notes"
      >
        <SidebarIcon />
      </button>

      <span className={styles.title}>{title || 'all in one'}</span>

      <div className={styles.actions}>
        {/* Aa format toggle */}
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
                onMouseDown={e => { e.preventDefault(); handleFormat('bold') }}
                onTouchStart={e => e.preventDefault()}
                onTouchEnd={e => { e.preventDefault(); handleFormat('bold') }}
                aria-label="Bold"
              >
                <b>B</b>
              </button>
              <button
                className={`${styles.formatBtn} ${activeFormats.italic ? styles.formatBtnOn : ''}`}
                onMouseDown={e => { e.preventDefault(); handleFormat('italic') }}
                onTouchStart={e => e.preventDefault()}
                onTouchEnd={e => { e.preventDefault(); handleFormat('italic') }}
                aria-label="Italic"
              >
                <span className={styles.fmtItalicLabel}>I</span>
              </button>
              <button
                className={`${styles.formatBtn} ${activeFormats.underline ? styles.formatBtnOn : ''}`}
                onMouseDown={e => { e.preventDefault(); handleFormat('underline') }}
                onTouchStart={e => e.preventDefault()}
                onTouchEnd={e => { e.preventDefault(); handleFormat('underline') }}
                aria-label="Underline"
              >
                <span className={styles.fmtUnderlineLabel}>U</span>
              </button>
            </div>
          )}
        </div>

        {/* Order: Aa · Bullet · Checklist · Undo · Sort — matches NoteEditor */}
        <button
          className={`${styles.iconBtn} ${activeLineType === 'bullet' ? styles.iconBtnActive : ''}`}
          onMouseDown={e => e.preventDefault()}
          onClick={e => { onBullet(); e.currentTarget.blur() }}
          aria-label="Toggle bullet"
        >
          <BulletIcon />
        </button>
        <button
          className={`${styles.iconBtn} ${activeLineType === 'check' ? styles.iconBtnActive : ''}`}
          onMouseDown={e => e.preventDefault()}
          onClick={e => { onChecklist(); e.currentTarget.blur() }}
          aria-label="Toggle checklist"
        >
          <ChecklistIcon />
        </button>
        <button
          className={styles.iconBtn}
          onClick={e => { onUndo(); e.currentTarget.blur() }}
          aria-label="Undo"
        >
          <UndoIcon />
        </button>

        <button
          className={`${styles.sortBtn} ${loading ? styles.sorting : ''} ${sortDone ? styles.sortDone : ''}`}
          onClick={onSort}
          disabled={loading}
        >
          <span key={loading ? 'l' : sortDone ? 'd' : 's'} className={styles.sortLabel}>
            {loading ? <span className={styles.spinner} /> : sortDone ? '✓' : 'sort'}
          </span>
        </button>
      </div>
    </header>
  )
}
