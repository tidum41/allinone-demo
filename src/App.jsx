import { useState, useCallback, useRef, useEffect } from 'react'
import { useSession } from './hooks/useSession'
import { categorizeTasks } from './lib/groq'
import { MenuBar } from './components/MenuBar'
import { Sidebar } from './components/Sidebar'
import { Blob, makeTextLine } from './components/Blob'
import { SortedView } from './components/SortedView'
import { SkeletonLoader } from './components/SkeletonLoader'
import { SummaryPanel } from './components/SummaryPanel'
import { NoteEditor } from './components/NoteEditor'

const VIEW_MAIN = 'main'
const VIEW_NOTE_EDITOR = 'noteEditor'

export default function App() {
  const {
    lines, updateLines, blobText, blobLoaded,
    categoryRules, saveRule,
    notes, saveNote, deleteNote,
    savedTasks, tasksLoaded, persistTasks,
    savedCompleted, persistCompleted, removeCompleted, pruneCompleted,
    persistPreSortBlob,
  } = useSession()
  // Sheets sync is disabled in demo — stubs prevent import errors
  const updatePriority = () => {}
  const updateCategory = () => {}

  const blobRef = useRef(null)
  const sidebarRef = useRef(null)
  const dragOffsetRef = useRef(null)
  const notesRef = useRef([])
  const completingTimersRef = useRef({})  // taskId → setTimeout ID, cancelled on undo
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sorted, setSorted] = useState(false)
  const [undoStack, setUndoStack] = useState([])     // { type: 'sort'|'complete'|'drag', ...payload }
  const [completingItems, setCompletingItems] = useState({}) // id → task, kept for 1.8s animation window
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dragOffset, setDragOffset] = useState(null)
  const [view, setView] = useState(VIEW_MAIN)
  const [activeNote, setActiveNote] = useState(null)
  const [showSummary, setShowSummary] = useState(false)
  const [sortDone, setSortDone] = useState(false)

  useEffect(() => {
    if (tasksLoaded && savedTasks.length > 0) {
      setTasks(savedTasks)
      setSorted(true)
    }
  }, [tasksLoaded]) // eslint-disable-line

  const toggleSidebar = useCallback(() => setSidebarOpen(v => !v), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  useEffect(() => { dragOffsetRef.current = dragOffset }, [dragOffset])
  useEffect(() => { notesRef.current = notes }, [notes])

  // Auto-prune completed tasks older than 24 h — they're already in the archive note
  useEffect(() => {
    if (!savedCompleted?.length) return
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    const staleIds = savedCompleted
      .filter(t => t.dateCompleted && new Date(t.dateCompleted).getTime() < cutoff)
      .map(t => t.id)
    if (staleIds.length > 0) pruneCompleted(staleIds)
  }, [savedCompleted, pruneCompleted])

  // Close sidebar on click outside (desktop)
  useEffect(() => {
    if (!sidebarOpen) return
    const handler = (e) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        closeSidebar()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [sidebarOpen, closeSidebar])

  // Drag-to-close gesture (mobile)
  useEffect(() => {
    const el = sidebarRef.current
    if (!el) return
    const ds = { startX: null, active: false }
    const onStart = (e) => {
      if (!sidebarOpen || window.innerWidth > 680) return
      ds.startX = e.touches[0].clientX
      ds.active = true
    }
    const onMove = (e) => {
      if (!ds.active) return
      const dx = e.touches[0].clientX - ds.startX
      if (dx < 0) {
        e.preventDefault()
        setDragOffset(Math.max(dx, -272))
      }
    }
    const onEnd = () => {
      if (!ds.active) return
      ds.active = false
      const offset = dragOffsetRef.current ?? 0
      setDragOffset(null)
      if (offset < -80) closeSidebar()
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [sidebarOpen, closeSidebar])

  // ── Undo stack (sort + completions) ────────────────────────────────
  const pushUndo = useCallback((action) => {
    setUndoStack(prev => [...prev.slice(-29), action])
  }, [])

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) {
      blobRef.current?.undo()  // re-focuses last blob line then execCommand('undo')
      return
    }
    const last = undoStack[undoStack.length - 1]
    setUndoStack(prev => prev.slice(0, -1))

    if (last.type === 'sort') {
      if (last.lines) updateLines(last.lines)
      setTasks(last.tasks)
      persistTasks(last.tasks)
      setSorted(last.tasks.length > 0)
    } else if (last.type === 'complete') {
      // Cancel the pending 1.8s timer so persistCompleted doesn't fire after undo
      clearTimeout(completingTimersRef.current[last.task.id])
      delete completingTimersRef.current[last.task.id]
      // Cancel animation if still in the 1.8s display window
      setCompletingItems(prev => { const n = { ...prev }; delete n[last.task.id]; return n })
      removeCompleted(last.task.id)
      setTasks(prev => {
        const restored = { ...last.task, dateCompleted: undefined }
        const updated = [...prev, restored]
        persistTasks(updated)
        return updated
      })
    } else if (last.type === 'drag') {
      setTasks(prev => {
        const updated = prev.map(t => t.id === last.task.id ? { ...t, category: last.fromCategory } : t)
        persistTasks(updated)
        return updated
      })
    }
  }, [undoStack, updateLines, persistTasks, removeCompleted, setSorted])

  // Cmd/Ctrl+Z — must live AFTER handleUndo is declared to avoid TDZ crash
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && undoStack.length > 0) {
        e.preventDefault()
        handleUndo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undoStack, handleUndo])

  const handleSort = useCallback(async () => {
    if (!blobText.trim() || loading) return
    const linesToSave = [...lines]
    const tasksToSave = [...tasks]
    pushUndo({ type: 'sort', lines: linesToSave, tasks: tasksToSave })
    persistPreSortBlob(linesToSave)   // Firebase backup survives refresh
    updateLines([makeTextLine('')])
    setLoading(true)
    setError(null)

    try {
      const claudeTasks = await categorizeTasks(blobText, categoryRules)

      // Filter out already-completed tasks
      const completedNorm = new Set((savedCompleted || []).map(t => t.text?.toLowerCase().trim()))
      const completedIds = new Set((savedCompleted || []).map(t => t.id).filter(Boolean))
      const filterCompleted = (list) => list.filter(t =>
        !completedNorm.has(t.text?.toLowerCase().trim()) &&
        !(t.id && completedIds.has(t.id))
      )

      // Merge: keep existing tasks, add only genuinely new ones from Claude
      const existingNorm = new Set(tasksToSave.map(t => t.text?.toLowerCase().trim()))
      const newOnly = filterCompleted(claudeTasks.filter(t => !existingNorm.has(t.text?.toLowerCase().trim())))
      const merged = [...filterCompleted(tasksToSave), ...newOnly]

      setTasks(merged)
      persistTasks(merged)

      // Sheets sync disabled in demo

      setSorted(true)
      setSortDone(true)
      setTimeout(() => setSortDone(false), 1400)
      localStorage.setItem('lastSortedAt', new Date().toISOString())
    } catch (err) {
      setError(err.message || "couldn't sort right now")
      updateLines(linesToSave)
      setUndoStack(prev => prev.slice(0, -1)) // roll back the sort push on failure
    } finally {
      setLoading(false)
    }
  }, [blobText, categoryRules, lines, loading, updateLines, persistTasks, savedCompleted, persistPreSortBlob, tasks, pushUndo])

  const handleComplete = useCallback((task) => {
    // Push to undo stack and remove from sorted view immediately
    pushUndo({ type: 'complete', task })
    setTasks(prev => {
      const updated = prev.filter(t => t.id !== task.id)
      persistTasks(updated)
      return updated
    })

    // Keep the row visible in-place for 1.8s so the animation can play
    setCompletingItems(prev => ({ ...prev, [task.id]: task }))
    const completionTimer = setTimeout(() => {
      delete completingTimersRef.current[task.id]
      setCompletingItems(prev => { const n = { ...prev }; delete n[task.id]; return n })
      // Persist to Firebase and archive note only after animation completes
      persistCompleted(task)
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const entryLine = makeTextLine(`${task.text}  ·  ${dateStr}`)
      const archive = notesRef.current.find(n => n.title?.toLowerCase() === 'completed archive')
      if (archive) {
        let existing = []
        try { const p = JSON.parse(archive.body || '[]'); if (Array.isArray(p)) existing = p } catch {}
        saveNote(archive.id, 'completed archive', JSON.stringify([entryLine, ...existing]))
      } else {
        saveNote(null, 'completed archive', JSON.stringify([entryLine]))
      }
    }, 1800)
    completingTimersRef.current[task.id] = completionTimer
  }, [persistTasks, persistCompleted, saveNote, pushUndo])

  const handleUncheck = useCallback((task) => {
    removeCompleted(task.id)
    const restored = { ...task, dateCompleted: undefined }
    setTasks(prev => {
      const updated = [...prev, restored]
      persistTasks(updated)
      return updated
    })
  }, [removeCompleted, persistTasks])

  const handlePriorityChange = useCallback((task, priority) => {
    setTasks(prev => {
      const updated = prev.map(t => t.id === task.id ? { ...t, priority } : t)
      persistTasks(updated)
      return updated
    })
    updatePriority(task, priority)
  }, [persistTasks, updatePriority])

  const handleCategoryChange = useCallback((task, category) => {
    pushUndo({ type: 'drag', task, fromCategory: task.category })
    setTasks(prev => {
      const updated = prev.map(t => t.id === task.id ? { ...t, category } : t)
      persistTasks(updated)
      return updated
    })
    updateCategory(task, category)
    saveRule(task.text, category)
  }, [persistTasks, updateCategory, saveRule, pushUndo])

  const handleTextChange = useCallback((task, newText) => {
    setTasks(prev => {
      const updated = prev.map(t => t.id === task.id ? { ...t, text: newText } : t)
      persistTasks(updated)
      return updated
    })
  }, [persistTasks])

  const sidebarColClass = `sidebarCol${sidebarOpen ? ' sidebarColOpen' : ' sidebarColClosed'}`
  const sidebarDragStyle = dragOffset !== null
    ? { transform: `translateX(${dragOffset}px)`, transition: 'none' }
    : undefined

  return (
    <div className="shell">
      <div ref={sidebarRef} className={sidebarColClass} style={sidebarDragStyle}>
        <Sidebar
          open={sidebarOpen}
          onClose={closeSidebar}
          notes={notes}
          onSelectNote={(note) => { setActiveNote(note); setView(VIEW_NOTE_EDITOR); closeSidebar() }}
          onCreate={() => { setActiveNote(null); setView(VIEW_NOTE_EDITOR); closeSidebar() }}
          onSelectMain={() => { setView(VIEW_MAIN); closeSidebar() }}
        />
      </div>

      {sidebarOpen && (
        <div
          className="sidebarBackdrop"
          onClick={closeSidebar}
          aria-hidden="true"
          style={dragOffset !== null ? { opacity: 1 + dragOffset / 272 } : undefined}
        />
      )}

      <div className="contentCol">
      <div className="app">

      {view === VIEW_NOTE_EDITOR ? (
        <NoteEditor
          key={activeNote?.id || 'new'}
          note={activeNote}
          onSave={async (id, title, body) => saveNote(id, title, body)}
          onDelete={deleteNote}
          onBack={() => setView(VIEW_MAIN)}
          onSidebarOpen={toggleSidebar}
        />
      ) : (
        <>
          <MenuBar
            onSidebarOpen={toggleSidebar}
            onSort={handleSort}
            onSummary={() => setShowSummary(true)}
            onChecklist={() => blobRef.current?.toggleChecklist()}
            onUndo={handleUndo}
            hasUndo={undoStack.length > 0}
            loading={loading}
            sortDone={sortDone}
            title="all in one"
            onFormat={(type) => blobRef.current?.format(type)}
          />

          <Blob
            ref={blobRef}
            lines={lines}
            onChange={updateLines}
            disabled={!blobLoaded}
          />

          {loading && <SkeletonLoader />}

          {!loading && error && (
            <p style={{ padding: 'var(--space-md)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              {error}
            </p>
          )}

          {!loading && sorted && (
            <SortedView
              tasks={tasks}
              completingItems={completingItems}
              onComplete={handleComplete}
              onPriorityChange={handlePriorityChange}
              onCategoryChange={handleCategoryChange}
              onTextChange={handleTextChange}
              completedTasks={savedCompleted}
              onUncheck={handleUncheck}
            />
          )}

          {showSummary && (
            <SummaryPanel tasks={tasks} onClose={() => setShowSummary(false)} />
          )}
        </>
      )}

      </div>
      </div>
    </div>
  )
}
