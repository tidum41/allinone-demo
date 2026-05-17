export async function categorizeTasks(blobText, categoryRules = []) {
  const response = await fetch('/api/categorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: blobText, categoryRules }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error || `Categorization failed (${response.status})`)
  }

  return data
}
