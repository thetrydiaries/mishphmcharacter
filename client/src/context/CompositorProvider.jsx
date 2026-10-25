import { useReducer, useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { CompositorContext } from './compositorContext'

// Shared batch state for the whole app: all guests, order-level settings (charm + style),
// and per-guest editing (undo/redo on the current guest's recipe). Persisted to localStorage
// so work survives closing the browser and returning days later (same browser/machine).

const STORAGE_KEY = 'mishph_batch_v2'
const MAX_HISTORY = 10

const BLANK_RECIPE = {
  assets: {
    frame: null, body: null, outfit: null, face: null, facialhair: null,
    nose: null, mouth: null, eyes: null, twinkle: null, brows: null,
    hair_back: null, hair_front: null, accessory: [],
  },
  colours: { hair: '#3D1F0A', skin: '#C08060', outfit: '#2D3561' },
}

const DEFAULT_ORDER = { charmSizeId: 'square40', styleId: 'classic', backgroundId: null }

function newId() {
  return (crypto?.randomUUID?.() ?? `g-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
}

function blankGuest(name = 'Guest') {
  return { id: newId(), name, table: null, status: 'pending', photo: null, recipe: BLANK_RECIPE, aiRecipe: null, flags: [] }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.guests)) return null
    return {
      order: { ...DEFAULT_ORDER, ...(parsed.order ?? {}) },
      guests: parsed.guests.length ? parsed.guests : [blankGuest()],
      currentIndex: Math.min(parsed.currentIndex ?? 0, Math.max(0, (parsed.guests.length || 1) - 1)),
      history: [],
      future: [],
    }
  } catch {
    return null
  }
}

// Returns true on success, false on failure (quota exceeded, private mode, storage off).
// The caller surfaces failures in the UI — a silent failed save loses work without warning.
function persist({ order, guests, currentIndex }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, order, guests, currentIndex }))
    return true
  } catch (err) {
    console.warn('[compositor] could not persist batch:', err?.message)
    return false
  }
}

const initialState = loadState() ?? {
  order: DEFAULT_ORDER,
  guests: [blankGuest()],
  currentIndex: 0,
  history: [],
  future: [],
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

// Helper: apply a recipe change to the current guest and push the old recipe to history.
function editCurrent(state, newRecipe) {
  const { guests, currentIndex, history } = state
  return {
    ...state,
    guests: guests.map((g, i) => i === currentIndex ? { ...g, recipe: newRecipe } : g),
    history: [...history.slice(-(MAX_HISTORY - 1)), guests[currentIndex].recipe],
    future: [],
  }
}

function reducer(state, action) {
  const { guests, currentIndex, history, future } = state
  const current = guests[currentIndex]

  switch (action.type) {
    case 'SWAP_ASSET': {
      const val = current.recipe.assets[action.category]
      const next = Array.isArray(val)
        ? (val.includes(action.assetName) ? val.filter(n => n !== action.assetName) : [...val, action.assetName])
        : action.assetName
      return editCurrent(state, { ...current.recipe, assets: { ...current.recipe.assets, [action.category]: next } })
    }

    case 'SET_COLOUR':
      return editCurrent(state, { ...current.recipe, colours: { ...current.recipe.colours, [action.colourType]: action.hex } })

    case 'SET_STATUS':
      return { ...state, guests: guests.map((g, i) => i === currentIndex ? { ...g, status: action.status } : g) }

    case 'SET_STATUS_BY_ID':
      return { ...state, guests: guests.map(g => g.id === action.id ? { ...g, status: action.status } : g) }

    case 'SET_NAME':
      return { ...state, guests: guests.map(g => g.id === (action.id ?? current.id) ? { ...g, name: action.name } : g) }

    case 'RESET':
      return editCurrent(state, current.aiRecipe ?? BLANK_RECIPE)

    case 'UNDO': {
      if (!history.length) return state
      return {
        ...state,
        guests: guests.map((g, i) => i === currentIndex ? { ...g, recipe: history[history.length - 1] } : g),
        history: history.slice(0, -1),
        future: [...future, current.recipe],
      }
    }

    case 'REDO': {
      if (!future.length) return state
      return {
        ...state,
        guests: guests.map((g, i) => i === currentIndex ? { ...g, recipe: future[future.length - 1] } : g),
        history: [...history, current.recipe],
        future: future.slice(0, -1),
      }
    }

    case 'LOAD_FROM_ANALYSIS': {
      const recipe = { ...action.recipe }
      return {
        ...state,
        guests: guests.map((g, i) => i === currentIndex ? { ...g, recipe, aiRecipe: recipe, flags: action.flags ?? g.flags } : g),
        history: [], future: [],
      }
    }

    case 'ADD_GUESTS': {
      // Append a batch of analysed guests. If the only existing guest is an untouched
      // blank, replace it so the list doesn't start with a stray "Guest".
      const incoming = action.guests.map(g => ({ ...blankGuest(g.name), ...g, id: g.id ?? newId() }))
      const onlyBlank = guests.length === 1 && guests[0].aiRecipe === null && guests[0].name === 'Guest'
      const nextGuests = onlyBlank ? incoming : [...guests, ...incoming]
      return { ...state, guests: nextGuests, currentIndex: onlyBlank ? 0 : currentIndex, history: [], future: [] }
    }

    case 'REMOVE_GUEST': {
      const nextGuests = guests.filter(g => g.id !== action.id)
      if (!nextGuests.length) return { ...state, guests: [blankGuest()], currentIndex: 0, history: [], future: [] }
      return { ...state, guests: nextGuests, currentIndex: Math.min(currentIndex, nextGuests.length - 1), history: [], future: [] }
    }

    case 'SET_CURRENT':
      return { ...state, currentIndex: Math.max(0, Math.min(guests.length - 1, action.index)), history: [], future: [] }

    case 'NAVIGATE': {
      const next = Math.max(0, Math.min(guests.length - 1, currentIndex + action.delta))
      if (next === currentIndex) return state
      return { ...state, currentIndex: next, history: [], future: [] }
    }

    case 'SET_ORDER':
      return { ...state, order: { ...state.order, ...action.patch } }

    case 'LOAD_PROJECT': {
      const p = action.project
      if (!p || !Array.isArray(p.guests) || !p.guests.length) return state
      return {
        order: { ...DEFAULT_ORDER, ...(p.order ?? {}) },
        guests: p.guests,
        currentIndex: 0, history: [], future: [],
      }
    }

    case 'NEW_PROJECT':
      return { order: DEFAULT_ORDER, guests: [blankGuest()], currentIndex: 0, history: [], future: [] }

    default:
      return state
  }
}

const PERSIST_DEBOUNCE_MS = 500

export function CompositorProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { order, guests, currentIndex, history, future } = state

  // saveError: last save failed (quota/private mode) — surfaced in the UI, never silent.
  // externalChange: another tab wrote the same key — this tab's view may be stale.
  const [saveError, setSaveError] = useState(false)
  const [externalChange, setExternalChange] = useState(false)
  const selfWriteRef = useRef(false)

  // Debounced persist — avoids re-serialising the whole batch on every keystroke.
  const timerRef = useRef(null)
  const latestRef = useRef({ order, guests, currentIndex })

  const flush = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    selfWriteRef.current = true
    const ok = persist(latestRef.current)
    setSaveError(!ok)
  }, [])

  useEffect(() => {
    latestRef.current = { order, guests, currentIndex }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, PERSIST_DEBOUNCE_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [order, guests, currentIndex, flush])

  // Flush any pending write before the tab unloads so the last edit isn't lost.
  useEffect(() => {
    const onHide = () => { if (timerRef.current) flush() }
    window.addEventListener('beforeunload', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('beforeunload', onHide)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [flush])

  // Detect another tab writing the same batch — last-writer-wins would otherwise be silent.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return
      if (selfWriteRef.current) { selfWriteRef.current = false; return }
      setExternalChange(true)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Stable action creators (dispatch is stable) so consumers/effects don't churn each render.
  const swapAsset        = useCallback((category, assetName) => dispatch({ type: 'SWAP_ASSET', category, assetName }), [])
  const setColour        = useCallback((colourType, hex)     => dispatch({ type: 'SET_COLOUR', colourType, hex }), [])
  const loadFromAnalysis = useCallback((recipe, flags)       => dispatch({ type: 'LOAD_FROM_ANALYSIS', recipe, flags }), [])
  const approve          = useCallback(() => dispatch({ type: 'SET_STATUS', status: 'approved' }), [])
  const flagRevision     = useCallback(() => dispatch({ type: 'SET_STATUS', status: 'needs_revision' }), [])
  const setStatusById    = useCallback((id, status) => dispatch({ type: 'SET_STATUS_BY_ID', id, status }), [])
  const setName          = useCallback((id, name)   => dispatch({ type: 'SET_NAME', id, name }), [])
  const reset            = useCallback(() => dispatch({ type: 'RESET' }), [])
  const undo             = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo             = useCallback(() => dispatch({ type: 'REDO' }), [])
  const prevGuest        = useCallback(() => dispatch({ type: 'NAVIGATE', delta: -1 }), [])
  const nextGuest        = useCallback(() => dispatch({ type: 'NAVIGATE', delta: 1 }), [])
  const setCurrent       = useCallback((index) => dispatch({ type: 'SET_CURRENT', index }), [])
  const addGuests        = useCallback((newGuests) => dispatch({ type: 'ADD_GUESTS', guests: newGuests }), [])
  const removeGuest      = useCallback((id) => dispatch({ type: 'REMOVE_GUEST', id }), [])
  const setOrder         = useCallback((patch) => dispatch({ type: 'SET_ORDER', patch }), [])
  const loadProject      = useCallback((project) => dispatch({ type: 'LOAD_PROJECT', project }), [])
  const newProject       = useCallback(() => dispatch({ type: 'NEW_PROJECT' }), [])
  const dismissExternalChange = useCallback(() => setExternalChange(false), [])

  const value = useMemo(() => ({
    order,
    guests,
    currentGuest: guests[currentIndex],
    currentIndex,
    totalGuests: guests.length,
    approvedCount: guests.filter(g => g.status === 'approved').length,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
    saveError,
    externalChange,
    dismissExternalChange,
    swapAsset, setColour, loadFromAnalysis, approve, flagRevision, setStatusById,
    setName, reset, undo, redo, prevGuest, nextGuest, setCurrent, addGuests,
    removeGuest, setOrder, loadProject, newProject,
  }), [
    order, guests, currentIndex, history.length, future.length, saveError, externalChange,
    dismissExternalChange, swapAsset, setColour, loadFromAnalysis, approve, flagRevision,
    setStatusById, setName, reset, undo, redo, prevGuest, nextGuest, setCurrent, addGuests,
    removeGuest, setOrder, loadProject, newProject,
  ])

  return <CompositorContext.Provider value={value}>{children}</CompositorContext.Provider>
}
