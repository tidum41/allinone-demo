import { useCallback } from 'react'
import { readTasks, readCompleted, appendTasks, moveToCompleted, updateTaskField } from '../lib/sheets'

export function useSheets() {
  const fetchTasks = useCallback(() => readTasks(), [])
  const fetchCompleted = useCallback(() => readCompleted(), [])

  const addTasks = useCallback((tasks) => {
    appendTasks(tasks).catch(console.error)
  }, [])

  const completeTask = useCallback((task) => {
    return moveToCompleted(task)
  }, [])

  const updatePriority = useCallback((task, priority) => {
    updateTaskField(task, 'priority', priority).catch(console.error)
  }, [])

  const updateCategory = useCallback((task, category) => {
    updateTaskField(task, 'category', category).catch(console.error)
  }, [])

  return { fetchTasks, fetchCompleted, addTasks, completeTask, updatePriority, updateCategory }
}
