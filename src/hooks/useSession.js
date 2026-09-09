import { useState, useCallback } from 'react'
import { makeTextLine, makeCheckLine, makeBulletLine } from '../components/Blob'

// Playful everyday dump — covers every sort category without a character theme
const DEMO_LINES = [
  "finish the reading I promised myself last Tuesday",
  "print the poster before the library actually closes",
  "tidy the portfolio case study that still says draft",
  "send the three screens even if they are a little ugly",
  "reply to the group chat about who is bringing snacks",
  "show up to the Saturday volunteer shift I signed up for half asleep",
  "take out the recycling before it becomes modern art",
  "buy oat milk, the regular kind this time",
  "water the plant that is pretending to be fine",
  "text mom back, she sent four photos of a bird",
  "go for the walk that has been on the calendar all week",
  "sleep before 2am as a fun little experiment",
  "what if the notes just sorted themselves",
  "learn to make sourdough or at least buy bread on purpose",
].map(text => makeCheckLine(text))

const THINGS_I_LIKE_BODY = JSON.stringify([
  makeBulletLine("when the coffee is still hot after I sit down"),
  makeBulletLine("the first ten minutes of a new notebook"),
  makeBulletLine("grocery stores at 9am when nobody is rushing"),
  makeBulletLine("a playlist that picks the perfect next song"),
  makeBulletLine("dogs who make eye contact like they have a meeting"),
  makeBulletLine("rain that starts right after I get inside"),
  makeBulletLine("leftover pasta that somehow tastes better"),
  makeBulletLine("finding a pen that still works in the junk drawer"),
  makeBulletLine("the quiet after finally sending the email"),
  makeBulletLine("a loading bar that actually finishes"),
  makeBulletLine("the sound of a sticker peeling cleanly"),
  makeBulletLine("opening a window and the air is nicer than expected"),
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
  const [lines, setLines] = useState(() => ssGet('demo:v2:lines', DEMO_LINES))
  const [categoryRules, setCategoryRules] = useState(() => ssGet('demo:v2:rules', []))
  const [notes, setNotes] = useState(() => ssGet('demo:v2:notes', DEFAULT_NOTES))
  const [savedTasks, setSavedTasks] = useState(() => ssGet('demo:v2:tasks', []))
  const [savedCompleted, setSavedCompleted] = useState(() => ssGet('demo:v2:completed', []))
  const [prevSortedTasks, setPrevSortedTasks] = useState(() => ssGet('demo:v2:prevTasks', []))

  const blobText = lines.filter(l => l.type === 'check').map(l => stripHtml(l.content)).filter(Boolean).join('\n')

  const updateLines = useCallback((newLines) => {
    setLines(newLines)
    ssSet('demo:v2:lines', newLines)
  }, [])

  const persistTasks = useCallback((tasks) => {
    setSavedTasks(tasks)
    ssSet('demo:v2:tasks', tasks)
  }, [])

  const persistCompleted = useCallback((task) => {
    const done = { ...task, dateCompleted: new Date().toISOString() }
    setSavedCompleted(prev => {
      const updated = [...prev, done]
      ssSet('demo:v2:completed', updated)
      return updated
    })
  }, [])

  const removeCompleted = useCallback((taskId) => {
    setSavedCompleted(prev => {
      const updated = prev.filter(t => t.id !== taskId)
      ssSet('demo:v2:completed', updated)
      return updated
    })
  }, [])

  const pruneCompleted = useCallback((ids) => {
    const idSet = new Set(ids)
    setSavedCompleted(prev => {
      const updated = prev.filter(t => !idSet.has(t.id))
      ssSet('demo:v2:completed', updated)
      return updated
    })
  }, [])

  const persistPrevTasks = useCallback((tasks) => {
    setPrevSortedTasks(tasks)
    ssSet('demo:v2:prevTasks', tasks)
  }, [])

  const persistPreSortBlob = useCallback((lines) => {
    ssSet('demo:v2:preSortBlob', lines)
  }, [])

  const saveRule = useCallback((taskText, correctedCategory) => {
    const rule = { taskText, correctedCategory, dateAdded: new Date().toISOString() }
    setCategoryRules(prev => {
      const updated = [...prev.filter(r => r.taskText !== taskText), rule]
    ssSet('demo:v2:rules', updated)
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
      ssSet('demo:v2:notes', updated)
      return updated
    })
    return Promise.resolve(noteId)
  }, [])

  const deleteNote = useCallback((id) => {
    setNotes(prev => {
      const updated = prev.filter(n => n.id !== id)
      ssSet('demo:v2:notes', updated)
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
