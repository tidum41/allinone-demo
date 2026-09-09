import { useState, useCallback } from 'react'
import { makeTextLine, makeCheckLine, makeBulletLine } from '../components/Blob'

// Andrew Garfield's Spider-Man — Oscorp intern, skateboard, Gwen
const DEMO_LINES = [
  "fix the web shooters before Gwen's thing, the left one jammed on the way over",
  "get the Oscorp lab photos to Jameson without him asking why I was on the ceiling",
  "finish the biology writeup before Connors notices I redesigned the web fluid again",
  "tell Gwen I am Spider-Man, or she already knows, either way show up on time",
  "make more web fluid, the last batch was a little too sticky even for me",
  "stop Connors before the Lizard thing reaches the bridge",
  "call Aunt May, I missed dinner and she is going to use the full name",
  "patch the suit, the skateboard wipeout did not help the Lizard tear",
  "show up to Gwen's orchestra night, mask off, sit in the back",
  "return Flash's homework, I webbed it to the locker by accident",
  "scout a Midtown route that is not the clock tower this time",
  "actually sleep tonight, more than three hours, as an experiment",
  "think about what Uncle Ben would say, then just do the thing",
  "put the skateboard somewhere Aunt May will not trip on it",
].map(text => makeCheckLine(text))

const THINGS_I_LIKE_BODY = JSON.stringify([
  makeBulletLine("Gwen pretending she did not see the landing"),
  makeBulletLine("the skateboard commute that is technically swinging"),
  makeBulletLine("a web that holds on the first try"),
  makeBulletLine("Oscorp at night when the labs are empty"),
  makeBulletLine("Aunt May's meatloaf, even when I am late"),
  makeBulletLine("the view from the clock tower"),
  makeBulletLine("a formula that works on the second try"),
  makeBulletLine("Midtown right after it rains"),
  makeBulletLine("the rooftop we are not calling a date"),
  makeBulletLine("nailing a swing and not hitting a water tower"),
  makeBulletLine("old cameras that still click"),
  makeBulletLine("when the mask comes off and she already knew"),
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
  const [lines, setLines] = useState(() => ssGet('demo:v6:lines', DEMO_LINES))
  const [categoryRules, setCategoryRules] = useState(() => ssGet('demo:v6:rules', []))
  const [notes, setNotes] = useState(() => ssGet('demo:v6:notes', DEFAULT_NOTES))
  const [savedTasks, setSavedTasks] = useState(() => ssGet('demo:v6:tasks', []))
  const [savedCompleted, setSavedCompleted] = useState(() => ssGet('demo:v6:completed', []))
  const [prevSortedTasks, setPrevSortedTasks] = useState(() => ssGet('demo:v6:prevTasks', []))

  const blobText = lines.filter(l => l.type === 'check').map(l => stripHtml(l.content)).filter(Boolean).join('\n')

  const updateLines = useCallback((newLines) => {
    setLines(newLines)
    ssSet('demo:v6:lines', newLines)
  }, [])

  const persistTasks = useCallback((tasks) => {
    setSavedTasks(tasks)
    ssSet('demo:v6:tasks', tasks)
  }, [])

  const persistCompleted = useCallback((task) => {
    const done = { ...task, dateCompleted: new Date().toISOString() }
    setSavedCompleted(prev => {
      const updated = [...prev, done]
      ssSet('demo:v6:completed', updated)
      return updated
    })
  }, [])

  const removeCompleted = useCallback((taskId) => {
    setSavedCompleted(prev => {
      const updated = prev.filter(t => t.id !== taskId)
      ssSet('demo:v6:completed', updated)
      return updated
    })
  }, [])

  const pruneCompleted = useCallback((ids) => {
    const idSet = new Set(ids)
    setSavedCompleted(prev => {
      const updated = prev.filter(t => !idSet.has(t.id))
      ssSet('demo:v6:completed', updated)
      return updated
    })
  }, [])

  const persistPrevTasks = useCallback((tasks) => {
    setPrevSortedTasks(tasks)
    ssSet('demo:v6:prevTasks', tasks)
  }, [])

  const persistPreSortBlob = useCallback((lines) => {
    ssSet('demo:v6:preSortBlob', lines)
  }, [])

  const saveRule = useCallback((taskText, correctedCategory) => {
    const rule = { taskText, correctedCategory, dateAdded: new Date().toISOString() }
    setCategoryRules(prev => {
      const updated = [...prev.filter(r => r.taskText !== taskText), rule]
      ssSet('demo:v6:rules', updated)
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
      ssSet('demo:v6:notes', updated)
      return updated
    })
    return Promise.resolve(noteId)
  }, [])

  const deleteNote = useCallback((id) => {
    setNotes(prev => {
      const updated = prev.filter(n => n.id !== id)
      ssSet('demo:v6:notes', updated)
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
