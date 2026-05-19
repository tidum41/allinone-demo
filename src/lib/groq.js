export async function categorizeTasks(blobText, categoryRules = []) {
  const response = await fetch('/api/categorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: blobText, categoryRules }),
  })

  // Read as text first — avoids "Unexpected end of JSON input" when the server
  // returns an HTML error page or an empty body on an unhandled exception.
  const text = await response.text()

  if (!response.ok) {
    let msg = `Categorization failed (${response.status})`
    try { msg = JSON.parse(text)?.error || msg } catch {}
    throw new Error(msg)
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Invalid response from categorization service')
  }
}
