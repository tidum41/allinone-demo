import { useState, useEffect, useRef, useCallback } from 'react'
import {
  BulletIcon,
  CategoriesIcon,
  ChecklistIcon,
  SidebarIcon,
  UndoIcon,
} from './icons'
import styles from './MenuBar.module.css'

export function MenuBar({
  onSidebarOpen,
  onSort,
  onCategories,
  categoriesOpen,
  categoriesBtnRef,
  onChecklist,
  onBullet,
  onUndo,
  loading,
  sortDone,
  title,
  onFormat,
  isSidebarOpen,
  activeLineType,
}) {
  const [formatOpen, setFormatOpen] = useState(false)
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false })
  const aaRef = useRef(null)

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

  useEffect(() => {
    if (formatOpen) refreshFormats()
  }, [formatOpen, refreshFormats])

  const handleFormat = useCallback((type) => {
    onFormat?.(type)
    try {
      const isOn = document.queryCommandState(type)
      setActiveFormats(prev => ({ ...prev, [type]: isOn }))
    } catch {}
    requestAnimationFrame(refreshFormats)
  }, [onFormat, refreshFormats])

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

  return (
    <header className={styles.menuBar}>
      <div className={styles.left}>
        <button
          type="button"
          className={`${styles.sidebarBtn} ${isSidebarOpen ? styles.sidebarBtnActive : ''}`}
          onClick={onSidebarOpen}
          aria-label="Open notes"
          data-aio-sidebar-toggle
        >
          <SidebarIcon />
        </button>

        <span className={styles.title} data-aio-title>{title || 'All in one'}</span>
      </div>

      <div className={styles.actions}>
        <div className={styles.iconCluster}>
          <div ref={aaRef} className={styles.aaWrap}>
            <button
              type="button"
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
                  type="button"
                  className={`${styles.formatBtn} ${activeFormats.bold ? styles.formatBtnOn : ''}`}
                  onMouseDown={e => { e.preventDefault(); handleFormat('bold') }}
                  onTouchStart={e => e.preventDefault()}
                  onTouchEnd={e => { e.preventDefault(); handleFormat('bold') }}
                  aria-label="Bold"
                >
                  <b>B</b>
                </button>
                <button
                  type="button"
                  className={`${styles.formatBtn} ${activeFormats.italic ? styles.formatBtnOn : ''}`}
                  onMouseDown={e => { e.preventDefault(); handleFormat('italic') }}
                  onTouchStart={e => e.preventDefault()}
                  onTouchEnd={e => { e.preventDefault(); handleFormat('italic') }}
                  aria-label="Italic"
                >
                  <span className={styles.fmtItalicLabel}>I</span>
                </button>
                <button
                  type="button"
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

          <button
            type="button"
            className={styles.iconBtn}
            onClick={e => { onUndo(); e.currentTarget.blur() }}
            aria-label="Undo"
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${activeLineType === 'bullet' ? styles.iconBtnActive : ''}`}
            onMouseDown={e => e.preventDefault()}
            onClick={e => { onBullet(); e.currentTarget.blur() }}
            aria-label="Toggle bullet"
          >
            <BulletIcon />
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${activeLineType === 'check' ? styles.iconBtnActive : ''}`}
            onMouseDown={e => e.preventDefault()}
            onClick={e => { onChecklist(); e.currentTarget.blur() }}
            aria-label="Toggle checklist"
          >
            <ChecklistIcon />
          </button>
        </div>

        <button
          ref={categoriesBtnRef}
          type="button"
          className={`${styles.categoriesBtn} ${categoriesOpen ? styles.categoriesBtnActive : ''}`}
          onClick={onCategories}
          aria-label="Categories"
          aria-expanded={!!categoriesOpen}
          aria-pressed={!!categoriesOpen}
          data-aio-categories
        >
          <CategoriesIcon />
          <span className={styles.categoriesLabel}>Categories</span>
        </button>

        <button
          type="button"
          className={`${styles.sortBtn} ${loading ? styles.sorting : ''} ${sortDone ? styles.sortDone : ''}`}
          onClick={onSort}
          disabled={loading}
          data-aio-sort
        >
          <span key={loading ? 'l' : sortDone ? 'd' : 's'} className={styles.sortLabel}>
            {loading ? <span className={styles.spinner} /> : sortDone ? '✓' : 'Sort'}
          </span>
        </button>
      </div>
    </header>
  )
}
