import { useState, useCallback } from 'react'
import { makeTextLine, makeCheckLine, makeBulletLine } from '../components/Blob'

// Garfield as Spider-Man — lasagna first, then the city
const DEMO_LINES = [
  "fix the web shooters after my nap, the left one keeps jamming",
  "hide the lasagna from Jon before he notices the mask on the floor",
  "get Jameson the Spider-Man photos, no orange fur in the frame this time",
  "stop the Vulture at the docks at 9pm, which is after lasagna",
  "figure out how to tell Jon I am Spider-Man, or never, either works",
  "make more web fluid, almost out after I webbed the lasagna pan shut",
  "study for the chemistry midterm, the lasagna notes do not count",
  "add a nap pocket to the suit, third draft, Jameson cannot see it",
  "patch the suit from the Green Goblin fight, there is sauce on it too",
  "unstick Odie from the ceiling, he thought the web was a toy",
  "skip the Monday lecture, it is Monday",
  "neighborhood watch after a three hour nap, maybe",
  "restock lasagna, the important web fluid",
  "what if every day was Sunday",
].map(text => makeCheckLine(text))

const THINGS_I_LIKE_BODY = JSON.stringify([
  makeBulletLine("lasagna at any temperature"),
  makeBulletLine("a Monday that got cancelled"),
  makeBulletLine("the nap between swings"),
  makeBulletLine("when the web-shooter clicks and I can go back to sleep"),
  makeBulletLine("Jon not noticing the mask"),
  makeBulletLine("Odie falling for the fake laser, every time"),
  makeBulletLine("rooftops, best seats, no people"),
  makeBulletLine("orange fur on a red suit, it is a look"),
  makeBulletLine("that first bite after patrol"),
  makeBulletLine("the city at 2am when nobody can assign me a Monday"),
  makeBulletLine("a leftover boxed just for me"),
  makeBulletLine("nailing a swing and landing in a sunbeam"),
])

const DEFAULT_NOTES = [
  {
    id: 'demo-note-likes',
    title: 'things i like',
    body: THINGS_I_LIKE_BODY,
    updatedAt: new Date().toISOString(),
  },
]

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
  const [lines, setLines] = useState(() => ssGet('demo:v5:lines', DEMO_LINES))
  const [categoryRules, setCategoryRules] = useState(() => ssGet('demo:v5:rules', []))
  const [notes, setNotes] = useState(() => ssGet('demo:v5:notes', DEFAULT_NOTES))
  const [savedTasks, setSavedTasks] = useState(() => ssGet('demo:v5:tasks', []))
  const [savedCompleted, setSavedCompleted] = useState(() => ssGet('demo:v5:completed', []))
  const [prevSortedTasks, setPrevSortedTasks] = useState(() => ssGet('demo:v5:prevTasks', []))

  const blobText = lines.filter(l => l.type === 'check').map(l => stripHtml(l.content)).filter(Boolean).join('\n')

  const updateLines = useCallback((newLines) => {
    setLines(newLines)
    ssSet('demo:v5:lines', newLines)
  }, [])

  const persistTasks = useCallback((tasks) => {
    setSavedTasks(tasks)
    ssSet('demo:v5:tasks', tasks)
  }, [])

  const persistCompleted = useCallback((task) => {
    const done = { ...task, dateCompleted: new Date().toISOString() }
    setSavedCompleted(prev => {
      const updated = [...prev, done]
      ssSet('demo:v5:completed', updated)
      return updated
    })
  }, [])

  const removeCompleted = useCallback((taskId) => {
    setSavedCompleted(prev => {
      const updated = prev.filter(t => t.id !== taskId)
      ssSet('demo:v5:completed', updated)
      return updated
    })
  }, [])

  const pruneCompleted = useCallback((ids) => {
    const idSet = new Set(ids)
    setSavedCompleted(prev => {
      const updated = prev.filter(t => !idSet.has(t.id))
      ssSet('demo:v5:completed', updated)
      return updated
    })
  }, [])

  const persistPrevTasks = useCallback((tasks) => {
    setPrevSortedTasks(tasks)
    ssSet('demo:v5:prevTasks', tasks)
  }, [])

  const persistPreSortBlob = useCallback((lines) => {
    ssSet('demo:v5:preSortBlob', lines)
  }, [])

  const saveRule = useCallback((taskText, correctedCategory) => {
    const rule = { taskText, correctedCategory, dateAdded: new Date().toISOString() }
    setCategoryRules(prev => {
      const updated = [...prev.filter(r => r.taskText !== taskText), rule]
      ssSet('demo:v5:rules', updated)
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
      ssSet('demo:v5:notes', updated)
      return updated
    })
    return Promise.resolve(noteId)
  }, [])

  const deleteNote = useCallback((id) => {
    setNotes(prev => {
      const updated = prev.filter(n => n.id !== id)
      ssSet('demo:v5:notes', updated)
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
