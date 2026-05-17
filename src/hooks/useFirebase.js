import { useEffect, useRef, useCallback, useState } from 'react'
import { db } from '../lib/firebase'
import { ref, get, set, push, onValue, off } from 'firebase/database'
import { makeTextLine } from '../components/Blob'



const DEFAULT_LINES = [makeTextLine('')]

// Strip HTML tags so Claude receives plain text
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

function parseLinesJson(raw) {
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
  } catch {}
  return null
}

function parseJsonArray(raw) {
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  return []
}

export function useFirebase() {
  const [lines, setLines] = useState(DEFAULT_LINES)
  const [categoryRules, setCategoryRules] = useState([])
  const [notes, setNotes] = useState([])
  const [blobLoaded, setBlobLoaded] = useState(false)

  // Task persistence
  const [savedTasks, setSavedTasks] = useState([])
  const [savedCompleted, setSavedCompleted] = useState([])
  const [tasksLoaded, setTasksLoaded] = useState(false)
  const [prevSortedTasks, setPrevSortedTasks] = useState([])

  const debounceTimer = useRef(null)
  const localDirtyRef = useRef(false)
  const dirtyTimerRef = useRef(null)

  useEffect(() => {
    const linesRef = ref(db, 'allinone/lines')
    const blobRef = ref(db, 'allinone/blob')
    const rulesRef = ref(db, 'allinone/categoryRules')
    const tasksRef = ref(db, 'allinone/sortedTasks')
    const completedRef = ref(db, 'allinone/completedTasks')

    // Live sync blob lines — skip remote update while user is actively typing
    let blobInitialized = false
    onValue(linesRef, snap => {
      if (localDirtyRef.current) return
      if (snap.exists()) {
        const parsed = parseLinesJson(snap.val())
        if (parsed) { setLines(parsed); setBlobLoaded(true); blobInitialized = true; return }
      }
      if (!blobInitialized) {
        // One-time migration from legacy plain-text blob key
        get(blobRef).then(bSnap => {
          if (bSnap.exists() && bSnap.val()) {
            const migrated = bSnap.val().split('\n').map(content => makeTextLine(content))
            setLines(migrated)
          }
          setBlobLoaded(true)
          blobInitialized = true
        }).catch(() => { setBlobLoaded(true); blobInitialized = true })
      }
    })

    // Load persisted sorted tasks
    get(tasksRef).then(snap => {
      if (snap.exists()) setSavedTasks(parseJsonArray(snap.val()))
      setTasksLoaded(true)
    }).catch(() => setTasksLoaded(true))

    // Load completed tasks
    get(completedRef).then(snap => {
      if (snap.exists()) setSavedCompleted(parseJsonArray(snap.val()))
    }).catch(() => {})

    // Load previous sort snapshot (for undo)
    get(ref(db, 'allinone/prevSortedTasks')).then(snap => {
      if (snap.exists()) setPrevSortedTasks(parseJsonArray(snap.val()))
    }).catch(() => {})

    // Load category rules
    get(rulesRef).then(snap => {
      if (snap.exists()) {
        const val = snap.val()
        setCategoryRules(Array.isArray(val) ? val : Object.values(val))
      }
    }).catch(() => {})

    // Live sync notes
    const notesRef = ref(db, 'notes')
    onValue(notesRef, snap => {
      if (snap.exists()) {
        const val = snap.val()
        const list = Object.entries(val).map(([id, note]) => ({ id, ...note }))
        list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        setNotes(list)
      } else {
        setNotes([])
      }
    })

    return () => { off(linesRef); off(notesRef) }
  }, [])

  const updateLines = useCallback((newLines) => {
    setLines(newLines)
    localDirtyRef.current = true
    clearTimeout(dirtyTimerRef.current)
    dirtyTimerRef.current = setTimeout(() => { localDirtyRef.current = false }, 3000)
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      set(ref(db, 'allinone/lines'), JSON.stringify(newLines)).catch(console.error)
      set(ref(db, 'allinone/lastUpdated'), new Date().toISOString()).catch(console.error)
    }, 500)
  }, [])

  const persistTasks = useCallback((tasks) => {
    setSavedTasks(tasks)
    set(ref(db, 'allinone/sortedTasks'), JSON.stringify(tasks)).catch(console.error)
  }, [])

  const persistCompleted = useCallback((task) => {
    const done = { ...task, dateCompleted: new Date().toISOString() }
    setSavedCompleted(prev => {
      const updated = [...prev, done]
      set(ref(db, 'allinone/completedTasks'), JSON.stringify(updated)).catch(console.error)
      return updated
    })
  }, [])

  const persistPrevTasks = useCallback((tasks) => {
    setPrevSortedTasks(tasks)
    set(ref(db, 'allinone/prevSortedTasks'), JSON.stringify(tasks)).catch(console.error)
  }, [])

  // Backs up blob content before a sort so it can be recovered after a refresh
  const persistPreSortBlob = useCallback((lines) => {
    set(ref(db, 'allinone/preSortBlob'), JSON.stringify(lines)).catch(console.error)
  }, [])

  const removeCompleted = useCallback((taskId) => {
    setSavedCompleted(prev => {
      const updated = prev.filter(t => t.id !== taskId)
      set(ref(db, 'allinone/completedTasks'), JSON.stringify(updated)).catch(console.error)
      return updated
    })
  }, [])

  // Remove multiple completed tasks at once (used for 24h auto-prune)
  const pruneCompleted = useCallback((ids) => {
    const idSet = new Set(ids)
    setSavedCompleted(prev => {
      const updated = prev.filter(t => !idSet.has(t.id))
      set(ref(db, 'allinone/completedTasks'), JSON.stringify(updated)).catch(console.error)
      return updated
    })
  }, [])

  const blobText = lines.map(l => stripHtml(l.content)).filter(Boolean).join('\n')

  const saveRule = useCallback((taskText, correctedCategory) => {
    const rule = { taskText, correctedCategory, dateAdded: new Date().toISOString() }
    setCategoryRules(prev => {
      const updated = [...prev.filter(r => r.taskText !== taskText), rule]
      set(ref(db, 'allinone/categoryRules'), updated).catch(console.error)
      return updated
    })
  }, [])

  const saveNote = useCallback((id, title, body) => {
    const noteData = { title, body, updatedAt: new Date().toISOString() }
    if (id) {
      set(ref(db, `notes/${id}`), noteData).catch(console.error)
    } else {
      return push(ref(db, 'notes'), noteData).then(r => r.key)
    }
  }, [])

  const deleteNote = useCallback((id) => {
    set(ref(db, `notes/${id}`), null).catch(console.error)
  }, [])

  return {
    lines, updateLines, blobText, blobLoaded,
    categoryRules, saveRule,
    notes, saveNote, deleteNote,
    savedTasks, tasksLoaded, persistTasks,
    savedCompleted, persistCompleted, removeCompleted, pruneCompleted,
    prevSortedTasks, persistPrevTasks,
    persistPreSortBlob,
  }
}
