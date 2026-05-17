import { useState, useCallback } from 'react'
import { makeTextLine } from '../components/Blob'

// Peter Parker — product designer at a mid-size studio in Queens
const DEMO_LINES = [
  "finish wireframes for the hero onboarding flow",
  "pick up Aunt May's prescription before Thursday",
  "submit invoice to Stark Industries for last sprint",
  "redesign the emergency alert system — current one is way too slow",
  "get photos turned in to the Bugle by noon",
  "review usability test results on the crawl navigation pattern",
  "renew renter's insurance for the Queens apartment",
  "coffee with Harry to align on the rebrand direction",
  "update design system after Ben finally approved the new tokens",
  "think about switching to a smaller studio — corporate is exhausting",
  "clean the apartment before MJ gets back from touring",
  "sign up for neighborhood emergency response training",
  "prototype the new gesture-based interactions for mobile",
  "read that article on ethical design in surveillance tech",
  "finish online typography course — 3 modules left",
].map(text => makeTextLine(text))

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

function ssGet(key, fallback) {
  try {
    const val = sessionStorage.getItem(key)
    return val !== null ? JSON.parse(val) : fallback
  } catch { return fallback }
}

function ssSet(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)) } catch {}
}

function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

export function useSession() {
  const [lines, setLines] = useState(() => ssGet('demo:lines', DEMO_LINES))
  const [categoryRules, setCategoryRules] = useState(() => ssGet('demo:rules', []))
  const [notes, setNotes] = useState(() => ssGet('demo:notes', []))
  const [savedTasks, setSavedTasks] = useState(() => ssGet('demo:tasks', []))
  const [savedCompleted, setSavedCompleted] = useState(() => ssGet('demo:completed', []))
  const [prevSortedTasks, setPrevSortedTasks] = useState(() => ssGet('demo:prevTasks', []))

  const blobText = lines.map(l => stripHtml(l.content)).filter(Boolean).join('\n')

  const updateLines = useCallback((newLines) => {
    setLines(newLines)
    ssSet('demo:lines', newLines)
  }, [])

  const persistTasks = useCallback((tasks) => {
    setSavedTasks(tasks)
    ssSet('demo:tasks', tasks)
  }, [])

  const persistCompleted = useCallback((task) => {
    const done = { ...task, dateCompleted: new Date().toISOString() }
    setSavedCompleted(prev => {
      const updated = [...prev, done]
      ssSet('demo:completed', updated)
      return updated
    })
  }, [])

  const removeCompleted = useCallback((taskId) => {
    setSavedCompleted(prev => {
      const updated = prev.filter(t => t.id !== taskId)
      ssSet('demo:completed', updated)
      return updated
    })
  }, [])

  const pruneCompleted = useCallback((ids) => {
    const idSet = new Set(ids)
    setSavedCompleted(prev => {
      const updated = prev.filter(t => !idSet.has(t.id))
      ssSet('demo:completed', updated)
      return updated
    })
  }, [])

  const persistPrevTasks = useCallback((tasks) => {
    setPrevSortedTasks(tasks)
    ssSet('demo:prevTasks', tasks)
  }, [])

  const persistPreSortBlob = useCallback((lines) => {
    ssSet('demo:preSortBlob', lines)
  }, [])

  const saveRule = useCallback((taskText, correctedCategory) => {
    const rule = { taskText, correctedCategory, dateAdded: new Date().toISOString() }
    setCategoryRules(prev => {
      const updated = [...prev.filter(r => r.taskText !== taskText), rule]
      ssSet('demo:rules', updated)
      return updated
    })
  }, [])

  const saveNote = useCallback((id, title, body) => {
    const noteId = id || makeId()
    const noteData = { id: noteId, title, body, updatedAt: new Date().toISOString() }
    setNotes(prev => {
      const updated = id
        ? prev.map(n => n.id === id ? noteData : n)
        : [...prev, noteData]
      ssSet('demo:notes', updated)
      return updated
    })
    return Promise.resolve(noteId)
  }, [])

  const deleteNote = useCallback((id) => {
    setNotes(prev => {
      const updated = prev.filter(n => n.id !== id)
      ssSet('demo:notes', updated)
      return updated
    })
  }, [])

  return {
    lines, updateLines, blobText, blobLoaded: true,
    categoryRules, saveRule,
    notes, saveNote, deleteNote,
    savedTasks, tasksLoaded: true, persistTasks,
    savedCompleted, persistCompleted, removeCompleted, pruneCompleted,
    prevSortedTasks, persistPrevTasks,
    persistPreSortBlob,
  }
}
