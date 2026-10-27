import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './PopoverMenu.module.css'

/**
 * Shared anchored menu — Categories ••• and urgency.
 * Enter: opacity + scale(0.95→1), transform-origin from trigger.
 * Keyboard: ArrowUp/Down, Home/End, Enter/Space, Escape (no motion on focus move).
 */
export function PopoverMenu({
  open,
  anchorRef,
  onClose,
  children,
  minWidth = 132,
  estimatedHeight = 160,
  align = 'end',
  menuRef: menuRefProp,
  'data-menu': dataMenu,
  className,
}) {
  const localRef = useRef(null)
  const menuRef = menuRefProp || localRef
  const [pos, setPos] = useState({ top: 0, left: 0, origin: 'top right', ready: false })
  const [entered, setEntered] = useState(false)

  useLayoutEffect(() => {
    if (!open || !anchorRef?.current) {
      setEntered(false)
      setPos((p) => ({ ...p, ready: false }))
      return
    }
    const r = anchorRef.current.getBoundingClientRect()
    const opensUp = r.bottom + 4 + estimatedHeight > window.innerHeight
    const top = opensUp
      ? Math.max(8, r.top - estimatedHeight - 4)
      : r.bottom + 4
    const left = align === 'end'
      ? Math.max(8, Math.min(r.right - minWidth, window.innerWidth - minWidth - 8))
      : Math.max(8, Math.min(r.left, window.innerWidth - minWidth - 8))
    const originX = align === 'end' ? 'right' : 'left'
    const originY = opensUp ? 'bottom' : 'top'
    setPos({ top, left, origin: `${originY} ${originX}`, ready: true })
    setEntered(false)
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true))
    })
    return () => cancelAnimationFrame(id)
  }, [open, anchorRef, align, minWidth, estimatedHeight])

  useEffect(() => {
    if (!open) return

    const itemSelector = '[role="menuitem"], [role="menuitemradio"]'
    const focusItem = (index) => {
      const items = menuRef.current?.querySelectorAll(itemSelector)
      if (!items?.length) return
      const i = ((index % items.length) + items.length) % items.length
      items[i].focus()
    }

    requestAnimationFrame(() => {
      const items = [...(menuRef.current?.querySelectorAll(itemSelector) || [])]
      const checked = items.findIndex((el) => el.getAttribute('aria-checked') === 'true')
      focusItem(checked >= 0 ? checked : 0)
    })

    const onKey = (e) => {
      const items = [...(menuRef.current?.querySelectorAll(itemSelector) || [])]
      if (!items.length) return
      const idx = items.indexOf(document.activeElement)
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        focusItem(idx < 0 ? 0 : idx + 1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        focusItem(idx < 0 ? items.length - 1 : idx - 1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        focusItem(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        focusItem(items.length - 1)
      }
    }

    const onDown = (e) => {
      if (e.target.closest?.('[data-aio-popover-menu]')) return
      if (anchorRef?.current?.contains?.(e.target)) return
      onClose()
    }

    window.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open, onClose, anchorRef, menuRef])

  if (!open || !pos.ready) return null

  return createPortal(
    <div
      ref={menuRef}
      className={`${styles.menu}${entered ? ` ${styles.menuOpen}` : ''}${className ? ` ${className}` : ''}`}
      role="menu"
      data-aio-popover-menu
      data-menu={dataMenu}
      style={{
        top: pos.top,
        left: pos.left,
        minWidth,
        '--menu-origin': pos.origin,
      }}
    >
      {children}
    </div>,
    document.body
  )
}

export function PopoverMenuItem({
  children,
  onSelect,
  danger = false,
  checked,
  disabled,
  leading,
  trailing,
}) {
  const isRadio = checked !== undefined
  return (
    <button
      type="button"
      role={isRadio ? 'menuitemradio' : 'menuitem'}
      className={`${styles.item}${danger ? ` ${styles.itemDanger}` : ''}`}
      aria-checked={isRadio ? !!checked : undefined}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.(e)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect?.(e)
        }
      }}
    >
      {leading != null && <span className={styles.itemIcon}>{leading}</span>}
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      {trailing != null && <span className={styles.itemIcon}>{trailing}</span>}
    </button>
  )
}

export { styles as popoverMenuStyles }
