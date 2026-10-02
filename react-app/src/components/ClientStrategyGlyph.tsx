import type { StrategyKind } from '../client-strategy-classification'
import { validStrategyGlyph, type StrategyGlyphEvidence, type StrategyMarkerShape } from '../client-strategy-identity'

const bright = '#e9ebee', dim = 'rgba(233,235,238,.34)'
const fixed = (value: number) => value.toFixed(1)

function Mark({ x, y, radius, shape, fill }: { x: number; y: number; radius: number; shape: StrategyMarkerShape; fill: string }) {
  return shape === 'circle' ? <circle cx={fixed(x)} cy={fixed(y)} r={fixed(radius)} fill={fill}/> :
    <rect x={fixed(x-radius)} y={fixed(y-radius)} width={fixed(radius*2)} height={fixed(radius*2)} rx={shape === 'square' ? '.6' : '.4'} fill={fill}
      transform={shape === 'diamond' ? `rotate(45 ${fixed(x)} ${fixed(y)})` : undefined}/>
}
function points(count: number, cx: number, cy: number, width: number, height: number) {
  const columns = count <= 3 ? count : count <= 6 ? 3 : 4, rows = Math.ceil(count / columns)
  return Array.from({ length: count }, (_, i) => [cx+(columns > 1 ? (i%columns/(columns-1)-.5)*width : 0), cy+(rows > 1 ? (Math.floor(i/columns)/(rows-1)-.5)*height : 0)])
}
function Curve({ evidence, small }: { evidence: Exclude<StrategyGlyphEvidence, { kind: 'agent' }>; small: boolean }) {
  const threshold = evidence.rsiThreshold, depth = threshold <= 26 ? 19 : threshold <= 32 ? 16 : threshold <= 40 ? 13 : threshold <= 46 ? 10 : threshold <= 50 ? 7 : 4
  // Source uses a neutral target shape when no take-profit is configured.
  const target = evidence.targetPercent || 8, level = target <= 5 ? 0 : target <= 8 ? 1 : target <= 15 ? 2 : 3
  const start = small ? 14.5 : 5, end = small ? 25 : 24, width = end-start
  const bottomX = start+width*.3, endX = bottomX+width*.22+level*(width > 15 ? 3 : 1.7), endY = 5+depth-Math.min(depth,3+level*1.7)
  return <>
    <path d={`M${fixed(start)} 5L${fixed(bottomX)} ${5+depth}L${fixed(endX)} ${fixed(endY)}`} fill="none" stroke={bright} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    <Mark x={endX} y={endY} radius={small ? 1.8 : 2.1} shape={small ? 'circle' : evidence.shape} fill={bright}/>
    {evidence.trendFilter && <path d={`M${fixed(start-1.6)} 4v20`} stroke={dim} strokeWidth="1.4" strokeLinecap="round"/>}
  </>
}
function Diagram({ evidence }: { evidence: StrategyGlyphEvidence }) {
  if (evidence.kind === 'rule') return <Curve evidence={evidence} small={false}/>
  const count = evidence.universeSize
  const dots = evidence.kind === 'agent' ? points(count,14,14,count <= 3 ? 14 : 17,count <= 3 ? 0 : 8)
    // Correct source mkDots(n,6.5,14,0,13): for n<=3 it put every point at y=14.
    : count <= 3 ? Array.from({ length: count }, (_, i) => [6.5,14+(count > 1 ? (i/(count-1)-.5)*13 : 0)])
      : Array.from({ length: count }, (_, i) => { const columns = count <= 6 ? 3 : 4; return [4.5+Math.floor(i/columns)*5,14+(i%columns/(columns-1)-.5)*(count <= 6 ? 12 : 15)] })
  return <>
    {dots.map(([x,y], index) => {
      const active = index < (evidence.kind === 'agent' ? evidence.selectedCount : 1)
      return <Mark key={index} x={x} y={y} shape={evidence.shape} radius={evidence.kind === 'agent' ? active ? 2.5 : 1.5 : active ? 2 : 1.2} fill={active ? bright : dim}/>
    })}
    {evidence.kind === 'mix' && <Curve evidence={evidence} small/>}
  </>
}

/** Source 412fd60 mkGlyph/B1, shared by 28px cards and 44px detail headings. */
export function ClientStrategyGlyph({ kind, evidence, size = 28 }: { kind?: StrategyKind; evidence?: StrategyGlyphEvidence; size?: 28 | 32 | 44 }) {
  return <svg className="strategy-glyph" width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" focusable="false">
    <rect x=".5" y=".5" width="27" height="27" rx="7" fill="#1a1d21" stroke="rgba(255,255,255,.14)"/>
    {validStrategyGlyph(kind, evidence) ? <Diagram evidence={evidence}/> : <path d="M8 14h12M14 8v12" stroke={bright} strokeWidth="1.7" strokeLinecap="round"/>}
  </svg>
}
