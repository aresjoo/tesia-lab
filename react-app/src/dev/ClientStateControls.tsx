import { useEffect, useId, useRef, useState } from 'react'
import { SOURCE_QA_ROWS, sourceQaEnabled, type SourceQaKey, type SourceQaState } from './client-state-preview-model'
import './client-state-preview.css'

/** Source QA controls only. The parent owns an isolated, volatile fixture. */
export function ClientStateControls({ state, onToggle, onReset }: {
  state: SourceQaState; onToggle: (key: SourceQaKey) => void; onReset: () => void
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null)
  const id = useId(), titleId = useId(), hintId = useId()
  useEffect(() => { if (open) panel.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }) }, [open])
  return <div className="source-qa-controls" onKeyDown={event => {
    if (event.key === 'Escape' && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229 && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus({ preventScroll: true })
    }
  }}>
    <button ref={trigger} className={`source-qa-trigger${open ? ' on' : ''}`} type="button" aria-label="데모 상태 조작 패널" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}>QA</button>
    {open && <div ref={panel} className="source-qa-panel" role="dialog" aria-modal="false" aria-labelledby={titleId} aria-describedby={hintId} id={id}>
      <h4 id={titleId}>데모 상태 조작</h4>
      <div className="hint" id={hintId}>토글하면 현재 화면이 그 상태로 다시 그려져요</div>
      {SOURCE_QA_ROWS.map(([key, label]) => {
        const on = sourceQaEnabled(state, key)
        return <button className="row" type="button" key={key} data-qa-key={key} aria-label={label} aria-pressed={on} onClick={() => onToggle(key)}><span>{label}</span><span className={`st${on ? ' on' : ''}`} aria-hidden="true">{on ? 'ON' : 'OFF'}</span></button>
      })}
      <button className="reset" type="button" onClick={onReset}>전부 초기화 (게스트)</button>
    </div>}
  </div>
}
