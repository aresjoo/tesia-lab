import { useLayoutEffect, useRef, useState, type AnimationEvent } from 'react'

// Only the exiting DOM is retained. Focus, input and background locks belong to open.
export function useClientSurfacePresence(open: boolean, { exitAnimationName, fallbackMs = 260 }: { exitAnimationName?: string; fallbackMs?: number } = {}) {
  const [state, setState] = useState({ open, present: open, generation: 0 })
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  if (state.open !== open) setState({ open, present: open || state.present, generation: state.generation + 1 })
  const present = open || (state.present && !reduced)
  const closing = !open && present
  const current = useRef(state)
  useLayoutEffect(() => { current.current = state }, [state])
  useLayoutEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReduced(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  useLayoutEffect(() => {
    if (open || !state.present) return
    const generation = state.generation
    const finish = () => setState(value => !value.open && value.generation === generation ? { ...value, present: false } : value)
    if (reduced) { finish(); return }
    // Source fallback also covers animationcancel / no animationend in background tabs.
    const timer = setTimeout(finish, fallbackMs)
    return () => clearTimeout(timer)
  }, [open, reduced, state.generation, state.present, fallbackMs])
  const onAnimationEnd = (event: AnimationEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || !['client-surface-out', 'client-surface-sheet-out', 'client-locale-out', 'client-locale-sheet-out', exitAnimationName].includes(event.animationName)) return
    const generation = state.generation
    if (current.current.open || current.current.generation !== generation) return
    setState(value => !value.open && value.generation === generation ? { ...value, present: false } : value)
  }
  return { present, closing, onAnimationEnd }
}

export const activeClientSurfaceSelector = '.ca-menu-layer:not([data-surface-active="false"]),.ca-auth-veil,.ca-feedback-layer:not([data-surface-active="false"]),.client-modal-help:not([data-surface-active="false"]),.client-preferences-layer:not([data-surface-active="false"])'
