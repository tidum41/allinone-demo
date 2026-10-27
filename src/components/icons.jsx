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

/** Tag mark for Categories — price-tag silhouette with hole, Things/Linear spirit */
export function CategoriesIcon() {
  return (
    <svg {...svgProps}>
      <path
        d="M2.75 3h4.85l5.9 5.9a1.35 1.35 0 0 1 0 1.9l-3.2 3.2a1.35 1.35 0 0 1-1.9 0L2.75 7.85V3z"
        {...stroke}
      />
      <circle cx="5.6" cy="5.6" r="1" fill="currentColor" />
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

/** Close mark for Categories rail header */
export function CloseIcon() {
  return (
    <svg {...svgProps}>
      <path d="M4 4l8 8M12 4l-8 8" {...stroke} />
    </svg>
  )
}

/** 8px chevron for PriorityBadge hover affordance */
export function ChevronDownIcon({ size = 8 } = {}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1.75 3l2.25 2.25L6.25 3"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
