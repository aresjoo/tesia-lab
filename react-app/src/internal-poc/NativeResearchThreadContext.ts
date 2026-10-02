import { createContext, useContext, type ReactNode } from 'react'

export type NativeResearchThreadPort = {
  append: (lifetime: object, content: ReactNode) => void
  discard: (lifetime: object) => void
}
export const NativeResearchThreadContext = createContext<NativeResearchThreadPort | null>(null)
export const useNativeResearchThread = () => useContext(NativeResearchThreadContext)
