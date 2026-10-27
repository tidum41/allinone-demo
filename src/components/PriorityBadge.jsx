import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon } from './icons'
import { PopoverMenu, PopoverMenuItem } from './PopoverMenu'
import styles from './PriorityBadge.module.css'

const OPTIONS = [
  { value: 'Urgent', label: 'Urgent', tone: 'urgent' },
  { value: 'Soon', label: 'Soon', tone: 'soon' },
  { value: 'Eventually', label: 'Eventually', tone: 'eventually' },
  { value: null, label: 'No urgency', tone: null },
]

function labelFor(priority) {
  return priority ? priority.toLowerCase() : null
}

export function PriorityBadge({ priority, onChange }) {
  const btnRef = useRef(null)
  const measureRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [width, setWidth] = useState(null)
  const [shown, setShown] = useState(priority)
  const [fade, setFade] = useState(1)
  const [morphing, setMorphing] = useState(false)

  const closeMenu = useCallback(() => {
    setOpen(false)
    requestAnimationFrame(() => btnRef.current?.focus())
  }, [])

  const openMenu = useCallback((e) => {
    e?.stopPropagation?.()
    setOpen((v) => !v)
  }, [])

  // Crossfade label + measure width when urgency changes
  useEffect(() => {
    if (priority === shown) return
    setMorphing(true)
    setFade(0)
    const t = window.setTimeout(() => {
      setShown(priority)
      setFade(1)
      window.setTimeout(() => setMorphing(false), 200)
    }, 90)
    return () => window.clearTimeout(t)
  }, [priority, shown])

  useLayoutEffect(() => {
    if (!measureRef.current) return
    if (!shown) {
      setWidth(22)
      return
    }
    setWidth(Math.ceil(measureRef.current.scrollWidth))
  }, [shown])

  const select = (value) => {
    onChange(value)
    closeMenu()
  }

  const shownLabel = labelFor(shown)
  const tone = shown ? shown.toLowerCase() : null
  const isEmpty = !shown

  return (
    <span className={styles.wrap}>
      {/* Offscreen measurer for morph width */}
      <span ref={measureRef} className={styles.measure} aria-hidden="true">
        <span className={styles.label}>{shownLabel || '+'}</span>
        {!isEmpty && (
          <span className={styles.chevron}>
            <ChevronDownIcon />
          </span>
        )}
      </span>

      <button
        ref={btnRef}
        type="button"
        className={[
          isEmpty ? styles.badgeEmpty : styles.badge,
          !isEmpty && styles[tone],
          open ? styles.expanded : '',
        ].filter(Boolean).join(' ')}
        style={!isEmpty && width != null ? { width } : undefined}
        onClick={openMenu}
        aria-label={isEmpty ? 'Add urgency' : `${shown}. Change urgency`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={isEmpty ? 'Add urgency' : 'Change urgency'}
        data-aio-priority-badge
        data-aio-priority-morphing={morphing ? 'true' : undefined}
      >
        {isEmpty ? (
          '+'
        ) : (
          <>
            <span className={styles.label} style={{ opacity: fade }} data-aio-priority-label>
              {shownLabel}
            </span>
            <span className={styles.chevron} aria-hidden="true">
              <ChevronDownIcon />
            </span>
          </>
        )}
      </button>

      <PopoverMenu
        open={open}
        anchorRef={btnRef}
        onClose={closeMenu}
        minWidth={168}
        estimatedHeight={4 * 36 + 8}
        align="end"
        data-menu="priority"
      >
        {OPTIONS.map((opt) => {
          const selected = (priority ?? null) === opt.value
          return (
            <PopoverMenuItem
              key={opt.label}
              checked={selected}
              leading={
                opt.tone ? (
                  <span
                    className={styles.menuDot}
                    data-aio-priority-dot={opt.tone}
                    style={{ background: `var(--color-${opt.tone}-dot)` }}
                    aria-hidden="true"
                  />
                ) : (
                  <span className={`${styles.menuDot} ${styles.menuDotEmpty}`} aria-hidden="true" />
                )
              }
              trailing={selected ? <CheckIcon /> : <span className={styles.checkSpacer} />}
              onSelect={() => select(opt.value)}
            >
              {opt.label}
            </PopoverMenuItem>
          )
        })}
      </PopoverMenu>
    </span>
  )
}
