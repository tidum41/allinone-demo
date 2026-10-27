import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CATEGORY_COLORS,
  makeCategoryId,
  nextCategoryColor,
  sentenceCaseName,
  UNSORTED_NAME,
} from '../lib/categories'
import { CloseIcon, MoreIcon, TrashIcon } from './icons'
import styles from './CategoriesPanel.module.css'

const MOBILE_MQ = '(max-width: 680px)'
const PUSH_MQ = '(min-width: 1100px)'
const MEDIUM_VH = 0.52
const LARGE_VH = 0.92

function useMedia(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

function autoSize(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

export function CategoriesPanel({
  open,
  categories,
  onChange,
  onReassignTasks,
  onClose,
  onDeleted,
  onUndoDelete,
  deleteToast,
  onDismissToast,
}) {
  const isMobile = useMedia(MOBILE_MQ)
  const canPush = useMedia(PUSH_MQ)
  const layout = isMobile ? 'sheet' : canPush ? 'push' : 'overlay'

  const [paletteId, setPaletteId] = useState(null)
  const [menuId, setMenuId] = useState(null)
  const [menuPos, setMenuPos] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [detent, setDetent] = useState('medium') // medium | large
  const [sheetHeight, setSheetHeight] = useState(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [swipeX, setSwipeX] = useState({})
  const sheetRef = useRef(null)
  const dragRef = useRef(null)
  const nameRefs = useRef({})
  const moreBtnRefs = useRef({})

  const openMenu = useCallback((id) => {
    const btn = moreBtnRefs.current[id]
    if (!btn) {
      setMenuId(id)
      return
    }
    const r = btn.getBoundingClientRect()
    const menuH = categories.length > 1 ? 80 : 44
    const top = r.bottom + 4 + menuH > window.innerHeight
      ? Math.max(8, r.top - menuH - 4)
      : r.bottom + 4
    const left = Math.max(8, r.right - 132)
    setMenuPos({ top, left })
    setMenuId(id)
    setPaletteId(null)
  }, [categories.length])

  const targetHeight = useCallback((which) => {
    const vh = window.innerHeight
    return Math.round(vh * (which === 'large' ? LARGE_VH : MEDIUM_VH))
  }, [])

  useEffect(() => {
    if (!open) {
      setPaletteId(null)
      setMenuId(null)
      setMenuPos(null)
      setConfirm(null)
      setSwipeX({})
      setDetent('medium')
      setSheetHeight(null)
      setDragOffset(0)
      document.documentElement.removeAttribute('data-categories-open')
      return
    }
    document.documentElement.setAttribute('data-categories-open', '')
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (confirm) setConfirm(null)
        else if (menuId) {
          setMenuId(null)
          setMenuPos(null)
        } else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.documentElement.removeAttribute('data-categories-open')
    }
  }, [open, confirm, menuId, onClose])

  useEffect(() => {
    if (!open || !isMobile) return
    setSheetHeight(targetHeight(detent))
    setDragOffset(0)
  }, [open, isMobile, detent, targetHeight])

  const patch = useCallback((id, partial) => {
    onChange(categories.map((c) => (c.id === id ? { ...c, ...partial } : c)))
  }, [categories, onChange])

  const commitName = useCallback((id, raw) => {
    const next = sentenceCaseName(raw)
    const current = categories.find((c) => c.id === id)
    if (!current) return
    if (!next) {
      patch(id, { name: current.name })
      return
    }
    if (current.name === next) {
      if (current.name !== raw) patch(id, { name: current.name })
      return
    }
    onChange(categories.map((c) => (c.id === id ? { ...c, name: next } : c)))
    onReassignTasks?.(current.name, next)
  }, [categories, onChange, onReassignTasks, patch])

  const addCategory = () => {
    const color = nextCategoryColor(categories)
    const cat = {
      id: makeCategoryId(),
      name: 'New category',
      color,
      description: '',
    }
    onChange([...categories, cat])
    setPaletteId(null)
    setMenuId(null)
    requestAnimationFrame(() => {
      nameRefs.current[cat.id]?.focus()
      nameRefs.current[cat.id]?.select()
    })
  }

  const requestDelete = (cat) => {
    if (categories.length <= 1) return
    setMenuId(null)
    setMenuPos(null)
    setConfirm({ id: cat.id, name: cat.name })
  }

  useEffect(() => {
    if (!menuId) return
    const onDown = (e) => {
      if (e.target.closest?.('[data-aio-cat-menu]') || e.target.closest?.('[data-aio-cat-more]')) return
      setMenuId(null)
      setMenuPos(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [menuId])

  const performDelete = () => {
    if (!confirm) return
    const { id, name } = confirm
    if (categories.length <= 1) {
      setConfirm(null)
      return
    }
    const snapshot = categories.map((c) => ({ ...c }))
    const removed = categories.find((c) => c.id === id)
    onReassignTasks?.(name, UNSORTED_NAME)
    onChange(categories.filter((c) => c.id !== id))
    setConfirm(null)
    setSwipeX((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    onDeleted?.({ removed, snapshot })
  }

  const onGrabberPointerDown = (e) => {
    if (!isMobile) return
    const base = sheetHeight ?? targetHeight(detent)
    dragRef.current = {
      kind: 'sheet',
      startY: e.clientY,
      originH: base,
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onGrabberPointerMove = (e) => {
    const d = dragRef.current
    if (!d || d.kind !== 'sheet') return
    const delta = d.startY - e.clientY
    const medium = targetHeight('medium')
    const large = targetHeight('large')
    const next = Math.max(medium - 80, Math.min(large, d.originH + delta))
    setSheetHeight(next)
    setDragOffset(0)
  }

  const onGrabberPointerUp = () => {
    const d = dragRef.current
    if (!d || d.kind !== 'sheet') return
    dragRef.current = null
    const medium = targetHeight('medium')
    const large = targetHeight('large')
    const h = sheetHeight ?? medium
    if (h < medium - 48) {
      onClose()
      return
    }
    const nextDetent = h > (medium + large) / 2 ? 'large' : 'medium'
    setDetent(nextDetent)
    setSheetHeight(targetHeight(nextDetent))
  }

  const bindSwipe = (id) => ({
    onTouchStart: (e) => {
      if (!isMobile) return
      const t = e.touches[0]
      dragRef.current = {
        kind: 'swipe',
        id,
        startX: t.clientX,
        startY: t.clientY,
        origin: swipeX[id] || 0,
        locked: null,
      }
    },
    onTouchMove: (e) => {
      const d = dragRef.current
      if (!d || d.kind !== 'swipe' || d.id !== id) return
      const t = e.touches[0]
      const dx = t.clientX - d.startX
      const dy = t.clientY - d.startY
      if (d.locked === null) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
        d.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      }
      if (d.locked !== 'x') return
      e.preventDefault()
      const next = Math.max(-72, Math.min(0, d.origin + dx))
      setSwipeX((prev) => ({ ...prev, [id]: next }))
    },
    onTouchEnd: () => {
      const d = dragRef.current
      if (!d || d.kind !== 'swipe' || d.id !== id) return
      dragRef.current = null
      const cur = swipeX[id] || 0
      const openSwipe = cur < -36
      setSwipeX((prev) => ({ ...prev, [id]: openSwipe ? -72 : 0 }))
    },
  })

  const showDesktopRail = !isMobile
  if (!open && !deleteToast && !showDesktopRail) return null

  const body = (withClose) => (
    <>
      <header className={styles.header}>
        <h1 className={styles.title} data-aio-cat-title>Categories</h1>
        {withClose && (
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Close categories"
            data-aio-cat-close
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        )}
      </header>
      <p className={styles.purpose} data-aio-cat-purpose>
        Describe what goes in each category. Sort reads these lines to place your tasks.
      </p>
      <div className={styles.list} role="list">
        {categories.map((cat) => {
          const dx = swipeX[cat.id] || 0
          return (
            <div key={cat.id} className={styles.rowShell} role="listitem">
              {categories.length > 1 && (
                <button
                  type="button"
                  className={styles.swipeAction}
                  aria-label={`Delete ${cat.name}`}
                  onClick={() => requestDelete(cat)}
                >
                  Delete
                </button>
              )}
              <div
                className={styles.row}
                data-aio-cat-row
                style={{ transform: `translateX(${dx}px)` }}
                {...bindSwipe(cat.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  openMenu(cat.id)
                }}
              >
                <button
                  type="button"
                  className={styles.swatch}
                  aria-label={`Colour for ${cat.name}`}
                  data-aio-cat-swatch
                  onClick={() => {
                    setPaletteId((v) => (v === cat.id ? null : cat.id))
                    setMenuId(null)
                  }}
                >
                  <span className={styles.swatchDot} data-aio-cat-dot style={{ background: cat.color }} />
                </button>
                <div className={styles.fields}>
                  <input
                    ref={(el) => { nameRefs.current[cat.id] = el }}
                    className={styles.nameInput}
                    value={cat.name}
                    aria-label="Category name"
                    spellCheck={false}
                    data-aio-cat-name
                    onChange={(e) => patch(cat.id, { name: e.target.value })}
                    onBlur={(e) => commitName(cat.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        e.currentTarget.blur()
                      }
                    }}
                  />
                  <textarea
                    className={styles.descInput}
                    value={cat.description || ''}
                    aria-label={`Description for ${cat.name}`}
                    placeholder="Things that belong here, like readings or quizzes"
                    rows={1}
                    data-aio-cat-desc
                    onChange={(e) => {
                      patch(cat.id, { description: e.target.value })
                      autoSize(e.target)
                    }}
                    ref={(el) => autoSize(el)}
                  />
                  {paletteId === cat.id && (
                    <div className={styles.palette} role="group" aria-label="Choose colour">
                      {CATEGORY_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`${styles.paletteSwatch} ${cat.color === color ? styles.paletteSwatchActive : ''}`}
                          style={{ background: color }}
                          aria-label={`Use colour ${color}`}
                          onClick={() => {
                            patch(cat.id, { color })
                            setPaletteId(null)
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.moreBtn}
                    aria-label={`Actions for ${cat.name}`}
                    aria-expanded={menuId === cat.id}
                    aria-haspopup="menu"
                    data-aio-cat-more
                    ref={(el) => { moreBtnRefs.current[cat.id] = el }}
                    onClick={() => {
                      if (menuId === cat.id) {
                        setMenuId(null)
                        setMenuPos(null)
                      } else {
                        openMenu(cat.id)
                      }
                    }}
                  >
                    <MoreIcon />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        <button type="button" className={styles.addRow} data-aio-cat-add onClick={addCategory}>
          <span className={styles.addPlus} data-aio-cat-add-plus aria-hidden="true">+</span>
          <span className={styles.addLabel} data-aio-cat-add-label>Add category</span>
        </button>
      </div>

      {confirm && (
        <div
          className={styles.confirmScrim}
          role="presentation"
          onClick={() => setConfirm(null)}
        >
          <div
            className={styles.confirm}
            role="dialog"
            aria-label="Delete category"
            onClick={(e) => e.stopPropagation()}
          >
            <p className={styles.confirmText}>
              {`Delete ${confirm.name}? Its tasks move to Unsorted.`}
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmCancel}
                onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmDelete}
                onClick={performDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  return (
    <>
      {isMobile && open && (
        <>
          <div
            className={styles.backdrop}
            onClick={onClose}
            aria-hidden="true"
          />
          <div
            ref={sheetRef}
            className={styles.sheet}
            role="dialog"
            aria-label="Categories"
            data-aio-cat-layout="sheet"
            style={{
              height: sheetHeight ?? targetHeight('medium'),
              transform: dragOffset ? `translateY(${dragOffset}px)` : undefined,
            }}
          >
            <div
              className={styles.grabberWrap}
              aria-hidden="true"
              onPointerDown={onGrabberPointerDown}
              onPointerMove={onGrabberPointerMove}
              onPointerUp={onGrabberPointerUp}
              onPointerCancel={onGrabberPointerUp}
            >
              <div className={styles.grabber} />
            </div>
            {body(false)}
          </div>
        </>
      )}

      {showDesktopRail && layout === 'push' && (
        <div
          className={`${styles.railSlot} ${open ? styles.railSlotOpen : ''}`}
          aria-hidden={!open}
        >
          <aside
            className={styles.rail}
            role={open ? 'dialog' : undefined}
            aria-label={open ? 'Categories' : undefined}
            data-aio-cat-layout="push"
            {...(!open ? { inert: '' } : {})}
          >
            {open ? body(true) : null}
          </aside>
        </div>
      )}

      {showDesktopRail && layout === 'overlay' && open && (
        <>
          <div
            className={styles.overlayScrim}
            onClick={onClose}
            aria-hidden="true"
          />
          <aside
            className={`${styles.rail} ${styles.railOverlay}`}
            role="dialog"
            aria-label="Categories"
            data-aio-cat-layout="overlay"
          >
            {body(true)}
          </aside>
        </>
      )}

      {menuId && menuPos && createPortal(
        <div
          className={styles.menuPortal}
          role="menu"
          data-aio-cat-menu
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={() => {
              const id = menuId
              setMenuId(null)
              setMenuPos(null)
              setPaletteId(id)
              nameRefs.current[id]?.focus()
            }}
          >
            Edit
          </button>
          {categories.length > 1 && (
            <button
              type="button"
              role="menuitem"
              className={`${styles.menuItem} ${styles.menuItemDanger}`}
              onClick={() => {
                const cat = categories.find((c) => c.id === menuId)
                if (cat) requestDelete(cat)
              }}
            >
              <span className={styles.menuIcon}><TrashIcon /></span>
              Delete
            </button>
          )}
        </div>,
        document.body
      )}

      {deleteToast && (
        <div className={styles.toast} role="status" onClick={onDismissToast}>
          <span>Category deleted.</span>
          <button
            type="button"
            className={styles.toastUndo}
            onClick={(e) => {
              e.stopPropagation()
              onUndoDelete()
            }}
          >
            Undo
          </button>
        </div>
      )}
    </>
  )
}
