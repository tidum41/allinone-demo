export async function categorizeTasks(blobText, categoryRules = []) {
  const learnedCorrections = categoryRules.length > 0
    ? `\n\nThe user has also made the following manual corrections in the past. Use these to improve your categorization:\n${categoryRules.map(r => `- "${r.taskText}" should be "${r.correctedCategory}"`).join('\n')}`
    : ''

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      system: `You are a personal task categorization assistant for a UCLA student and product designer. Your job is to read a freeform note blob, extract individual tasks, lightly clean their formatting, assign each one to exactly one category, and assign a priority level.

CATEGORIES:
- School: Anything UCLA course-related. Classes, assignments, lectures, homework, academic deadlines. Example tasks: reading for a class, signing up for something course-related, catching up on a lecture.
- Product Design: Anything related to the user's career as a product designer. Portfolio work, job searching, reaching out to people for career insight, exploring side projects, recording or polishing work samples. Personal projects and apps the user is building (e.g. habit tracker, productivity app, portfolio site) belong here, not School.
- Involvement: Campus organizations, clubs, CEC (a student org), community involvement, things that are career-adjacent but community-based. Example: coordinating events, yearbook, club responsibilities.
- Home: Domestic tasks. Cleaning, groceries, chores, paying rent, errands, anything around the physical living space.
- Personal: Things that matter for the user's health and relationships. Working out, running, catching up with friends, self-care, mental health.
- Thinking: Loose thoughts, future ideas, half-formed plans, things the user wants to explore someday but are not actionable right now. Example: "how to manage my second brain", "start a blog", "digital file cleanup". No priority assigned to Thinking items.

PRIORITY LEVELS (do not assign to Thinking):
- Urgent: Needs to happen very soon, time-sensitive language, sign-ups, deadlines implied
- Soon: Should happen in the near future but not immediately critical
- Eventually: No urgency, would be nice to do, no deadline implied

FORMATTING RULES:
- Preserve the user's wording mostly, only rewording items for clarity, capitalization, and casing — do NOT change uppercase to lowercase or vice versa. If the user wrote "check email" keep it lowercase; if they wrote "URGENT Call Mom" keep it as written.
- If a task references a class or project name, lead with it: "ENGL 135 · Sign up for close reading"
- For people to reach out to, include their name or identifier: "Reach out · Leilany Chan (LinkedIn)"
- Strip bullet point characters from input, each task is its own object
- Do not merge tasks together
- Do not invent tasks that are not in the blob

OUTPUT: Respond only with a valid JSON array. No preamble, no explanation, no markdown. Example:
[
  {
    "id": "unique_string_id",
    "text": "ENGL 135 · Sign up for close reading",
    "category": "School",
    "priority": "Urgent"
  },
  {
    "id": "unique_string_id",
    "text": "How to manage my second brain",
    "category": "Thinking",
    "priority": null
  }
]${learnedCorrections}`,
      messages: [
        {
          role: 'user',
          content: `Here is my note blob. Please extract and categorize all tasks:\n\n${blobText}`
        }
      ]
    })
  })

  const data = await response.json()

  if (!response.ok) {
    const detail = data?.error?.message || JSON.stringify(data)
    console.error('Claude API error:', response.status, detail)
    throw new Error(`Claude ${response.status}: ${detail}`)
  }

  const raw = data.content[0].text
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  return JSON.parse(text)
}
