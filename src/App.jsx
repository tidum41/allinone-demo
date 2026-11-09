import { useState, useCallback, useRef, useEffect } from 'react'
import { Agentation } from 'agentation'
import { useSession } from './hooks/useSession'
import { categorizeTasks } from './lib/groq'
import { MenuBar } from './components/MenuBar'
import { Sidebar } from './components/Sidebar'
import { Blob, makeTextLine, makeId } from './components/Blob'
import { SortedView } from './components/SortedView'
import { SkeletonLoader } from './components/SkeletonLoader'
import { SummaryPanel } from './components/SummaryPanel'
import { NoteEditor } from './components/NoteEditor'
import { CategoriesPanel } from './components/CategoriesPanel'
import { CategoriesGuide } from './components/CategoriesGuide'

const VIEW_MAIN = 'main'
const VIEW_NOTE_EDITOR = 'noteEditor'

function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim()
}

export default function App() {
  const {
    lines, updateLines, blobText, blobLoaded,
    categoryRules, saveRule,
    categories, persistCategories,
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
  const completedSectionRef = useRef(null)
  const categoriesBtnRef = useRef(null)
  const dragOffsetRef = useRef(null)
  const notesRef = useRef([])
  const completingTimersRef = useRef({})  // taskId → setTimeout ID, cancelled on undo
  const deleteToastTimerRef = useRef(null)
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
  const [newTaskId, setNewTaskId] = useState(null)
  const [activeLineType, setActiveLineType] = useState('text')
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [deleteToast, setDeleteToast] = useState(null) // { snapshot, removed, tasksSnapshot }

  useEffect(() => {
    if (tasksLoaded && savedTasks.length > 0) {
      setTasks(savedTasks)
      setSorted(true)
    }
  }, [tasksLoaded]) // eslint-disable-line

  // Staggered entrance. When embedded (portfolio modal), wait for the parent's
  // "allinone-enter" message after it hides its loader; standalone, start almost
  // immediately. prefers-reduced-motion skips straight to the final state.
  useEffect(() => {
    const root = document.documentElement
    if (root.getAttribute('data-aio-entrance') === 'done') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let finished = false
    let timer = 0
    const finish = () => {
      if (finished) return
      finished = true
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      root.setAttribute('data-aio-entrance', 'done')
    }
    const start = () => {
      if (finished) return
      if (reduced) { finish(); return }
      root.setAttribute('data-aio-entrance', 'running')
      window.setTimeout(finish, 720)
    }
    const onMessage = (e) => {
      if (e.source !== window.parent) return
      const d = e.data
      if (d === 'allinone-enter' || (d && typeof d === 'object' && d.type === 'allinone-enter')) start()
    }
    root.setAttribute('data-aio-entrance', 'pending')
    window.addEventListener('message', onMessage)
    const ready = () => {
      try { window.parent.postMessage({ type: 'allinone-ready' }, window.location.origin) } catch { /* cross-origin */ }
      timer = window.setTimeout(start, window.parent === window ? 40 : 2200)
    }
    requestAnimationFrame(() => requestAnimationFrame(ready))
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
    }
  }, [])

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

    if (last.type === 'blobDelete') {
      updateLines(last.lines)
    } else if (last.type === 'sort') {
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
    } else if (last.type === 'taskDelete') {
      setTasks(last.snapshot)
      persistTasks(last.snapshot)
    } else if (last.type === 'drag') {
      setTasks(prev => {
        const updated = prev.map(t => t.id === last.task.id ? { ...t, category: last.fromCategory } : t)
        persistTasks(updated)
        return updated
      })
    } else if (last.type === 'categoryDelete') {
      persistCategories(last.snapshot)
      setTasks(last.tasksSnapshot)
      persistTasks(last.tasksSnapshot)
      setDeleteToast(null)
      clearTimeout(deleteToastTimerRef.current)
    }
  }, [undoStack, updateLines, persistTasks, removeCompleted, setSorted, persistCategories])

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
      const claudeTasks = await categorizeTasks(blobText, categoryRules, categories)

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
  }, [blobText, categoryRules, categories, lines, loading, updateLines, persistTasks, savedCompleted, persistPreSortBlob, tasks, pushUndo])

  const handleReassignTasks = useCallback((fromName, toName) => {
    if (!fromName || !toName || fromName === toName) return
    setTasks(prev => {
      const updated = prev.map(t =>
        t.category === fromName ? { ...t, category: toName } : t
      )
      persistTasks(updated)
      return updated
    })
  }, [persistTasks])

  const handleCategoryDeleted = useCallback(({ removed, snapshot }) => {
    const tasksSnapshot = tasks
    pushUndo({ type: 'categoryDelete', snapshot, tasksSnapshot, removed })
    setDeleteToast({ snapshot, removed, tasksSnapshot })
    clearTimeout(deleteToastTimerRef.current)
    deleteToastTimerRef.current = setTimeout(() => setDeleteToast(null), 5000)
  }, [tasks, pushUndo])

  const handleUndoCategoryDelete = useCallback(() => {
    if (!deleteToast) return
    persistCategories(deleteToast.snapshot)
    setTasks(deleteToast.tasksSnapshot)
    persistTasks(deleteToast.tasksSnapshot)
    setDeleteToast(null)
    clearTimeout(deleteToastTimerRef.current)
    setUndoStack(prev => {
      const last = prev[prev.length - 1]
      if (last?.type === 'categoryDelete') return prev.slice(0, -1)
      return prev
    })
  }, [deleteToast, persistCategories, persistTasks])

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
      // Persist and auto-expand completed section so the new item is visible
      persistCompleted(task)
      completedSectionRef.current?.expand()
      const entryLine = makeTextLine(task.text)
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
    // Remove from completed archive note
    const archive = notesRef.current.find(n => n.title?.toLowerCase() === 'completed archive')
    if (archive) {
      try {
        const existing = JSON.parse(archive.body || '[]')
        const filtered = existing.filter(l => !stripHtml(l.content || '').startsWith(task.text))
        if (filtered.length !== existing.length) {
          if (filtered.length === 0) {
            deleteNote(archive.id)  // don't leave behind an empty "[]" body
          } else {
            saveNote(archive.id, 'completed archive', JSON.stringify(filtered))
          }
        }
      } catch {}
    }
    const restored = { ...task, dateCompleted: undefined }
    setTasks(prev => {
      const updated = [...prev, restored]
      persistTasks(updated)
      return updated
    })
  }, [removeCompleted, persistTasks, saveNote, deleteNote])

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

  const handleAddAfter = useCallback((task) => {
    const newId = makeId()
    const newTask = { id: newId, text: '', category: task.category, priority: null }
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === task.id)
      const insertAt = idx >= 0 ? idx + 1 : prev.length
      const updated = [...prev.slice(0, insertAt), newTask, ...prev.slice(insertAt)]
      persistTasks(updated)
      return updated
    })
    setNewTaskId(newId)
    // Clear focus marker once the new task has mounted
    setTimeout(() => setNewTaskId(null), 300)
  }, [persistTasks])

  const handleBeforeLineDelete = useCallback((currentLines) => {
    pushUndo({ type: 'blobDelete', lines: currentLines })
  }, [pushUndo])

  const handleDeleteTasks = useCallback((ids) => {
    const idSet = new Set(ids)
    setTasks(prev => {
      pushUndo({ type: 'taskDelete', snapshot: prev })
      const updated = prev.filter(t => !idSet.has(t.id))
      persistTasks(updated)
      return updated
    })
  }, [persistTasks, pushUndo])

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

      {view === VIEW_NOTE_EDITOR ? (
        <NoteEditor
          key={activeNote?.id || 'new'}
          note={activeNote}
          onSave={async (id, title, body) => saveNote(id, title, body)}
          onDelete={deleteNote}
          onBack={() => setView(VIEW_MAIN)}
          onSidebarOpen={toggleSidebar}
          isSidebarOpen={sidebarOpen}
        />
      ) : (
        <div className="workspace">
          <div className={`toolbarStrip${categoriesOpen ? ' toolbarStripCatOpen' : ''}`} data-aio-enter="toolbar">
            <div className="toolbarMain">
              <div className="app">
                <MenuBar
                  onSidebarOpen={toggleSidebar}
                  onSort={handleSort}
                  onCategories={() => setCategoriesOpen(v => !v)}
                  categoriesOpen={categoriesOpen}
                  categoriesBtnRef={categoriesBtnRef}
                  onSummary={() => setShowSummary(true)}
                  onChecklist={() => blobRef.current?.toggleChecklist()}
                  onBullet={() => blobRef.current?.toggleBullet()}
                  onUndo={handleUndo}
                  isSidebarOpen={sidebarOpen}
                  loading={loading}
                  sortDone={sortDone}
                  title="All in one"
                  onFormat={(type) => blobRef.current?.format(type)}
                  activeLineType={activeLineType}
                />
              </div>
            </div>
            <div className="toolbarRailGutter" aria-hidden="true" />
          </div>

          <div className="workspaceBody">
            <div className="mainPane">
              <div className="app">
                <Blob
                  ref={blobRef}
                  lines={lines}
                  onChange={updateLines}
                  onBeforeLineDelete={handleBeforeLineDelete}
                  onLineTypeChange={setActiveLineType}
                  disabled={!blobLoaded}
                />

                <CategoriesGuide onEdit={() => setCategoriesOpen(true)} />

                {loading && <SkeletonLoader />}

                {!loading && error && (
                  <div style={{ padding: 'var(--space-md) var(--space-md) 0', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-placeholder)', flex: 1 }}>
                      {error}
                    </span>
                    <button
                      onClick={handleSort}
                      style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', padding: '0 var(--space-sm)', minHeight: '32px', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                    >
                      Retry
                    </button>
                  </div>
                )}

                {!loading && sorted && (
                  <SortedView
                    tasks={tasks}
                    categories={categories}
                    completingItems={completingItems}
                    onComplete={handleComplete}
                    onPriorityChange={handlePriorityChange}
                    onCategoryChange={handleCategoryChange}
                    onTextChange={handleTextChange}
                    onAddAfter={handleAddAfter}
                    newTaskId={newTaskId}
                    onDeleteSelected={handleDeleteTasks}
                    completedTasks={savedCompleted}
                    onUncheck={handleUncheck}
                    completedSectionRef={completedSectionRef}
                  />
                )}

                {showSummary && (
                  <SummaryPanel tasks={tasks} onClose={() => setShowSummary(false)} />
                )}
              </div>
            </div>

            <CategoriesPanel
              open={categoriesOpen}
              categories={categories}
              onChange={persistCategories}
              onReassignTasks={handleReassignTasks}
              onClose={() => setCategoriesOpen(false)}
              onDeleted={handleCategoryDeleted}
              onUndoDelete={handleUndoCategoryDelete}
              deleteToast={deleteToast}
              onDismissToast={() => {
                setDeleteToast(null)
                clearTimeout(deleteToastTimerRef.current)
              }}
            />
          </div>
        </div>
      )}

      </div>
      {import.meta.env.DEV && <Agentation />}
    </div>
  )
}
