import { createContext } from 'react'

/** UI placement only. Caller owns which observed question is current. */
export const ClientQuestionDockContext = createContext<{
  activeKey: string | null
  target: HTMLDivElement | null
  setTarget: (target: HTMLDivElement | null) => void
} | null>(null)
