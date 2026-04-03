import { useReducer, useEffect, useCallback } from 'react'
import { MOCK_GUESTS } from '../data/mockGuests'

const STORAGE_KEY = 'mishph_compositor_v1'
const MAX_HISTORY = 10

// ─── localStorage helpers ────────────────────────────────────────────────────

function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function persistGuests(guests) {
  try {
    const toSave = {}
    guests.forEach(g => {
      toSave[g.id] = { recipe: g.recipe, status: g.status }
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch {}
}

// ─── Initial state ───────────────────────────────────────────────────────────

function buildInitialGuests() {
  const saved = loadSavedState()
  return MOCK_GUESTS.map(g => ({
    ...g,
    recipe: saved[g.id]?.recipe ?? g.recipe,
    status: saved[g.id]?.status ?? g.status,
  }))
}

const initialState = {
  guests: buildInitialGuests(),
  currentIndex: 0,
  history: [],   // array of recipe snapshots for current guest
  future: [],    // redo stack
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

function reducer(state, action) {
  const { guests, currentIndex, history, future } = state
  const current = guests[currentIndex]

  switch (action.type) {
    case 'SWAP_ASSET': {
      const newRecipe = {
        ...current.recipe,
        assets: { ...current.recipe.assets, [action.category]: action.assetName },
      }
      return {
        ...state,
        guests: guests.map((g, i) => i === currentIndex ? { ...g, recipe: newRecipe } : g),
        history: [...history.slice(-(MAX_HISTORY - 1)), current.recipe],
        future: [],
      }
    }

    case 'SET_COLOUR': {
      const newRecipe = {
        ...current.recipe,
        colours: { ...current.recipe.colours, [action.colourType]: action.hex },
      }
      return {
        ...state,
        guests: guests.map((g, i) => i === currentIndex ? { ...g, recipe: newRecipe } : g),
        history: [...history.slice(-(MAX_HISTORY - 1)), current.recipe],
        future: [],
      }
    }

    case 'SET_STATUS': {
      return {
        ...state,
        guests: guests.map((g, i) => i === currentIndex ? { ...g, status: action.status } : g),
      }
    }

    case 'RESET': {
      const originalRecipe = MOCK_GUESTS[currentIndex].recipe
      return {
        ...state,
        guests: guests.map((g, i) => i === currentIndex ? { ...g, recipe: originalRecipe } : g),
        history: [...history.slice(-(MAX_HISTORY - 1)), current.recipe],
        future: [],
      }
    }

    case 'UNDO': {
      if (!history.length) return state
      const prevRecipe = history[history.length - 1]
      return {
        ...state,
        guests: guests.map((g, i) => i === currentIndex ? { ...g, recipe: prevRecipe } : g),
        history: history.slice(0, -1),
        future: [...future, current.recipe],
      }
    }

    case 'REDO': {
      if (!future.length) return state
      const nextRecipe = future[future.length - 1]
      return {
        ...state,
        guests: guests.map((g, i) => i === currentIndex ? { ...g, recipe: nextRecipe } : g),
        history: [...history, current.recipe],
        future: future.slice(0, -1),
      }
    }

    case 'LOAD_FROM_ANALYSIS': {
      // Replace the current guest's recipe with the AI-matched result.
      // Clears undo/redo history — the loaded recipe is the new baseline.
      return {
        ...state,
        guests: guests.map((g, i) =>
          i === currentIndex ? { ...g, recipe: action.recipe } : g
        ),
        history: [],
        future: [],
      }
    }

    case 'NAVIGATE': {
      const next = Math.max(0, Math.min(guests.length - 1, currentIndex + action.delta))
      if (next === currentIndex) return state
      return {
        ...state,
        currentIndex: next,
        history: [],
        future: [],
      }
    }

    default:
      return state
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCompositor() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { guests, currentIndex, history, future } = state
  const currentGuest = guests[currentIndex]

  // Persist to localStorage on every change
  useEffect(() => {
    persistGuests(guests)
  }, [guests])

  // Keyboard shortcuts
  const prevGuest = useCallback(() => dispatch({ type: 'NAVIGATE', delta: -1 }), [])
  const nextGuest = useCallback(() => dispatch({ type: 'NAVIGATE', delta: 1 }), [])
  const approve = useCallback(() => dispatch({ type: 'SET_STATUS', status: 'approved' }), [])
  const flagRevision = useCallback(() => dispatch({ type: 'SET_STATUS', status: 'needs_revision' }), [])
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [])

  useEffect(() => {
    function onKeyDown(e) {
      // Don't intercept when typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key === 'ArrowLeft') { e.preventDefault(); prevGuest() }
      if (e.key === 'ArrowRight') { e.preventDefault(); nextGuest() }
      if (e.key === 'a' || e.key === 'A') approve()
      if (e.key === 'r' || e.key === 'R') flagRevision()
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [prevGuest, nextGuest, approve, flagRevision, undo, redo])

  return {
    guests,
    currentGuest,
    currentIndex,
    totalGuests: guests.length,
    canUndo: history.length > 0,
    canRedo: future.length > 0,

    swapAsset: (category, assetName) => dispatch({ type: 'SWAP_ASSET', category, assetName }),
    setColour: (colourType, hex) => dispatch({ type: 'SET_COLOUR', colourType, hex }),
    loadFromAnalysis: (recipe) => dispatch({ type: 'LOAD_FROM_ANALYSIS', recipe }),
    approve,
    flagRevision,
    reset: () => dispatch({ type: 'RESET' }),
    undo,
    redo,
    prevGuest,
    nextGuest,
  }
}
