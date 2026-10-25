import { createContext, useContext, useReducer, useEffect, useCallback } from 'react'

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

const DEFAULT_ORDER = { charmSizeId: 'square40', styleId: 'classic' }

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

function persist({ order, guests, currentIndex }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, order, guests, currentIndex }))
  } catch (err) {
    // Most likely the quota was exceeded (too many/too-large photo thumbnails)
    console.warn('[compositor] could not persist batch:', err?.message)
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

// ─── Context + provider ────────────────────────────────────────────────────────

const Ctx = createContext(null)

export function CompositorProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { order, guests, currentIndex, history, future } = state

  useEffect(() => { persist({ order, guests, currentIndex }) }, [order, guests, currentIndex])

  const value = {
    order,
    guests,
    currentGuest: guests[currentIndex],
    currentIndex,
    totalGuests: guests.length,
    approvedCount: guests.filter(g => g.status === 'approved').length,
    canUndo: history.length > 0,
    canRedo: future.length > 0,

    swapAsset:        (category, assetName) => dispatch({ type: 'SWAP_ASSET', category, assetName }),
    setColour:        (colourType, hex)     => dispatch({ type: 'SET_COLOUR', colourType, hex }),
    loadFromAnalysis: (recipe, flags)       => dispatch({ type: 'LOAD_FROM_ANALYSIS', recipe, flags }),
    approve:          () => dispatch({ type: 'SET_STATUS', status: 'approved' }),
    flagRevision:     () => dispatch({ type: 'SET_STATUS', status: 'needs_revision' }),
    setStatusById:    (id, status) => dispatch({ type: 'SET_STATUS_BY_ID', id, status }),
    setName:          (id, name)   => dispatch({ type: 'SET_NAME', id, name }),
    reset:            () => dispatch({ type: 'RESET' }),
    undo:             () => dispatch({ type: 'UNDO' }),
    redo:             () => dispatch({ type: 'REDO' }),
    prevGuest:        () => dispatch({ type: 'NAVIGATE', delta: -1 }),
    nextGuest:        () => dispatch({ type: 'NAVIGATE', delta: 1 }),
    setCurrent:       (index) => dispatch({ type: 'SET_CURRENT', index }),
    addGuests:        (newGuests) => dispatch({ type: 'ADD_GUESTS', guests: newGuests }),
    removeGuest:      (id) => dispatch({ type: 'REMOVE_GUEST', id }),
    setOrder:         (patch) => dispatch({ type: 'SET_ORDER', patch }),
    loadProject:      (project) => dispatch({ type: 'LOAD_PROJECT', project }),
    newProject:       () => dispatch({ type: 'NEW_PROJECT' }),
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCompositor() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCompositor must be used within <CompositorProvider>')
  return ctx
}
