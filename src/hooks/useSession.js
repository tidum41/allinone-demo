import { useState, useCallback } from 'react'
import { makeTextLine, makeCheckLine, makeBulletLine } from '../components/Blob'

// Scott Pilgrim — band flyers, roommate chaos, half a day job
const DEMO_LINES = [
  "finish the Sex Bob-Omb poster before soundcheck",
  "learn the bass line for tonight, last practice was mostly nodding",
  "text Ramona back before she hops to another city",
  "return Wallace's extra lives, I still have like twelve",
  "pay Knives back for the comics I said I would read",
  "clean the bathroom, Young Neil mapped the whole fog",
  "buy more ramen and the oat milk Wallace keeps finishing",
  "band practice in the park, Stephen said 6 and he means 5:45",
  "update the band site, it still says coming soon 2004",
  "apologize to Kim for the set list, she already rewrote it",
  "walk to Second Cup, counting it as the gym",
  "return the library copy of that fighting game guide",
  "finish the night class homework from the one week I tried college",
  "what if I designed a fighting game UI that was not ugly",
].map(text => makeCheckLine(text))

const THINGS_I_LIKE_BODY = JSON.stringify([
  makeBulletLine("a bass line that works on the first take"),
  makeBulletLine("Ramona's hair dye in the sink"),
  makeBulletLine("extra lives showing up at a convenient time"),
  makeBulletLine("Wallace already knowing the plan"),
  makeBulletLine("the glow of a subspace highway"),
  makeBulletLine("a venue amp that still works"),
  makeBulletLine("pixel hearts when something actually lands"),
  makeBulletLine("Young Neil being useful by accident"),
  makeBulletLine("Toronto at 2am after a show"),
  makeBulletLine("comic-panel timing in a real conversation"),
  makeBulletLine("the click of a 1-up"),
  makeBulletLine("a poster that looks cool from across the street"),
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
  const [lines, setLines] = useState(() => ssGet('demo:v3:lines', DEMO_LINES))
  const [categoryRules, setCategoryRules] = useState(() => ssGet('demo:v3:rules', []))
  const [notes, setNotes] = useState(() => ssGet('demo:v3:notes', DEFAULT_NOTES))
  const [savedTasks, setSavedTasks] = useState(() => ssGet('demo:v3:tasks', []))
  const [savedCompleted, setSavedCompleted] = useState(() => ssGet('demo:v3:completed', []))
  const [prevSortedTasks, setPrevSortedTasks] = useState(() => ssGet('demo:v3:prevTasks', []))

  const blobText = lines.filter(l => l.type === 'check').map(l => stripHtml(l.content)).filter(Boolean).join('\n')

  const updateLines = useCallback((newLines) => {
    setLines(newLines)
    ssSet('demo:v3:lines', newLines)
  }, [])

  const persistTasks = useCallback((tasks) => {
    setSavedTasks(tasks)
    ssSet('demo:v3:tasks', tasks)
  }, [])

  const persistCompleted = useCallback((task) => {
    const done = { ...task, dateCompleted: new Date().toISOString() }
    setSavedCompleted(prev => {
      const updated = [...prev, done]
      ssSet('demo:v3:completed', updated)
      return updated
    })
  }, [])

  const removeCompleted = useCallback((taskId) => {
    setSavedCompleted(prev => {
      const updated = prev.filter(t => t.id !== taskId)
      ssSet('demo:v3:completed', updated)
      return updated
    })
  }, [])

  const pruneCompleted = useCallback((ids) => {
    const idSet = new Set(ids)
    setSavedCompleted(prev => {
      const updated = prev.filter(t => !idSet.has(t.id))
      ssSet('demo:v3:completed', updated)
      return updated
    })
  }, [])

  const persistPrevTasks = useCallback((tasks) => {
    setPrevSortedTasks(tasks)
    ssSet('demo:v3:prevTasks', tasks)
  }, [])

  const persistPreSortBlob = useCallback((lines) => {
    ssSet('demo:v3:preSortBlob', lines)
  }, [])

  const saveRule = useCallback((taskText, correctedCategory) => {
    const rule = { taskText, correctedCategory, dateAdded: new Date().toISOString() }
    setCategoryRules(prev => {
      const updated = [...prev.filter(r => r.taskText !== taskText), rule]
      ssSet('demo:v3:rules', updated)
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
      ssSet('demo:v3:notes', updated)
      return updated
    })
    return Promise.resolve(noteId)
  }, [])

  const deleteNote = useCallback((id) => {
    setNotes(prev => {
      const updated = prev.filter(n => n.id !== id)
      ssSet('demo:v3:notes', updated)
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
