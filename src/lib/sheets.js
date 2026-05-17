const BASE = () =>
  `https://sheets.googleapis.com/v4/spreadsheets/${import.meta.env.VITE_GOOGLE_SHEETS_ID}`
const KEY = () => import.meta.env.VITE_GOOGLE_SHEETS_API_KEY

// Parse a raw row array into a task object
function rowToTask(row, rowIndex) {
  return {
    id: row[0] || '',
    text: row[1] || '',
    category: row[2] || '',
    priority: row[3] || '',
    dateAdded: row[4] || '',
    dateCompleted: row[5] || '',
    status: row[6] || 'active',
    _rowIndex: rowIndex, // 1-based sheet row (header is row 1, data starts at row 2)
  }
}

export async function readTasks() {
  const res = await fetch(`${BASE()}/values/Tasks!A:G?key=${KEY()}`)
  if (!res.ok) throw new Error('Failed to read tasks')
  const data = await res.json()
  const rows = data.values || []
  // Skip header row (index 0), data rows start at sheet row 2
  return rows.slice(1).map((row, i) => rowToTask(row, i + 2))
}

export async function readCompleted() {
  const res = await fetch(`${BASE()}/values/Completed!A:F?key=${KEY()}`)
  if (!res.ok) throw new Error('Failed to read completed')
  const data = await res.json()
  const rows = data.values || []
  return rows.slice(1).map((row, i) => rowToTask(row, i + 2))
}

export async function appendTasks(tasks) {
  const now = new Date().toISOString()
  const values = tasks.map(t => [
    t.id,
    t.text,
    t.category,
    t.priority || '',
    t.dateAdded || now,
    '',
    'active',
  ])

  await fetch(
    `${BASE()}/values/Tasks!A:G:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS&key=${KEY()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }
  )
}

export async function moveToCompleted(task) {
  const now = new Date().toISOString()

  // Append to Completed tab
  await fetch(
    `${BASE()}/values/Completed!A:F:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS&key=${KEY()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        values: [[task.id, task.text, task.category, task.priority, task.dateAdded, now]]
      }),
    }
  )

  // Delete from Tasks tab using batchUpdate
  await fetch(
    `${BASE()}:batchUpdate?key=${KEY()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: {
              sheetId: 0, // Tasks tab must be the first sheet (sheetId 0)
              dimension: 'ROWS',
              startIndex: task._rowIndex - 1, // 0-based
              endIndex: task._rowIndex,
            }
          }
        }]
      }),
    }
  )
}

export async function updateTaskField(task, field, value) {
  // Map field to column letter
  const colMap = { text: 'B', category: 'C', priority: 'D', status: 'G' }
  const col = colMap[field]
  if (!col) return

  await fetch(
    `${BASE()}/values/Tasks!${col}${task._rowIndex}?valueInputOption=RAW&key=${KEY()}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[value]] }),
    }
  )
}
