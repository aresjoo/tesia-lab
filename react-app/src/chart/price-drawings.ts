import type { IPrimitivePaneRenderer, ISeriesPrimitive, MouseEventParams, SeriesAttachedParameter, Time, UTCTimestamp } from 'lightweight-charts'
import { createDrawingTimeProjection } from './drawing-time-projection'

export const drawingTools = ['cursor', 'trend', 'ray', 'horizontal', 'vertical', 'rectangle', 'fibonacci', 'measure'] as const
export type DrawingTool = typeof drawingTools[number]
export type DrawingAnchor = Readonly<{ time: number; price: number }>
export type PriceDrawing = Readonly<{ id: number; kind: Exclude<DrawingTool, 'cursor'>; a: DrawingAnchor; b: DrawingAnchor }>
type XY = { x: number; y: number }
type Projected = { drawing: PriceDrawing; a: XY; b: XY }
type Snapshot = Readonly<{ items: readonly PriceDrawing[]; selected: number | null; tool: DrawingTool; pending: boolean; hidden: boolean; enabled: boolean; canUndo: boolean; canRedo: boolean; editing: 'a' | 'b' | null }>
const valid = (p: DrawingAnchor) => Number.isSafeInteger(p.time) && p.time >= 0 && p.time <= 253_402_300_799 && Number.isFinite(p.price) && p.price > 0
const single = (tool: DrawingTool) => tool === 'horizontal' || tool === 'vertical'
const distance = (p: XY, a: XY, b: XY) => {
  const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}

/** Local annotations, never market observations or order inputs. A single
 * primitive uses the chart's repaint scheduler; no background animation loop. */
