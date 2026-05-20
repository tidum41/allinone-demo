import { useState, useCallback } from 'react'
import { makeTextLine, makeCheckLine, makeBulletLine } from '../components/Blob'

// Peter Parker — your friendly neighborhood Spider-Man
const DEMO_LINES = [
  "repair the web-shooters before patrol tonight — left one is misfiring",
  "pick up Aunt May's prescription before she finds out I skipped dinner again",
  "get the Spider-Man photos turned in to Jameson by noon (without getting fired)",
  "stop the Vulture's heist at the docks — 9pm, don't be late",
  "fix the mask lenses — HUD keeps glitching mid-swing",
  "call MJ back before she thinks I'm dead (again)",
  "synthesize more web fluid — running dangerously low after the Rhino chase",
  "study for the Chem midterm — can't let the grades slip again",
  "replace the suit's torn panels from the Green Goblin fight",
  "figure out how to tell Aunt May I'm Spider-Man",
  "set up new perches across Midtown for faster response times",
  "return Ned's laptop — accidentally webbed it to the ceiling",
  "train the new wall-crawling angle — still landing weird after the Lizard fight",
  "stop Mysterio's illusion rig before it hits Times Square",
  "sleep. actually sleep. more than 3 hours.",
].map(text => makeCheckLine(text))

const THINGS_I_LIKE_BODY = JSON.stringify([
  makeBulletLine("swinging between skyscrapers at 6am when the city's still quiet"),
  makeBulletLine("that split-second of freefall before the web catches"),
  makeBulletLine("Aunt May's wheatcakes — no notes, perfection"),
  makeBulletLine("when the web-shooter clicks perfectly on the first try"),
  makeBulletLine("MJ's laugh when something genuinely surprises her"),
  makeBulletLine("the view from the top of the Empire State Building at night"),
  makeBulletLine("Ned's enthusiasm for literally everything Spider-Man"),
  makeBulletLine("old film cameras — the manual focus ones especially"),
  makeBulletLine("that feeling when you catch someone before they hit the ground"),
  makeBulletLine("rooftops in general — best seats in New York"),
  makeBulletLine("the hum of the city at 2am when everyone else is asleep"),
  makeBulletLine("finally nailing a new web-slinging trick after weeks of failing"),
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
  const [lines, setLines] = useState(() => ssGet('demo:lines', DEMO_LINES))
  const [categoryRules, setCategoryRules] = useState(() => ssGet('demo:rules', []))
  const [notes, setNotes] = useState(() => ssGet('demo:notes', DEFAULT_NOTES))
  const [savedTasks, setSavedTasks] = useState(() => ssGet('demo:tasks', []))
  const [savedCompleted, setSavedCompleted] = useState(() => ssGet('demo:completed', []))
  const [prevSortedTasks, setPrevSortedTasks] = useState(() => ssGet('demo:prevTasks', []))

  const blobText = lines.filter(l => l.type === 'check').map(l => stripHtml(l.content)).filter(Boolean).join('\n')

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
