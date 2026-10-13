import { useEffect, useState } from 'react'
import { readExecutionMinimum, type ExecutionMinimumQuote } from './client-execution-minimum'

export function useExecutionMinimum(enabled: boolean) {
  const [quote, setQuote] = useState<ExecutionMinimumQuote | null>(null)
  useEffect(() => {
    if (!enabled || !import.meta.env.DEV) return
    const controller = new AbortController(); let next: ReturnType<typeof setTimeout> | undefined, expiry: ReturnType<typeof setTimeout> | undefined
    const read = async () => {
      const value = await readExecutionMinimum(controller.signal)
      if (controller.signal.aborted) return
      setQuote(value)
      if (expiry) clearTimeout(expiry)
      if (value) expiry = setTimeout(() => setQuote(null), Math.max(0, Date.parse(value.expiresAt) - Date.now()))
      next = setTimeout(() => { void read() }, 2000)
    }
    void read()
    return () => { controller.abort(); clearTimeout(next); clearTimeout(expiry) }
  }, [enabled])
  return enabled ? quote : null
}