export class PriceDrawings implements ISeriesPrimitive<Time> {
  private attachment: SeriesAttachedParameter<Time> | null = null
  private listeners = new Set<() => void>()
  private state: Snapshot = { items: [], selected: null, tool: 'cursor', pending: false, hidden: false, enabled: false, canUndo: false, canRedo: false, editing: null }
  private past: (readonly PriceDrawing[])[] = []
  private future: (readonly PriceDrawing[])[] = []
  private nextId = 0
  private draft: PriceDrawing | null = null
  private projected: Projected[] = []
  private keyboardAnchor: DrawingAnchor | null = null
  private scope: string | null = null
  private projectTime = createDrawingTimeProjection([], 1)
  private tick = .01
  private focusSurface = () => {}
  private number = (n: number) => String(n)
  private color = '#a6aab2'
  private activeColor = '#e6e7ea'
  private readonly renderer: IPrimitivePaneRenderer = { draw: target => {
    if (!this.state.enabled || this.state.hidden) return
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize: { width, height } }) => {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.clip()
      for (const item of this.projected) this.paint(ctx, item, width, height)
      ctx.restore()
    })
  } }
  private readonly views = [{ zOrder: () => 'top' as const, renderer: () => this.renderer }]
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = () => this.state
  paneViews = () => this.views
  attached(params: SeriesAttachedParameter<Time>) { this.attachment = params }
  detached() { this.attachment = null; this.projected = [] }
  configure(options: { focus: () => void; precision: number; number: (n: number) => string; color: string; activeColor: string }) {
    this.focusSurface = options.focus; this.tick = 10 ** -options.precision; this.number = options.number
    this.color = options.color; this.activeColor = options.activeColor; this.refresh()
  }
  private refresh() { this.attachment?.requestUpdate() }
  private publish(patch: Partial<Snapshot>) {
    this.state = { ...this.state, ...patch, canUndo: this.past.length > 0, canRedo: this.future.length > 0 }
    this.listeners.forEach(listener => listener()); this.refresh()
  }
  setEnabled(enabled: boolean) {
    if (this.state.enabled === enabled) return
    this.draft = null; this.publish({ enabled, pending: false, editing: null, tool: 'cursor' })
  }
  setScope(scope: string) {
    if (this.scope === scope) return false
    this.scope = scope; this.past = []; this.future = []; this.draft = null; this.projected = []; this.keyboardAnchor = null; this.nextId = 0
    this.publish({ items: [], selected: null, tool: 'cursor', pending: false, editing: null, hidden: false })
    return true
  }
  setDomain(bars: readonly { time: number }[], resolutionSeconds: number) {
    this.projectTime = createDrawingTimeProjection(bars, resolutionSeconds)
    this.projected = []; this.refresh()
  }
  setKeyboardAnchor(anchor: DrawingAnchor) {
    if (!valid(anchor)) return
    this.keyboardAnchor = anchor
    if (this.draft) { this.draft = { ...this.draft, b: anchor }; this.refresh() }
  }
  choose(tool: DrawingTool) {
    if (!this.state.enabled) return
    this.draft = null; this.publish({ tool, pending: false, editing: null, hidden: false, selected: null }); this.focusSurface()
  }
  cancel() { this.draft = null; this.publish({ tool: 'cursor', pending: false, editing: null, selected: null }) }
  toggleHidden() { if (this.state.enabled) { this.draft = null; this.publish({ hidden: !this.state.hidden, pending: false, editing: null, tool: 'cursor', selected: null }) } }
  select(id: number) { if (this.state.enabled && this.state.items.some(item => item.id === id)) { this.draft = null; this.publish({ selected: id, hidden: false, tool: 'cursor', pending: false, editing: null }) } }
  edit(endpoint: 'a' | 'b') {
    if (!this.state.enabled || this.state.selected === null) return
    this.draft = null; this.publish({ editing: endpoint, tool: 'cursor', pending: false, hidden: false }); this.focusSurface()
  }
  private commit(items: readonly PriceDrawing[]) {
    this.past = [...this.past.slice(-49), this.state.items]; this.future = []; this.draft = null
    this.publish({ items, pending: false, editing: null, tool: 'cursor' })
  }
  removeSelected() {
    if (this.state.enabled && this.state.selected !== null) { this.commit(this.state.items.filter(item => item.id !== this.state.selected)); this.publish({ selected: null }); this.focusSurface() }
  }
  undo() {
    if (!this.state.enabled || !this.past.length) return
    this.future = [...this.future, this.state.items]; const items = this.past.pop()!
    this.draft = null; this.publish({ items, selected: null, tool: 'cursor', pending: false, editing: null }); this.focusSurface()
  }
  redo() {
    if (!this.state.enabled || !this.future.length) return
    this.past = [...this.past, this.state.items]; const items = this.future.pop()!
    this.draft = null; this.publish({ items, selected: null, tool: 'cursor', pending: false, editing: null }); this.focusSurface()
  }
  place(anchor: DrawingAnchor) {
    if (!this.state.enabled || this.state.hidden || !valid(anchor)) return false
    if (this.state.editing && this.state.selected !== null) {
      const selected = this.state.selected, endpoint = this.state.editing
      this.commit(this.state.items.map(item => item.id !== selected ? item : { ...item, [endpoint]: anchor, ...(single(item.kind) ? { a: anchor, b: anchor } : {}) }))
      return true
    }
    if (this.state.tool === 'cursor') return false
    if (this.state.items.length >= 100) return true
    if (!this.draft) {
      this.draft = { id: ++this.nextId, kind: this.state.tool, a: anchor, b: anchor }
      if (!single(this.state.tool)) { this.publish({ pending: true }); return true }
    } else this.draft = { ...this.draft, b: anchor }
    const drawing = this.draft
    if (!single(drawing.kind) && drawing.a.time === drawing.b.time && drawing.a.price === drawing.b.price) return true
    this.commit([...this.state.items, drawing]); this.publish({ selected: drawing.id }); return true
  }
  private anchor(event: MouseEventParams<Time>) {
    if (event.paneIndex !== undefined && event.paneIndex !== 0 || !event.point || typeof event.time !== 'number' || !this.attachment) return null
    const price = this.attachment.series.coordinateToPrice(event.point.y)
    const anchor = { time: event.time, price: price ?? NaN }
    return valid(anchor) ? anchor : null
  }
  move(event: MouseEventParams<Time>) {
    if (!this.state.enabled || !this.draft) return
    const anchor = this.anchor(event)
    if (anchor) { this.draft = { ...this.draft, b: anchor }; this.refresh() }
  }
  placePoint(x: number, y: number) {
    const attachment = this.attachment
    if (!attachment || x < 0 || x >= attachment.chart.timeScale().width() || y < 0 || y >= attachment.series.getPane().getHeight()) return false
    const time = attachment.chart.timeScale().coordinateToTime(x), price = attachment.series.coordinateToPrice(y)
    if (typeof time !== 'number' || price === null) return false
    const anchor = { time, price }
    if (!valid(anchor)) return false
    this.keyboardAnchor = anchor
    return this.place(anchor)
  }
  click(event: MouseEventParams<Time>) {
    if (!this.state.enabled || this.state.hidden) return false
    const anchor = this.anchor(event)
    if (!anchor) return this.state.tool !== 'cursor' || this.state.editing !== null
    this.keyboardAnchor = anchor
    if (this.place(anchor)) return true
    const { point } = event
    if (!point) return false
    const width = this.attachment?.chart.timeScale().width() ?? 0, height = this.attachment?.series.getPane().getHeight() ?? 0
    const hit = [...this.projected].reverse().find(item => this.segments(item, width, height).some(([a, b]) => distance(point, a, b) < 8))
    this.publish({ selected: hit?.drawing.id ?? null })
    return Boolean(hit)
  }
  key(event: KeyboardEvent) {
    if (!this.state.enabled || event.isComposing || event.altKey) return false
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { if (event.shiftKey) this.redo(); else this.undo(); return true }
    if (event.ctrlKey || event.metaKey) return false
    if (event.key === 'Escape' && (this.state.tool !== 'cursor' || this.state.selected !== null || this.state.editing)) { this.cancel(); return true }
    if ((event.key === 'Delete' || event.key === 'Backspace') && this.state.selected !== null) { this.removeSelected(); return true }
    if (this.state.tool === 'cursor' && !this.state.editing) return false
    if (event.key === 'Enter' && this.keyboardAnchor) return this.place(this.keyboardAnchor)
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && this.keyboardAnchor && this.attachment) {
      const anchor = { ...this.keyboardAnchor, price: this.keyboardAnchor.price + (event.key === 'ArrowUp' ? 1 : -1) * this.tick * (event.shiftKey ? 10 : 1) }
      if (valid(anchor)) {
        this.keyboardAnchor = anchor
        this.attachment.chart.setCrosshairPosition(anchor.price, anchor.time as UTCTimestamp, this.attachment.series)
        if (this.draft) { this.draft = { ...this.draft, b: anchor }; this.refresh() }
      }
      return true
    }
    return false
  }
  updateAllViews() {
    const attachment = this.attachment
    if (!attachment) return
    const project = (anchor: DrawingAnchor, horizontal: boolean): XY | null => {
      const x = horizontal ? 0 : this.projectTime(anchor.time, attachment.chart.timeScale()), y = attachment.series.priceToCoordinate(anchor.price)
      return x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y) ? null : { x, y }
    }
    this.projected = [...this.state.items, ...(this.draft ? [this.draft] : [])].flatMap(drawing => {
      const a = project(drawing.a, drawing.kind === 'horizontal'), b = project(drawing.b, drawing.kind === 'horizontal')
      return a && b ? [{ drawing, a, b }] : []
    })
  }
  private segments({ drawing, a, b }: Projected, width: number, height: number): [XY, XY][] {
    switch (drawing.kind) {
      case 'horizontal': return [[{ x: 0, y: a.y }, { x: width, y: a.y }]]
      case 'vertical': return [[{ x: a.x, y: 0 }, { x: a.x, y: height }]]
      case 'rectangle': return [[a, { x: b.x, y: a.y }], [{ x: b.x, y: a.y }, b], [b, { x: a.x, y: b.y }], [{ x: a.x, y: b.y }, a]]
      case 'fibonacci': return [0, .236, .382, .5, .618, .786, 1].map(ratio => {
        const price = drawing.a.price + (drawing.b.price - drawing.a.price) * ratio
        const y = this.attachment?.series.priceToCoordinate(price)
        return [{ x: a.x, y: y ?? a.y }, { x: b.x, y: y ?? a.y }]
      })
      case 'ray': {
        const dx = b.x - a.x, dy = b.y - a.y
        const tx = dx > 0 ? (width - a.x) / dx : dx < 0 ? -a.x / dx : Infinity
        const ty = dy > 0 ? (height - a.y) / dy : dy < 0 ? -a.y / dy : Infinity
        const t = Math.min(tx > 0 ? tx : Infinity, ty > 0 ? ty : Infinity)
        return Number.isFinite(t) ? [[a, { x: a.x + dx * t, y: a.y + dy * t }]] : [[a, b]]
      }
      default: return [[a, b]]
    }
  }
  private paint(ctx: CanvasRenderingContext2D, item: Projected, width: number, height: number) {
    const { drawing, a, b } = item, selected = drawing.id === this.state.selected || drawing.id === this.draft?.id
    ctx.strokeStyle = selected ? this.activeColor : this.color; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 1.5
    ctx.setLineDash(drawing.id === this.draft?.id ? [4, 4] : [])
    if (drawing.kind === 'rectangle') { ctx.globalAlpha = .08; ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.globalAlpha = 1 }
    const segments = this.segments(item, width, height)
    segments.forEach(([start, end], index) => {
      ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke()
      if (drawing.kind === 'fibonacci') {
        ctx.font = '11px sans-serif'; ctx.fillText(`${[0, 23.6, 38.2, 50, 61.8, 78.6, 100][index]}%`, Math.max(4, Math.min(width - 44, Math.min(a.x, b.x) + 4)), start.y - 4)
      }
    })
    if (drawing.kind === 'measure') {
      const change = drawing.b.price - drawing.a.price, pct = change / drawing.a.price * 100
      ctx.font = '12px sans-serif'
      const label = `${change >= 0 ? '+' : ''}${this.number(change)} (${this.number(pct)}%)`
      ctx.fillText(label, Math.max(4, Math.min(width - ctx.measureText(label).width - 4, (a.x + b.x) / 2)), Math.max(14, Math.min(height - 4, (a.y + b.y) / 2 - 10)), Math.max(1, width - 8))
    }
    if (selected) for (const point of single(drawing.kind) ? [a] : [a, b]) {
      ctx.setLineDash([]); ctx.beginPath(); ctx.arc(point.x, point.y, 4, 0, Math.PI * 2); ctx.stroke()
    }
  }
}
