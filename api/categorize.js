const SYSTEM_PROMPT = `You are a task categorization assistant for a product designer. Your job is to read a freeform note blob, extract individual tasks, lightly clean their formatting, assign each one to exactly one category, and assign a priority level.

CATEGORIES:
- School: Coursework, assignments, lectures, studying, academic deadlines, anything learning or education related.
- Product Design: Design work, wireframes, prototyping, user research, design systems, portfolio, client work, rebrand projects, UI/UX tasks.
- Involvement: Community, clubs, volunteering, neighborhood, coalitions, organizations, journalism, events.
- Home: Chores, groceries, errands, apartment tasks, renter admin, domestic anything.
- Personal: Health, relationships, social plans, self-care, appointments, friends and family.
- Thinking: Loose thoughts, future ideas, half-formed plans, career reflections, things to explore someday — not actionable right now.

PRIORITY LEVELS (do not assign to Thinking):
- Urgent: Needs to happen very soon, time-sensitive, deadlines implied
- Soon: Should happen in the near future but not immediately critical
- Eventually: No urgency, would be nice to do, no deadline implied

FORMATTING RULES:
- Preserve the user's exact wording and casing. Do NOT change capitalization.
- Strip bullet characters. Each task is its own object.
- Do not merge tasks. Do not invent tasks not in the blob.
- Thinking items get priority: null

OUTPUT: Respond only with a valid JSON array. No explanation, no markdown fences. Example:
[
  { "id": "a1b2c3d4", "text": "finish wireframes for hero onboarding", "category": "Product Design", "priority": "Soon" },
  { "id": "e5f6g7h8", "text": "think about switching to a smaller studio", "category": "Thinking", "priority": null }
]`

// Simple in-memory rate limiting (resets on cold start — fine for a demo)
const rateLimitMap = new Map() // ip → { count, resetAt }
const RATE_LIMIT = 8           // requests per window
const RATE_WINDOW = 60 * 60 * 1000 // 1 hour

function checkRateLimit(ip) {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown'
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit reached. Try again in an hour.' })
  }

  const { text, categoryRules = [] } = req.body || {}
  if (!text?.trim()) {
    return res.status(400).json({ error: 'No text provided' })
  }

  const learnedCorrections = categoryRules.length > 0
    ? `\n\nThe user has made these manual corrections before — use them:\n${categoryRules.map(r => `- "${r.taskText}" → "${r.correctedCategory}"`).join('\n')}`
    : ''

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      max_tokens: 1500,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + learnedCorrections },
        { role: 'user', content: `Here is my note blob. Extract and categorize all tasks:\n\n${text}` },
      ],
    }),
  })

  if (!groqRes.ok) {
    const err = await groqRes.text()
    console.error('Groq error:', groqRes.status, err)
    return res.status(502).json({ error: 'Categorization failed' })
  }

  const data = await groqRes.json()
  const raw = data.choices?.[0]?.message?.content || ''
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  try {
    const tasks = JSON.parse(cleaned)
    return res.status(200).json(tasks)
  } catch {
    console.error('Failed to parse Groq response:', cleaned)
    return res.status(502).json({ error: 'Invalid response from model' })
  }
}
