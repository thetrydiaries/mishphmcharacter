import { createContext, useContext } from 'react'

// Context object + hook kept separate from the provider component so the provider
// file only exports a component (React Fast Refresh requirement).
export const CompositorContext = createContext(null)

export function useCompositor() {
  const ctx = useContext(CompositorContext)
  if (!ctx) throw new Error('useCompositor must be used within <CompositorProvider>')
  return ctx
}
