import { useEffect, useState } from 'react'
import '../teth-probability.css'

/** 모델 <prob/> 태그의 표시 전용 투영. 값 검증은 teth-chips-schema 가 끝냈다. */
export function TethProbability({ up, down }: { up: number; down: number }) {
  const [shown, setShown] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches ? up : 0)
  useEffect(() => {
    if (shown === up) return
    let frame = 0
    const startedAt = performance.now()
    const from = shown
    const step = (now: number) => {
      const linear = Math.min(1, (now - startedAt) / 600)
      const eased = linear * linear * (3 - 2 * linear)
      const value = Math.round(from + (up - from) * eased)
      setShown(value)
      if (linear < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [up])
  return <div className="teth-prob" role="img" aria-label={`상승 확률 ${up}%, 하락 확률 ${down}%`}>
    <div className="teth-prob-head" aria-hidden="true">
      <span className="teth-prob-up">상승 {shown}%</span>
      <span className="teth-prob-down">하락 {100 - shown}%</span>
    </div>
    <div className="teth-prob-bar" aria-hidden="true"><span style={{ width: `${shown}%` }} /></div>
  </div>
}
