/** Custom 16px-grid icons. Stroke 1.5, round caps, optically centered. No Lucide. */

const svgProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  'aria-hidden': true,
}

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function SidebarIcon() {
  return (
    <svg {...svgProps}>
      <rect x="1.75" y="1.75" width="12.5" height="12.5" rx="2.25" {...stroke} />
      <path d="M5.75 2v12" {...stroke} />
    </svg>
  )
}

/** Tag/label mark for Categories — two offset tags, Things/Linear spirit */
export function CategoriesIcon() {
  return (
    <svg {...svgProps}>
      <path
        d="M2.5 3.25h5.1L12.5 8.15a1.1 1.1 0 0 1 0 1.55l-2.8 2.8a1.1 1.1 0 0 1-1.55 0L3.25 7.6V3.25z"
        {...stroke}
      />
      <circle cx="5.35" cy="5.35" r="0.85" fill="currentColor" />
      <path d="M7.75 3.1h3.2L13.5 5.65" {...stroke} />
    </svg>
  )
}

export function UndoIcon() {
  return (
    <svg {...svgProps}>
      <path d="M3 6.5h7.25a3.25 3.25 0 0 1 0 6.5H7.5" {...stroke} />
      <path d="M5.5 4L3 6.5 5.5 9" {...stroke} />
    </svg>
  )
}

export function BulletIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="3" cy="4" r="1.15" fill="currentColor" />
      <path d="M6.25 4H13.5" {...stroke} />
      <circle cx="3" cy="8" r="1.15" fill="currentColor" />
      <path d="M6.25 8H13.5" {...stroke} />
      <circle cx="3" cy="12" r="1.15" fill="currentColor" />
      <path d="M6.25 12H13.5" {...stroke} />
    </svg>
  )
}

export function ChecklistIcon() {
  return (
    <svg {...svgProps}>
      <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="2.25" {...stroke} />
    </svg>
  )
}

export function MoreIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="3.5" cy="8" r="1.15" fill="currentColor" />
      <circle cx="8" cy="8" r="1.15" fill="currentColor" />
      <circle cx="12.5" cy="8" r="1.15" fill="currentColor" />
    </svg>
  )
}

export function TrashIcon() {
  return (
    <svg {...svgProps}>
      <path d="M2.5 4.25h11" {...stroke} />
      <path d="M5.25 4.25V3.1A1.1 1.1 0 0 1 6.35 2h3.3a1.1 1.1 0 0 1 1.1 1.1v1.15" {...stroke} />
      <path d="M12.25 4.25v8.4a1.35 1.35 0 0 1-1.35 1.35H5.1a1.35 1.35 0 0 1-1.35-1.35V4.25" {...stroke} />
      <path d="M6.75 7v4.25M9.25 7v4.25" {...stroke} />
    </svg>
  )
}

export function ChevronLeftIcon() {
  return (
    <svg {...svgProps}>
      <path d="M9.75 3.5L5.25 8l4.5 4.5" {...stroke} />
    </svg>
  )
}

export function NotebookIcon() {
  return (
    <svg {...svgProps}>
      <rect x="3.25" y="1.75" width="9.5" height="12.5" rx="1.75" {...stroke} />
      <path d="M6.25 5h3.5M6.25 8h3.5M6.25 11h2" {...stroke} />
    </svg>
  )
}

export function NoteIcon() {
  return (
    <svg {...svgProps}>
      <path d="M3.5 2.25h6.1L12.5 5.15v8.1a1.5 1.5 0 0 1-1.5 1.5h-7.5a1.5 1.5 0 0 1-1.5-1.5v-9.5a1.5 1.5 0 0 1 1.5-1.5z" {...stroke} />
      <path d="M9.5 2.4V5.5h3" {...stroke} />
    </svg>
  )
}

export function PlusIcon() {
  return (
    <svg {...svgProps}>
      <path d="M8 3.25v9.5M3.25 8h9.5" {...stroke} />
    </svg>
  )
}
