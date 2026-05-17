import { useState, useCallback } from 'react'
import { categorizeTasks } from '../lib/claude'

export function useCategorize() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sorted, setSorted] = useState(false)

  const sort = useCallback(async (blobText, categoryRules, { readTasks, appendTasks }) => {
    if (!blobText.trim()) return
    setLoading(true)
    setError(null)

    try {
      // Claude categorization — this must succeed
      const claudeTasks = await categorizeTasks(blobText, categoryRules)

      // Sheets sync — best-effort, never blocks the UI
      try {
        const existing = await readTasks()
        const existingNormalized = new Set(existing.map(t => t.text.toLowerCase().trim()))
        const newTasks = claudeTasks.filter(t => !existingNormalized.has(t.text.toLowerCase().trim()))
        if (newTasks.length > 0) await appendTasks(newTasks)
        const allTasks = await readTasks()
        setTasks(allTasks.length > 0 ? allTasks : claudeTasks)
      } catch (sheetsErr) {
        console.warn('Sheets sync failed, showing Claude results only:', sheetsErr)
        setTasks(claudeTasks)
      }

      setSorted(true)
    } catch (err) {
      console.error('Sort failed:', err)
      setError(err.message || "Couldn't sort right now, try again")
    } finally {
      setLoading(false)
    }
  }, [])

  const updateTaskLocally = useCallback((taskId, updates) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t))
  }, [])

  const removeTaskLocally = useCallback((taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }, [])

  return { tasks, loading, error, sorted, sort, updateTaskLocally, removeTaskLocally }
}
