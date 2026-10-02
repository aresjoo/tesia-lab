import { useSyncExternalStore } from 'react'
import { MousePointer2, TrendingUp, MoveUpRight, Minus, MoveVertical, Square, ChartNoAxesCombined, Ruler, Undo2, Redo2, Eye, EyeOff, Trash2 } from 'lucide-react'
import { PriceDrawings, drawingTools } from '../chart/price-drawings'
import { priceDrawingCopy } from '../chart/price-drawing-copy'
import { useClientPreferences } from '../client-preferences'
import { professionalChartLocale } from '../client-professional-chart-locale'
import '../client-price-drawings.css'

const icons = { cursor: MousePointer2, trend: TrendingUp, ray: MoveUpRight, horizontal: Minus, vertical: MoveVertical, rectangle: Square, fibonacci: ChartNoAxesCombined, measure: Ruler }
export function ClientPriceDrawingTools({ drawings }: { drawings: PriceDrawings }) {
  const state = useSyncExternalStore(drawings.subscribe, drawings.getSnapshot), { language } = useClientPreferences(), text = priceDrawingCopy(language)
  return <div className="cp-drawing-tools" role="group" aria-label={text.group}>
    {drawingTools.map(tool => { const Icon = icons[tool]; return <button key={tool} type="button" aria-label={text[tool]} title={text[tool]} aria-pressed={state.tool === tool} disabled={!state.enabled || (tool !== 'cursor' && state.items.length >= 100)} onClick={() => drawings.choose(tool)}><Icon size={18}/></button> })}
    <span className="cp-drawing-divider" aria-hidden="true"/>
    <button type="button" title={text.undo} aria-label={text.undo} disabled={!state.enabled || !state.canUndo} onClick={() => drawings.undo()}><Undo2 size={18}/></button>
    <button type="button" title={text.redo} aria-label={text.redo} disabled={!state.enabled || !state.canRedo} onClick={() => drawings.redo()}><Redo2 size={18}/></button>
    <button type="button" title={state.hidden ? text.show : text.hide} aria-label={state.hidden ? text.show : text.hide} disabled={!state.enabled || !state.items.length} onClick={() => drawings.toggleHidden()}>{state.hidden ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
    <button type="button" title={text.remove} aria-label={text.remove} disabled={!state.enabled || state.selected === null} onClick={() => drawings.removeSelected()}><Trash2 size={18}/></button>
  </div>
}

export function ClientPriceDrawingDetails({ drawings, precision }: { drawings: PriceDrawings; precision: number }) {
  const state = useSyncExternalStore(drawings.subscribe, drawings.getSnapshot), { language } = useClientPreferences(), text = priceDrawingCopy(language), format = professionalChartLocale(language)
  const selected = state.items.find(item => item.id === state.selected)
  const hint = !state.enabled ? '' : state.editing ? text.edit : state.pending ? text.second : state.tool !== 'cursor' ? text.first : state.items.length >= 100 ? text.limit : ''
  return <div className="cp-drawing-details" data-drawing-count={state.items.length} data-drawing-hidden={state.hidden}>
    <p className="cp-drawing-hint" role="status">{hint}</p>
    {selected && state.enabled && <div className="cp-drawing-edit"><span>{text[selected.kind]} {selected.id}</span><button type="button" aria-pressed={state.editing === 'a'} onClick={() => drawings.edit('a')}>{text.start}</button>{!['horizontal', 'vertical'].includes(selected.kind) && <button type="button" aria-pressed={state.editing === 'b'} onClick={() => drawings.edit('b')}>{text.end}</button>}</div>}
    {state.items.length > 0 && <details><summary>{text.list} · {format.price(state.items.length)}</summary><p>{text.local}</p><ol>{state.items.map(item => <li key={item.id}><button type="button" disabled={!state.enabled} aria-pressed={state.selected === item.id} onClick={() => drawings.select(item.id)}><span>{text[item.kind]} {item.id}</span><small>{format.utc(item.a.time)} UTC · {format.axisPrice(precision)(item.a.price)}{!['horizontal', 'vertical'].includes(item.kind) && <> → {format.utc(item.b.time)} UTC · {format.axisPrice(precision)(item.b.price)}</>}</small></button></li>)}</ol></details>}
  </div>
}
