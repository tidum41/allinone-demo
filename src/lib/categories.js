export const CATEGORY_COLORS = [
  '#C4A86A',
  '#6B8FA8',
  '#8B7AA3',
  '#6B946B',
  '#A86B78',
  '#7A7A7A',
  '#5E8A84',
  '#7A6B9A',
]

export const DEFAULT_CATEGORIES = [
  { id: 'school', name: 'School', color: '#C4A86A', description: 'classes, readings, quizzes, coursework' },
  { id: 'product-design', name: 'Product design', color: '#6B8FA8', description: 'portfolio, wireframes, research, design work' },
  { id: 'involvement', name: 'Involvement', color: '#8B7AA3', description: 'clubs, volunteering, community, events' },
  { id: 'home', name: 'Home', color: '#6B946B', description: 'chores, groceries, errands, apartment stuff' },
  { id: 'personal', name: 'Personal', color: '#A86B78', description: 'health, friends, self-care, appointments' },
  { id: 'thinking', name: 'Thinking', color: '#7A7A7A', description: 'loose ideas, half-formed plans, things to explore someday' },
]

const DEFAULT_DESC_BY_ID = Object.fromEntries(
  DEFAULT_CATEGORIES.map((c) => [c.id, c.description])
)

export function sentenceCaseName(value) {
  const t = String(value || '').trim()
  if (!t) return t
  const lower = t.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export function makeCategoryId() {
  return `cat-${Math.random().toString(36).slice(2, 10)}`
}

export function nextCategoryColor(categories) {
  const used = new Set(categories.map((c) => c.color.toLowerCase()))
  return CATEGORY_COLORS.find((c) => !used.has(c.toLowerCase()))
    || CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length]
}

function defaultDescriptionFor(id, name) {
  if (DEFAULT_DESC_BY_ID[id]) return DEFAULT_DESC_BY_ID[id]
  const match = DEFAULT_CATEGORIES.find(
    (c) => c.name.toLowerCase() === String(name || '').toLowerCase()
  )
  return match?.description || ''
}

/** Normalize persisted categories; fall back to defaults when empty. */
export function normalizeCategories(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_CATEGORIES.map((c) => ({ ...c }))
  }
  return raw
    .filter((c) => c && typeof c.name === 'string' && c.name.trim())
    .map((c, i) => {
      const id = typeof c.id === 'string' && c.id ? c.id : `cat-${i}`
      const name = sentenceCaseName(c.name)
      const description = typeof c.description === 'string'
        ? c.description
        : defaultDescriptionFor(id, name)
      return {
        id,
        name,
        color: typeof c.color === 'string' && c.color
          ? c.color
          : CATEGORY_COLORS[i % CATEGORY_COLORS.length],
        description,
      }
    })
}

export const UNSORTED_NAME = 'Unsorted'
