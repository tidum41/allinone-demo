import { useState, useCallback } from 'react'
import { makeTextLine, makeCheckLine, makeBulletLine } from '../components/Blob'
import { DEFAULT_CATEGORIES, normalizeCategories } from '../lib/categories'

// Pulled from my real to-do list
const DEMO_LINES = [
  "read Norman chapter 3 before UX class tomorrow",
  "study for the Spanish quiz on Friday",
  "finish the PsychoPy coding project",
  "fill out the group formation survey for psych",
  "add the FigJam board to the BruinLease case study",
  "add an about section and PS3 sounds to my portfolio site",
  "change resume to match my site's design system",
  "edit campus magazine photos and send them over",
  "sign up for intramurals",
  "unpack the rest of my stuff from the car",
  "order instax film",
  "look for a standing desk",
  "plan a birthday dinner for my girlfriend",
  "check on my brother",
  "look into masters programs",
  "idea: notes that save the location, music, and weather from that day",
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
  const [lines, setLines] = useState(() => ssGet('demo:v11:lines', DEMO_LINES))
  const [categoryRules, setCategoryRules] = useState(() => ssGet('demo:v11:rules', []))
  const [categories, setCategories] = useState(() =>
    normalizeCategories(ssGet('demo:v11:categories', DEFAULT_CATEGORIES))
  )
  const [notes, setNotes] = useState(() => ssGet('demo:v11:notes', DEFAULT_NOTES))
  const [savedTasks, setSavedTasks] = useState(() => ssGet('demo:v11:tasks', []))
  const [savedCompleted, setSavedCompleted] = useState(() => ssGet('demo:v11:completed', []))
  const [prevSortedTasks, setPrevSortedTasks] = useState(() => ssGet('demo:v11:prevTasks', []))

  const blobText = lines.filter(l => l.type === 'check').map(l => stripHtml(l.content)).filter(Boolean).join('\n')

  const updateLines = useCallback((newLines) => {
    setLines(newLines)
    ssSet('demo:v11:lines', newLines)
  }, [])

  const persistCategories = useCallback((next) => {
    const normalized = normalizeCategories(next)
    setCategories(normalized)
    ssSet('demo:v11:categories', normalized)
  }, [])

  const persistTasks = useCallback((tasks) => {
    setSavedTasks(tasks)
    ssSet('demo:v11:tasks', tasks)
  }, [])

  const persistCompleted = useCallback((task) => {
    const done = { ...task, dateCompleted: new Date().toISOString() }
    setSavedCompleted(prev => {
      const updated = [...prev, done]
      ssSet('demo:v11:completed', updated)
      return updated
    })
  }, [])

  const removeCompleted = useCallback((taskId) => {
    setSavedCompleted(prev => {
      const updated = prev.filter(t => t.id !== taskId)
      ssSet('demo:v11:completed', updated)
      return updated
    })
  }, [])

  const pruneCompleted = useCallback((ids) => {
    const idSet = new Set(ids)
    setSavedCompleted(prev => {
      const updated = prev.filter(t => !idSet.has(t.id))
      ssSet('demo:v11:completed', updated)
      return updated
    })
  }, [])

  const persistPrevTasks = useCallback((tasks) => {
    setPrevSortedTasks(tasks)
    ssSet('demo:v11:prevTasks', tasks)
  }, [])

  const persistPreSortBlob = useCallback((lines) => {
    ssSet('demo:v11:preSortBlob', lines)
  }, [])

  const saveRule = useCallback((taskText, correctedCategory) => {
    const rule = { taskText, correctedCategory, dateAdded: new Date().toISOString() }
    setCategoryRules(prev => {
      const updated = [...prev.filter(r => r.taskText !== taskText), rule]
      ssSet('demo:v11:rules', updated)
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
      ssSet('demo:v11:notes', updated)
      return updated
    })
    return Promise.resolve(noteId)
  }, [])

  const deleteNote = useCallback((id) => {
    setNotes(prev => {
      const updated = prev.filter(n => n.id !== id)
      ssSet('demo:v11:notes', updated)
      return updated
    })
  }, [])

  return {
    lines, updateLines, blobText, blobLoaded: true,
    categoryRules, saveRule,
    categories, persistCategories,
    notes, saveNote, deleteNote,
    savedTasks, tasksLoaded: true, persistTasks,
    savedCompleted, persistCompleted, removeCompleted, pruneCompleted,
    prevSortedTasks, persistPrevTasks,
    persistPreSortBlob,
  }
}
