/**
 * Convert contenteditable HTML to plain text for task parsing.
 * Block boundaries and <br> become real newlines; tags/entities are stripped.
 */
export function htmlToPlainText(html) {
  if (!html) return ''

  let s = String(html)
    .replace(/\r\n?/g, '\n')
    // Soft / hard breaks
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    // Opening AND closing block tags become newlines so adjacent blocks
    // don't concatenate (e.g. tomorrow<div>Pick up suit</div>)
    .replace(/<\s*\/?\s*(?:div|p|li|h[1-6]|blockquote|pre|tr)(?:\s[^>]*)?>/gi, '\n')
    .replace(/<\s*\/?\s*t[dh](?:\s[^>]*)?>/gi, '\t')
    // Strip remaining (inline) tags
    .replace(/<[^>]*>/g, '')
    // Decode a minimal set of entities used by contenteditable
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")

  // Collapse runs of blank lines but keep single separators
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n')
  return s.trim()
}

/** Split HTML dump content into non-empty task lines. */
export function htmlToTaskLines(html) {
  return htmlToPlainText(html)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}
