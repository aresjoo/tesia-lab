import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BENCHMARK_SERIES,
  getMockMarketCandles,
  getResultSeries,
  type BacktestResultMode,
  type ChartTimeframe,
  type MockMarketCandle,
} from '../backtest-data'
const chartLabels = ['20.01', '20.07', '21.01', '21.07', '22.01', '22.07', '23.01', '23.07', '24.01', '24.07', '25.01', '25.07', '25.12']
const CHART_PAD = { top: 18, right: 64, bottom: 31, left: 46 } as const
const formatSignedPercent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`

export function LiquidSignalCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    let raf = 0
    let visible = true
    let pageVisible = !document.hidden
    let pointerX = 0.72
    let pointerY = 0.28
    let canvasRect = canvas.getBoundingClientRect()
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reduceMotion = motionPreference.matches

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvasRect = rect
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const onPointerMove = (event: PointerEvent) => {
      pointerX = Math.max(0, Math.min(1, (event.clientX - canvasRect.left) / canvasRect.width))
      pointerY = Math.max(0, Math.min(1, (event.clientY - canvasRect.top) / canvasRect.height))
    }

    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect()
      context.clearRect(0, 0, width, height)

      const t = reduceMotion ? 1.4 : performance.now() * 0.00048
      const cx = width * (0.72 + Math.sin(t * 0.7) * 0.035 + (pointerX - 0.5) * 0.025)
      const cy = height * (0.12 + Math.cos(t * 0.62) * 0.06 + (pointerY - 0.5) * 0.02)

      context.save()
      context.globalCompositeOperation = 'screen'

      const glow = context.createRadialGradient(cx, cy, 4, cx, cy, Math.max(width * 0.24, 160))
      glow.addColorStop(0, 'rgba(115, 202, 255, .72)')
      glow.addColorStop(0.38, 'rgba(39, 111, 228, .42)')
      glow.addColorStop(1, 'rgba(5, 19, 45, 0)')
      context.fillStyle = glow
      context.beginPath()
      context.ellipse(cx, cy, width * 0.23, height * 0.8, -0.18 + Math.sin(t) * 0.08, 0, Math.PI * 2)
      context.fill()

      const bridgeX = width * (0.54 + Math.sin(t * 0.52) * 0.025)
      const bridgeY = height * 0.5
      const bridge = context.createRadialGradient(bridgeX, bridgeY, 0, bridgeX, bridgeY, width * 0.19)
      bridge.addColorStop(0, 'rgba(96, 184, 255, .34)')
      bridge.addColorStop(1, 'rgba(20, 81, 180, 0)')
      context.fillStyle = bridge
      context.beginPath()
      context.ellipse(bridgeX, bridgeY, width * 0.22, height * 0.52, 0.16, 0, Math.PI * 2)
      context.fill()
      context.restore()

      context.save()
      const sheen = context.createLinearGradient(width * 0.45, 0, width * 0.95, height)
      sheen.addColorStop(0, 'rgba(255,255,255,.42)')
      sheen.addColorStop(0.18, 'rgba(255,255,255,.04)')
      sheen.addColorStop(1, 'rgba(255,255,255,0)')
      context.strokeStyle = sheen
      context.lineWidth = 1
      context.beginPath()
      context.moveTo(width * 0.57, 0)
      context.bezierCurveTo(width * 0.66, height * 0.28, width * 0.8, height * 0.54, width * 0.9, height)
      context.stroke()
      context.restore()

      if (!reduceMotion && visible && pageVisible) {
        raf = window.requestAnimationFrame(draw)
      }
    }

    resize()
    draw()
    const observer = new ResizeObserver(() => { resize(); if (reduceMotion) draw() })
    observer.observe(canvas)
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      const nextVisible = entry.isIntersecting
      if (nextVisible && !visible && !reduceMotion && pageVisible) raf = window.requestAnimationFrame(draw)
      visible = nextVisible
      if (!visible) window.cancelAnimationFrame(raf)
    }, { threshold: 0.01 })
    visibilityObserver.observe(canvas)
    const interactionSurface = canvas.parentElement ?? canvas
    interactionSurface.addEventListener('pointerenter', resize, { passive: true })
    interactionSurface.addEventListener('pointermove', onPointerMove, { passive: true })
    const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
      reduceMotion = event.matches
      window.cancelAnimationFrame(raf)
      draw()
    }
    motionPreference.addEventListener('change', onMotionPreferenceChange)
    const onDocumentVisibilityChange = () => {
      pageVisible = !document.hidden
      window.cancelAnimationFrame(raf)
      if (pageVisible && visible) draw()
    }
    document.addEventListener('visibilitychange', onDocumentVisibilityChange)

    return () => {
      observer.disconnect()
      visibilityObserver.disconnect()
      interactionSurface.removeEventListener('pointerenter', resize)
      interactionSurface.removeEventListener('pointermove', onPointerMove)
      motionPreference.removeEventListener('change', onMotionPreferenceChange)
      document.removeEventListener('visibilitychange', onDocumentVisibilityChange)
      window.cancelAnimationFrame(raf)
    }
  }, [])

  return <canvas ref={canvasRef} className="liquid-signal-canvas" aria-hidden="true" />
}

export function ImaginationCanvas({ onImpact }: { onImpact?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onImpactRef = useRef(onImpact)

  useEffect(() => {
    onImpactRef.current = onImpact
  }, [onImpact])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    let raf = 0
    let visible = true
    let pointerX = 0.5
    let pointerY = 0.42
    let impactAnnounced = false
    let startTime = performance.now()
    let hiddenAt: number | null = null
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reduceMotion = motionPreference.matches
    const splashJets = [
      { x: -54, h: 17, r: 1.5 },
      { x: -38, h: 25, r: 2.1 },
      { x: -21, h: 13, r: .8 },
      { x: 8, h: 22, r: 1.15 },
      { x: 26, h: 16, r: .75 },
      { x: 41, h: 27, r: 1.8 },
      { x: 57, h: 12, r: .7 },
    ]
    const ripples = [
      { delay: 0, x: 0, y: 0, rotation: -.087, rx: .44, ry: .2 },
      { delay: .11, x: .007, y: -.002, rotation: -.052, rx: .52, ry: .235 },
      { delay: .245, x: -.011, y: .005, rotation: -.122, rx: .38, ry: .185 },
      { delay: .41, x: .004, y: -.003, rotation: -.07, rx: .57, ry: .255 },
    ]
    const particles = Array.from({ length: 23 }, (_, index) => {
      const layer = index < 8 ? 0 : index < 18 ? 1 : 2
      return {
        layer,
        x: ((index * 43.7 + 17) % 100) / 100,
        y: ((index * 71.3 + 29) % 100) / 100,
        phase: index * 1.77,
        radius: layer === 0 ? .42 + (index % 3) * .06 : layer === 1 ? .58 + (index % 4) * .09 : 1 + (index % 3) * .3,
      }
    })

    const announceImpact = () => {
      if (impactAnnounced) return
      impactAnnounced = true
      onImpactRef.current?.()
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointerX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
      pointerY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    }

    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect()
      const now = performance.now()
      const elapsed = reduceMotion ? 4 : (now - startTime) / 1000
      const t = reduceMotion ? 2.4 : (now - startTime) * 0.00032
      const impactAt = 1.42
      const postImpact = Math.max(0, Math.min(1, (elapsed - impactAt) / .92))
      const settled = postImpact * postImpact * (3 - 2 * postImpact)
      const impactX = width * .5
      const impactY = height * .375
      if (elapsed >= impactAt) announceImpact()
      context.clearRect(0, 0, width, height)

      context.save()
      context.globalCompositeOperation = 'screen'
      ;[
        { x: .22, y: .3, rx: .34, ry: .46, hue: '112, 197, 255', phase: 0 },
        { x: .72, y: .2, rx: .3, ry: .38, hue: '130, 161, 238', phase: 2.1 },
        { x: .58, y: .76, rx: .43, ry: .35, hue: '103, 232, 211', phase: 4.2 },
      ].forEach((field, index) => {
        const x = width * (field.x + Math.sin(t * (1.05 + index * .08) + field.phase) * .055 + (pointerX - .5) * .025)
        const y = height * (field.y + Math.cos(t * (.88 + index * .06) + field.phase) * .07 + (pointerY - .5) * .018)
        const radius = Math.max(width * field.rx, height * field.ry)
        const glow = context.createRadialGradient(x, y, 0, x, y, radius)
        glow.addColorStop(0, `rgba(${field.hue}, ${.1 + settled * .19})`)
        glow.addColorStop(.42, `rgba(${field.hue}, ${.045 + settled * .075})`)
        glow.addColorStop(1, `rgba(${field.hue}, 0)`)
        context.fillStyle = glow
        context.beginPath()
        context.ellipse(x, y, width * field.rx, height * field.ry, Math.sin(t + index) * .24, 0, Math.PI * 2)
        context.fill()
      })
      context.restore()

      if (elapsed >= 1.08 && elapsed < 1.52) {
        const tension = Math.max(0, Math.min(1, (elapsed - 1.08) / (impactAt - 1.08)))
        const surfaceRx = width * (.08 - tension * .035)
        context.save()
        context.beginPath()
        context.ellipse(impactX, impactY, surfaceRx, Math.max(2.2, height * .008), -.025, Math.PI, Math.PI * 2)
        context.strokeStyle = `rgba(224,248,255,${.06 + tension * .08})`
        context.lineWidth = 1
        context.stroke()
        context.beginPath()
        context.ellipse(impactX, impactY + 2, surfaceRx * .96, Math.max(1.7, height * .006), -.025, Math.PI, Math.PI * 2)
        context.strokeStyle = `rgba(10,48,75,${.07 + tension * .08})`
        context.lineWidth = .8
        context.stroke()
        context.restore()
      }

      if (elapsed >= .58 && elapsed < impactAt) {
        const fall = Math.max(0, Math.min(1, (elapsed - .58) / (impactAt - .58)))
        const easedFall = fall * fall * fall
        const compression = Math.max(0, Math.min(1, (fall - .88) / .12))
        const compressed = compression * compression * (3 - 2 * compression)
        const dropX = impactX
        const dropY = height * (.07 + easedFall * .305)
        const dropRadius = Math.max(5, Math.min(10, width * .0075))
        const dropWidth = dropRadius * (.72 + compressed * .36)
        const dropHeight = dropRadius * (1.13 - compressed * .55)
        context.save()
        context.globalCompositeOperation = 'screen'
        const trail = context.createLinearGradient(dropX, dropY - height * .05, dropX, dropY + dropRadius)
        trail.addColorStop(0, 'rgba(220,244,255,0)')
        trail.addColorStop(1, `rgba(220,244,255,${.05 + fall * .14})`)
        context.strokeStyle = trail
        context.lineWidth = Math.max(4, dropRadius * .72)
        context.lineCap = 'round'
        context.beginPath()
        context.moveTo(dropX, dropY - height * .045)
        context.lineTo(dropX, dropY - dropRadius)
        context.stroke()
        const drop = context.createRadialGradient(dropX - dropWidth * .3, dropY - dropHeight * .34, .5, dropX, dropY, dropRadius * 1.6)
        drop.addColorStop(0, 'rgba(255,255,255,.98)')
        drop.addColorStop(.26, 'rgba(214,245,255,.86)')
        drop.addColorStop(.62, 'rgba(126,207,239,.28)')
        drop.addColorStop(1, 'rgba(70,155,213,.04)')
        context.fillStyle = drop
        context.beginPath()
        context.moveTo(dropX, dropY - dropHeight)
        context.bezierCurveTo(dropX + dropWidth * .42, dropY - dropHeight * .72, dropX + dropWidth, dropY - dropHeight * .16, dropX + dropWidth, dropY + dropHeight * .18)
        context.bezierCurveTo(dropX + dropWidth * .86, dropY + dropHeight * .78, dropX + dropWidth * .38, dropY + dropHeight, dropX, dropY + dropHeight)
        context.bezierCurveTo(dropX - dropWidth * .38, dropY + dropHeight, dropX - dropWidth * .86, dropY + dropHeight * .78, dropX - dropWidth, dropY + dropHeight * .18)
        context.bezierCurveTo(dropX - dropWidth, dropY - dropHeight * .16, dropX - dropWidth * .42, dropY - dropHeight * .72, dropX, dropY - dropHeight)
        context.fill()
        context.strokeStyle = `rgba(255,255,255,${.22 + fall * .2})`
        context.lineWidth = .75
        context.beginPath()
        context.arc(dropX - dropWidth * .08, dropY - dropHeight * .03, dropRadius * .72, Math.PI * .92, Math.PI * 1.43)
        context.stroke()
        context.fillStyle = 'rgba(104,222,240,.2)'
        context.beginPath()
        context.ellipse(dropX + dropWidth * .34, dropY + dropHeight * .28, dropWidth * .26, dropHeight * .5, .38, 0, Math.PI * 2)
        context.fill()
        context.restore()
      }

      if (elapsed >= impactAt) {
        const impactAge = elapsed - impactAt
        context.save()
        context.translate(impactX, impactY)
        context.globalCompositeOperation = 'screen'
        if (impactAge < .38) {
          const flashProgress = impactAge / .38
          const flashRadius = Math.min(width * .14, 180) * (1 - Math.pow(1 - flashProgress, 3))
          const flash = context.createRadialGradient(0, 0, 0, 0, 0, Math.max(4, flashRadius))
          flash.addColorStop(0, `rgba(255,255,255,${.78 * (1 - flashProgress)})`)
          flash.addColorStop(.28, `rgba(132,236,245,${.34 * (1 - flashProgress)})`)
          flash.addColorStop(1, 'rgba(132,222,255,0)')
          context.fillStyle = flash
          context.beginPath()
          context.arc(0, 0, Math.max(4, flashRadius), 0, Math.PI * 2)
          context.fill()
        }

        if (impactAge < .06) {
          const compression = impactAge / .06
          context.fillStyle = `rgba(214,249,255,${.62 * (1 - compression)})`
          context.beginPath()
          context.ellipse(0, 0, Math.max(8, width * .012) * (1 + compression * .35), Math.max(1.6, height * .003), 0, 0, Math.PI * 2)
          context.fill()
        }

        if (impactAge >= .045 && impactAge < .25) {
          const splashProgress = Math.min(1, (impactAge - .045) / .205)
          const jets = width < 520 ? splashJets.filter((_, index) => index % 2 === 0) : splashJets
          jets.forEach((jet, index) => {
            const x = jet.x * splashProgress
            const y = -jet.h * 4 * splashProgress * (1 - splashProgress) + splashProgress * 5
            context.fillStyle = `rgba(222,249,255,${(1 - splashProgress) * (.5 + (index % 2) * .08)})`
            context.beginPath()
            context.ellipse(x, y, jet.r * (1 - splashProgress * .28), jet.r * (1.25 - splashProgress * .3), x < 0 ? -.32 : .32, 0, Math.PI * 2)
            context.fill()
          })
        }

        if (impactAge >= .08 && impactAge < .38) {
          const hollowProgress = (impactAge - .08) / .3
          const hollow = Math.sin(Math.PI * hollowProgress)
          context.globalCompositeOperation = 'source-over'
          context.fillStyle = `rgba(4,27,45,${hollow * .24})`
          context.beginPath()
          context.ellipse(0, 2, width * (.018 + hollowProgress * .024), height * (.005 + hollowProgress * .006), -.04, 0, Math.PI * 2)
          context.fill()
          context.strokeStyle = `rgba(206,245,255,${hollow * .2})`
          context.lineWidth = .75
          context.stroke()
          context.globalCompositeOperation = 'screen'
        }

        const activeRipples = width < 520 ? ripples.slice(0, 3) : ripples
        activeRipples.forEach((ring, ringIndex) => {
          const age = impactAge - .12 - ring.delay
          const progress = Math.max(0, Math.min(1, age / 1.3))
          if (age < 0 || progress >= 1) return
          const wave = 1 - Math.exp(-4.2 * progress)
          const decay = Math.exp(-2.7 * progress)
          const cx = width * ring.x
          const cy = height * ring.y
          const rx = width * (.038 + wave * ring.rx)
          const ry = height * (.014 + wave * ring.ry)
          context.beginPath()
          context.ellipse(cx, cy, rx, ry, ring.rotation, 0, Math.PI * 2)
          context.strokeStyle = `rgba(228,248,255,${decay * (.34 - ringIndex * .035)})`
          context.lineWidth = 1.15 - progress * .35
          context.stroke()
          context.beginPath()
          context.ellipse(cx, cy + 2, rx * .995, ry * .985, ring.rotation, 0, Math.PI * 2)
          context.strokeStyle = `rgba(10,61,87,${decay * .2})`
          context.lineWidth = .75
          context.stroke()
        })
        context.restore()
      }

      if (settled > .04) {
        context.save()
        const impactAge = Math.max(0, elapsed - impactAt)
        const visibleParticles = width < 520 ? particles.filter((_, index) => index % 2 === 0) : particles
        visibleParticles.forEach((particle) => {
          const depthFactor = [.28, .58, 1][particle.layer]
          const drift = t * (1.4 + particle.layer * .62) + particle.phase
          const baseX = particle.x * (width + 80) - 40
          const baseY = particle.y * (height + 80) - 40
          const dx = baseX - impactX
          const dy = baseY - impactY
          const distance = Math.max(1, Math.hypot(dx, dy))
          const push = Math.exp(-3.4 * impactAge) * depthFactor * 26
          const x = baseX + Math.sin(drift) * (3 + particle.layer * 3) + (dx / distance) * push + (pointerX - .5) * depthFactor * 9
          const y = baseY + Math.cos(drift * .67) * (2 + particle.layer * 2) + (dy / distance) * push + (pointerY - .5) * depthFactor * 6
          const alpha = settled * ([.042, .075, .12][particle.layer])
          context.filter = particle.layer === 0 ? 'blur(1.5px)' : particle.layer === 1 ? 'blur(.5px)' : 'none'
          context.fillStyle = `rgba(255,255,255,${alpha})`
          context.beginPath()
          context.arc(x, y, particle.radius, 0, Math.PI * 2)
          context.fill()
        })
        context.filter = 'none'
        context.restore()
      }

      if (!reduceMotion && visible && !document.hidden) raf = window.requestAnimationFrame(draw)
    }

    resize()
    draw()
    const resizeObserver = new ResizeObserver(() => { resize(); if (reduceMotion) draw() })
    resizeObserver.observe(canvas)
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      window.cancelAnimationFrame(raf)
      if (visible && !reduceMotion && !document.hidden) raf = window.requestAnimationFrame(draw)
    }, { threshold: .01 })
    visibilityObserver.observe(canvas)
    canvas.parentElement?.addEventListener('pointermove', onPointerMove, { passive: true })
    const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
      reduceMotion = event.matches
      if (!event.matches) {
        startTime = performance.now()
        impactAnnounced = false
      }
      window.cancelAnimationFrame(raf)
      draw()
    }
    motionPreference.addEventListener('change', onMotionPreferenceChange)
    const onDocumentVisibilityChange = () => {
      window.cancelAnimationFrame(raf)
      if (document.hidden) {
        if (!impactAnnounced) hiddenAt = performance.now()
        return
      }
      if (hiddenAt !== null && !impactAnnounced) startTime += performance.now() - hiddenAt
      hiddenAt = null
      if (visible) draw()
    }
    document.addEventListener('visibilitychange', onDocumentVisibilityChange)

    return () => {
      resizeObserver.disconnect()
      visibilityObserver.disconnect()
      canvas.parentElement?.removeEventListener('pointermove', onPointerMove)
      motionPreference.removeEventListener('change', onMotionPreferenceChange)
      document.removeEventListener('visibilitychange', onDocumentVisibilityChange)
      window.cancelAnimationFrame(raf)
    }
  }, [])

  return <canvas ref={canvasRef} className="imagination-canvas" aria-hidden="true" />
}

type EquityResultCanvasProps = {
  mode: BacktestResultMode
  interactive?: boolean
  presentation?: 'compact' | 'cinematic'
  professional?: boolean
  timeframe?: ChartTimeframe
  market?: string
  replayDuration?: number
  onReplayFrame?: (frame: ReplayMarketFrame) => void
  onRevealComplete?: () => void
}

export type ReplayMarketFrame = {
  index: number
  total: number
  candle: MockMarketCandle
  changePercent: number
}

const executionEvents = [
  { index: 4, code: 'ENTRY FILLED', label: '진입 조건 충족', detail: '시장가 체결 · 수수료 반영' },
  { index: 8, code: 'RISK CHECK', label: '손실 한도 확인', detail: '포지션 유지 · 노출 제한' },
  { index: 12, code: 'EXIT FILLED', label: '청산 조건 충족', detail: '손익 확정 · 비용 반영' },
] as const

export function EquityResultCanvas({
  mode,
  interactive = true,
  presentation = 'compact',
  professional = false,
  timeframe = '4h',
  market = 'BTC/USDT',
  replayDuration = presentation === 'cinematic' ? 5200 : 2600,
  onReplayFrame,
  onRevealComplete,
}: EquityResultCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const redrawRef = useRef<(() => void) | null>(null)
  const hoverIndexRef = useRef<number | null>(null)
  const revealProgressRef = useRef(1)
  const revealElapsedRef = useRef(Number.POSITIVE_INFINITY)
  const onRevealCompleteRef = useRef(onRevealComplete)
  const onReplayFrameRef = useRef(onReplayFrame)
  const replayFrameIndexRef = useRef(-1)
  const replayStartedAtRef = useRef<number | null>(null)
  const executionIndexRef = useRef(-1)
  const completionNotifiedRef = useRef(false)
  const [width, setWidth] = useState(0)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [executionIndex, setExecutionIndex] = useState(-1)
  const [revealState, setRevealState] = useState<'playing' | 'complete'>('playing')
  const series = useMemo(() => getResultSeries(mode, timeframe), [mode, timeframe])
  const marketBars = useMemo(() => getMockMarketCandles(market, timeframe), [market, timeframe])
  const marketSymbol = market.split('/')[0]?.toUpperCase() || 'BTC'
  const isStress = mode === 'stress'
  const chartRightPad = professional ? (width < 640 ? 78 : 72) : CHART_PAD.right
  const tooltipLeft = hoverIndex === null || !width
    ? 0
    : Math.min(width - 56, Math.max(56, CHART_PAD.left + (hoverIndex / (series.length - 1)) * (width - CHART_PAD.left - chartRightPad)))

  useEffect(() => {
    onRevealCompleteRef.current = onRevealComplete
  }, [onRevealComplete])

  useEffect(() => {
    onReplayFrameRef.current = onReplayFrame
  }, [onReplayFrame])

  useEffect(() => {
    completionNotifiedRef.current = false
    executionIndexRef.current = -1
    replayFrameIndexRef.current = -1
    replayStartedAtRef.current = null
  }, [market, mode, presentation, replayDuration, timeframe])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !width) return
    const context = canvas.getContext('2d')
    if (!context) return
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let animationFrame = 0

    const height = canvas.getBoundingClientRect().height
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, width, height)

    const pad = professional ? { ...CHART_PAD, right: width < 640 ? 78 : 72 } : CHART_PAD
    const plotW = width - pad.left - pad.right
    const volumeHeight = presentation === 'cinematic' ? Math.max(72, height * .2) : Math.max(48, height * .18)
    const volumeGap = presentation === 'cinematic' ? 18 : 12
    const volumeBottom = height - pad.bottom
    const volumeTop = volumeBottom - volumeHeight
    const plotH = volumeTop - volumeGap - pad.top
    const all = [...series, ...BENCHMARK_SERIES]
    const min = Math.min(-12, ...all)
    const max = Math.max(32, ...all)
    const x = (index: number) => pad.left + (index / (series.length - 1)) * plotW
    const y = (value: number) => pad.top + ((max - value) / (max - min)) * plotH
    const strategyColor = isStress ? 'rgb(251, 113, 133)' : 'rgb(91, 231, 174)'
    const strategyGlow = isStress ? 'rgba(244, 63, 94, .42)' : 'rgba(52, 211, 153, .42)'
    const badgeLifetime = 1480
    const replayTail = presentation === 'cinematic' ? 180 : 640

    const pointAt = (values: number[], indexProgress: number) => {
      const bounded = Math.max(0, Math.min(values.length - 1, indexProgress))
      const left = Math.floor(bounded)
      const right = Math.min(values.length - 1, left + 1)
      const fraction = bounded - left
      return {
        x: x(bounded),
        y: y(values[left] + (values[right] - values[left]) * fraction),
      }
    }

    const tracePartialLine = (values: number[], indexProgress: number) => {
      const bounded = Math.max(0, Math.min(values.length - 1, indexProgress))
      const fullIndex = Math.floor(bounded)
      context.beginPath()
      context.moveTo(x(0), y(values[0]))
      for (let index = 1; index <= fullIndex; index += 1) context.lineTo(x(index), y(values[index]))
      if (fullIndex < values.length - 1) {
        const head = pointAt(values, bounded)
        context.lineTo(head.x, head.y)
      }
      return pointAt(values, bounded)
    }

    const marketMin = Math.min(...marketBars.map((bar) => bar.low))
    const marketMax = Math.max(...marketBars.map((bar) => bar.high))
    const marketVolumeMax = Math.max(...marketBars.map((bar) => bar.volume))
    const priceY = (value: number) => pad.top + ((marketMax - value) / (marketMax - marketMin)) * plotH

    const drawMarketLayer = (progress: number) => {
      const visibleBars = Math.max(1, Math.ceil(progress * marketBars.length))
      const barStep = plotW / marketBars.length
      const bodyWidth = Math.max(1.2, Math.min(professional ? 5.2 : 3.2, barStep * .62))

      context.save()
      context.beginPath()
      context.rect(pad.left, pad.top, plotW, volumeBottom - pad.top)
      context.clip()

      for (let index = 0; index < visibleBars; index += 1) {
        const bar = marketBars[index]
        const px = pad.left + index * barStep + barStep / 2
        const up = bar.close >= bar.open
        const rgb = up ? '74, 222, 165' : '244, 99, 118'
        const volumeBarHeight = 5 + (bar.volume / marketVolumeMax) * (volumeHeight - 7)

        context.strokeStyle = `rgba(${rgb},${professional ? .42 : .28})`
        context.lineWidth = Math.max(.75, bodyWidth * .22)
        context.beginPath()
        context.moveTo(px, volumeBottom - volumeBarHeight - 4)
        context.lineTo(px, volumeBottom - 2)
        context.stroke()
        context.fillStyle = `rgba(${rgb},${professional ? .36 : .24})`
        context.fillRect(px - bodyWidth / 2, volumeBottom - volumeBarHeight, bodyWidth, volumeBarHeight)

        if (professional) {
          const openY = priceY(bar.open)
          const closeY = priceY(bar.close)
          const highY = priceY(bar.high)
          const lowY = priceY(bar.low)
          context.strokeStyle = `rgba(${rgb},.44)`
          context.lineWidth = 1
          context.beginPath()
          context.moveTo(px, highY)
          context.lineTo(px, lowY)
          context.stroke()
          context.fillStyle = `rgba(${rgb},.34)`
          context.fillRect(px - bodyWidth / 2, Math.min(openY, closeY), bodyWidth, Math.max(1.25, Math.abs(closeY - openY)))
        }
      }

      context.strokeStyle = 'rgba(200, 211, 219, .11)'
      context.lineWidth = 1
      context.beginPath()
      context.moveTo(pad.left, volumeTop - volumeGap / 2)
      context.lineTo(width - pad.right, volumeTop - volumeGap / 2)
      context.stroke()
      context.restore()
    }

    const drawExecutionPulse = (index: number, elapsedMs: number) => {
      const eventAt = (index / (series.length - 1)) * replayDuration
      const age = elapsedMs - eventAt
      if (age < 0 || age > 680) return
      const px = x(index)
      const py = y(series[index])
      const primary = series[index] < 0 ? '251,113,133' : '110,231,183'

      context.save()
      context.globalCompositeOperation = 'screen'

      if (age <= 240) {
        const progress = age / 240
        const eased = 1 - Math.pow(1 - progress, 3)
        const alpha = .98 * Math.pow(1 - progress, 1.35)
        const bloomRadius = 12 + eased * 30
        const bloom = context.createRadialGradient(px, py, 0, px, py, bloomRadius)
        bloom.addColorStop(0, `rgba(255,255,255,${alpha})`)
        bloom.addColorStop(.2, `rgba(${primary},${alpha * .92})`)
        bloom.addColorStop(.54, `rgba(${primary},${alpha * .3})`)
        bloom.addColorStop(1, `rgba(${primary},0)`)
        context.fillStyle = bloom
        context.beginPath()
        context.arc(px, py, bloomRadius, 0, Math.PI * 2)
        context.fill()
      }

      if (age <= 420) {
        const progress = age / 420
        const eased = 1 - Math.pow(1 - progress, 3)
        const alpha = Math.pow(1 - progress, 2.15) * .92
        context.strokeStyle = `rgba(${primary},${alpha})`
        context.lineWidth = 2.4 - eased * 1.85
        context.beginPath()
        context.arc(px, py, 5 + eased * 33, 0, Math.PI * 2)
        context.stroke()
      }

      if (age >= 45) {
        const progress = Math.min(1, (age - 45) / 635)
        const eased = 1 - Math.pow(1 - progress, 2.2)
        const alpha = Math.pow(1 - progress, 1.8) * .48
        context.strokeStyle = `rgba(${primary},${alpha})`
        context.lineWidth = 1.35 - eased * .95
        context.beginPath()
        context.arc(px, py, 4 + eased * 54, 0, Math.PI * 2)
        context.stroke()
      }

      if (age <= 280) {
        const progress = age / 280
        const eased = 1 - Math.pow(1 - progress, 3)
        const alpha = Math.pow(1 - progress, 1.6) * .8
        const inner = 8 + eased * 6
        const outer = 16 + eased * 12
        context.strokeStyle = `rgba(${primary},${alpha})`
        context.lineWidth = 1.15
        context.beginPath()
        for (let ray = 0; ray < 4; ray += 1) {
          const angle = ray * Math.PI / 2
          context.moveTo(px + Math.cos(angle) * inner, py + Math.sin(angle) * inner)
          context.lineTo(px + Math.cos(angle) * outer, py + Math.sin(angle) * outer)
        }
        context.stroke()
      }

      if (age <= 360) {
        const progress = age / 360
        const eased = 1 - Math.pow(1 - progress, 3)
        const alpha = Math.pow(1 - progress, 1.45) * .78
        const orbit = 8 + eased * 38
        context.fillStyle = `rgba(${primary},${alpha})`
        context.shadowColor = `rgba(${primary},${alpha})`
        context.shadowBlur = 10
        for (let spark = 0; spark < 8; spark += 1) {
          const angle = spark * Math.PI / 4 + .18
          const stagger = 1 - (spark % 2) * .16
          context.beginPath()
          context.arc(
            px + Math.cos(angle) * orbit * stagger,
            py + Math.sin(angle) * orbit * stagger,
            Math.max(.55, 2.15 - eased * 1.45),
            0,
            Math.PI * 2,
          )
          context.fill()
        }
        context.shadowBlur = 0
      }

      context.fillStyle = `rgba(255,255,255,${Math.max(.18, 1 - age / 520)})`
      context.beginPath()
      context.arc(px, py, age < 130 ? 3.8 : 2.7, 0, Math.PI * 2)
      context.fill()
      context.restore()
    }

    const drawCheckpointBadge = (index: number, elapsedMs: number, persistent = false) => {
      const eventAt = (index / (series.length - 1)) * replayDuration
      const age = elapsedMs - eventAt
      if (!persistent && (age < 42 || age > badgeLifetime)) return
      const enterProgress = persistent ? 1 : Math.min(1, (age - 42) / 300)
      const enterEase = 1 - Math.pow(1 - Math.max(0, enterProgress), 4)
      const exitProgress = persistent ? 0 : Math.max(0, Math.min(1, (age - (badgeLifetime - 280)) / 280))
      const alpha = persistent ? 1 : enterEase * (1 - Math.pow(exitProgress, 2))
      const value = series[index]
      const valueText = formatSignedPercent(value)
      const primary = value < 0 ? '251,113,133' : '110,231,183'
      const textColor = value < 0 ? 'rgb(255,222,226)' : 'rgb(213,246,232)'
      const px = x(index)
      const py = y(value)

      context.save()
      context.font = '760 13px "Geist Variable", "SF Pro Text", sans-serif'
      const valueWidth = context.measureText(valueText).width
      const badgeWidth = Math.ceil(valueWidth + 27)
      const badgeHeight = 29
      const floatOffset = 20 + enterEase * 18
      const badgeCenterX = index === series.length - 1
        ? px - badgeWidth / 2 - 13
        : Math.max(pad.left + badgeWidth / 2, Math.min(width - pad.right - badgeWidth / 2, px))
      const badgeCenterY = Math.max(badgeHeight / 2 + 4, py - floatOffset)
      const scale = persistent ? 1 : .74 + enterEase * .26 + Math.sin(Math.min(1, enterProgress) * Math.PI) * .07

      context.translate(badgeCenterX, badgeCenterY)
      context.scale(scale, scale)
      context.globalAlpha = alpha
      context.shadowColor = `rgba(${primary},.18)`
      context.shadowBlur = 12

      const glass = context.createLinearGradient(0, -badgeHeight / 2, 0, badgeHeight / 2)
      glass.addColorStop(0, 'rgba(48,59,64,.82)')
      glass.addColorStop(.42, 'rgba(25,36,42,.84)')
      glass.addColorStop(1, 'rgba(12,22,28,.9)')
      context.fillStyle = glass
      context.strokeStyle = 'rgba(241,248,247,.24)'
      context.lineWidth = .85
      context.beginPath()
      context.roundRect(-badgeWidth / 2, -badgeHeight / 2, badgeWidth, badgeHeight, badgeHeight / 2)
      context.fill()
      context.stroke()

      context.shadowBlur = 0
      const reflection = context.createLinearGradient(-badgeWidth / 2, 0, badgeWidth / 2, 0)
      reflection.addColorStop(0, 'rgba(255,255,255,0)')
      reflection.addColorStop(.22, 'rgba(255,255,255,.22)')
      reflection.addColorStop(.66, 'rgba(255,255,255,.08)')
      reflection.addColorStop(1, 'rgba(255,255,255,0)')
      context.strokeStyle = reflection
      context.lineWidth = .75
      context.beginPath()
      context.moveTo(-badgeWidth / 2 + 8, -badgeHeight / 2 + 3)
      context.quadraticCurveTo(0, -badgeHeight / 2 + .8, badgeWidth / 2 - 8, -badgeHeight / 2 + 3)
      context.stroke()

      const refraction = context.createLinearGradient(-badgeWidth / 2, 0, badgeWidth / 2, 0)
      refraction.addColorStop(0, `rgba(${primary},0)`)
      refraction.addColorStop(.28, `rgba(${primary},.08)`)
      refraction.addColorStop(.72, `rgba(${primary},.24)`)
      refraction.addColorStop(1, `rgba(${primary},0)`)
      context.strokeStyle = refraction
      context.lineWidth = .8
      context.beginPath()
      context.moveTo(-badgeWidth / 2 + 10, badgeHeight / 2 - 2.7)
      context.quadraticCurveTo(0, badgeHeight / 2 - .9, badgeWidth / 2 - 10, badgeHeight / 2 - 2.7)
      context.stroke()

      context.fillStyle = textColor
      context.font = '760 13px "Geist Variable", "SF Pro Text", sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(valueText, 0, .2)
      context.restore()
    }

    const draw = (progress: number, now: number, elapsedMs: number) => {
      context.clearRect(0, 0, width, height)
      const visibleIndex = progress * (series.length - 1)
      const benchmarkIndex = progress * (BENCHMARK_SERIES.length - 1)
      const head = pointAt(series, visibleIndex)

      context.save()
      context.globalAlpha = .46 + progress * .54
      context.font = '600 11px "Geist Variable", "SF Pro Text", sans-serif'
      context.textBaseline = 'middle'
      ;[30, 20, 10, 0, -10].forEach((tick) => {
        const py = y(tick)
        context.strokeStyle = tick === 0 ? 'rgba(225,236,239,.2)' : 'rgba(225,236,239,.075)'
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(pad.left, py)
        context.lineTo(width - pad.right, py)
        context.stroke()
        context.fillStyle = 'rgba(202, 213, 218, .58)'
        context.textAlign = 'right'
        context.fillText(`${tick > 0 ? '+' : ''}${tick}%`, pad.left - 9, py)
      })
      ;[0, 4, 8, 12].forEach((index) => {
        if (professional && index > 0 && index < 12) {
          context.strokeStyle = 'rgba(225,236,239,.06)'
          context.lineWidth = 1
          context.beginPath()
          context.moveTo(x(index), pad.top)
          context.lineTo(x(index), volumeBottom)
          context.stroke()
        }
        context.fillStyle = 'rgba(202, 213, 218, .52)'
        context.textAlign = index === 0 ? 'left' : index === 12 ? 'right' : 'center'
        context.fillText(chartLabels[index], x(index), height - 11)
      })
      if (professional) {
        ;[marketMax, (marketMin + marketMax) / 2, marketMin].forEach((price) => {
          context.fillStyle = 'rgba(202, 213, 218, .48)'
          context.textAlign = 'right'
          context.fillText(Math.round(price).toLocaleString('en-US'), width - 12, priceY(price))
        })
        context.fillStyle = 'rgba(202, 213, 218, .42)'
        context.textAlign = 'right'
        context.fillText('VOL', width - 12, volumeTop + 8)
      }
      context.restore()

      drawMarketLayer(progress)

      const fill = context.createLinearGradient(0, pad.top, 0, height - pad.bottom)
      fill.addColorStop(0, isStress ? `rgba(244, 63, 94, ${professional ? '.11' : '.24'})` : `rgba(52, 211, 153, ${professional ? '.1' : '.22'})`)
      fill.addColorStop(.62, isStress ? `rgba(244, 63, 94, ${professional ? '.025' : '.065'})` : `rgba(52, 211, 153, ${professional ? '.02' : '.055'})`)
      fill.addColorStop(1, 'rgba(5, 12, 18, 0)')
      tracePartialLine(series, visibleIndex)
      context.lineTo(head.x, y(min))
      context.lineTo(x(0), y(min))
      context.closePath()
      context.fillStyle = fill
      context.fill()

      context.save()
      tracePartialLine(BENCHMARK_SERIES, benchmarkIndex)
      context.strokeStyle = 'rgba(198, 207, 214, .48)'
      context.lineWidth = 1.25
      context.lineJoin = 'round'
      context.lineCap = 'round'
      context.setLineDash([4, 5])
      context.stroke()
      context.restore()

      if (progress < 1) {
        const scan = context.createLinearGradient(0, pad.top, 0, height - pad.bottom)
        scan.addColorStop(0, 'rgba(255,255,255,0)')
        scan.addColorStop(.46, isStress ? 'rgba(251,113,133,.2)' : 'rgba(110,231,183,.2)')
        scan.addColorStop(1, 'rgba(255,255,255,0)')
        context.strokeStyle = scan
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(head.x, pad.top)
        context.lineTo(head.x, height - pad.bottom)
        context.stroke()
      }

      context.save()
      tracePartialLine(series, visibleIndex)
      context.strokeStyle = strategyColor
      context.lineWidth = 2.35
      context.lineJoin = 'round'
      context.lineCap = 'round'
      context.shadowColor = strategyGlow
      context.shadowBlur = progress < 1 ? 12 : 5
      context.stroke()
      context.restore()

      ;[4, 8].forEach((index) => {
        if (visibleIndex < index) return
        const localProgress = Math.min(1, visibleIndex - index)
        const px = x(index)
        const py = y(series[index])
        context.fillStyle = 'rgb(9, 18, 24)'
        context.beginPath()
        context.arc(px, py, 3.5, 0, Math.PI * 2)
        context.fill()
        context.strokeStyle = strategyColor
        context.lineWidth = 1.6
        context.stroke()
        if (localProgress < 1) {
          context.strokeStyle = isStress ? `rgba(251,113,133,${.52 * (1 - localProgress)})` : `rgba(110,231,183,${.52 * (1 - localProgress)})`
          context.lineWidth = 1.2
          context.beginPath()
          context.arc(px, py, 5 + localProgress * 12, 0, Math.PI * 2)
          context.stroke()
        }
      })

      ;[4, 8, 12].forEach((index) => drawExecutionPulse(index, elapsedMs))

      const pulse = progress < 1 ? 1 + Math.sin(now * .018) * .12 : 1
      const halo = context.createRadialGradient(head.x, head.y, 0, head.x, head.y, 24 * pulse)
      halo.addColorStop(0, isStress ? 'rgba(251,113,133,.3)' : 'rgba(110,231,183,.3)')
      halo.addColorStop(1, isStress ? 'rgba(251,113,133,0)' : 'rgba(110,231,183,0)')
      context.fillStyle = halo
      context.beginPath()
      context.arc(head.x, head.y, 24 * pulse, 0, Math.PI * 2)
      context.fill()
      context.fillStyle = 'rgb(237, 246, 243)'
      context.beginPath()
      context.arc(head.x, head.y, 3.2, 0, Math.PI * 2)
      context.fill()
      context.strokeStyle = strategyColor
      context.lineWidth = 2
      context.stroke()

      ;[4, 8, 12].forEach((index) => drawCheckpointBadge(index, elapsedMs))
      if (progress >= 1 && !Number.isFinite(elapsedMs)) drawCheckpointBadge(series.length - 1, elapsedMs, true)

      const activeHoverIndex = hoverIndexRef.current
      if (activeHoverIndex !== null) {
        const px = x(activeHoverIndex)
        const py = y(series[activeHoverIndex])
        context.strokeStyle = 'rgba(220,232,235,.32)'
        context.setLineDash([3, 4])
        context.beginPath()
        context.moveTo(px, pad.top)
        context.lineTo(px, height - pad.bottom)
        context.stroke()
        context.setLineDash([])
        context.fillStyle = strategyColor
        context.beginPath()
        context.arc(px, py, 4, 0, Math.PI * 2)
        context.fill()
        context.strokeStyle = 'rgba(249,252,250,.96)'
        context.lineWidth = 2
        context.stroke()
      }
    }

    redrawRef.current = () => draw(revealProgressRef.current, performance.now(), revealElapsedRef.current)
    const emitReplayFrame = (progress: number, force = false) => {
      if (!onReplayFrameRef.current || !marketBars.length) return
      const index = Math.min(marketBars.length - 1, Math.max(0, Math.floor(progress * marketBars.length)))
      if (!force && replayFrameIndexRef.current === index) return
      replayFrameIndexRef.current = index
      const candle = marketBars[index]
      onReplayFrameRef.current({
        index,
        total: marketBars.length,
        candle,
        changePercent: candle.open === 0 ? 0 : ((candle.close - candle.open) / candle.open) * 100,
      })
    }
    const finishImmediately = motionPreference.matches || (!interactive && presentation !== 'cinematic')
    if (finishImmediately) {
      revealProgressRef.current = 1
      revealElapsedRef.current = Number.POSITIVE_INFINITY
      emitReplayFrame(1, true)
      draw(1, performance.now(), revealElapsedRef.current)
      animationFrame = window.requestAnimationFrame(() => {
        setRevealState('complete')
        if (!completionNotifiedRef.current) {
          completionNotifiedRef.current = true
          onRevealCompleteRef.current?.()
        }
      })
    } else {
      revealProgressRef.current = 0
      revealElapsedRef.current = 0
      const isNewReplay = replayStartedAtRef.current === null
      const startedAt = replayStartedAtRef.current ?? performance.now()
      replayStartedAtRef.current = startedAt
      const animate = (now: number) => {
        const elapsed = now - startedAt
        const linear = Math.min(1, elapsed / replayDuration)
        revealProgressRef.current = linear
        revealElapsedRef.current = elapsed
        emitReplayFrame(linear)
        if (presentation === 'cinematic') {
          const visibleSeriesIndex = linear * (series.length - 1)
          const nextExecutionIndex = executionEvents.reduce((active, event, index) => visibleSeriesIndex >= event.index ? index : active, -1)
          if (nextExecutionIndex !== executionIndexRef.current) {
            executionIndexRef.current = nextExecutionIndex
            setExecutionIndex(nextExecutionIndex)
          }
        }
        draw(linear, now, elapsed)
        if (elapsed < replayDuration + replayTail) {
          animationFrame = window.requestAnimationFrame(animate)
        } else {
          revealElapsedRef.current = Number.POSITIVE_INFINITY
          emitReplayFrame(1, true)
          draw(1, now, revealElapsedRef.current)
          setRevealState('complete')
          if (!completionNotifiedRef.current) {
            completionNotifiedRef.current = true
            onRevealCompleteRef.current?.()
          }
        }
      }
      animationFrame = window.requestAnimationFrame((now) => {
        if (isNewReplay) setExecutionIndex(-1)
        setRevealState('playing')
        animate(now)
      })
    }

    return () => {
      window.cancelAnimationFrame(animationFrame)
      redrawRef.current = null
    }
  }, [interactive, isStress, marketBars, presentation, professional, replayDuration, series, width])

  const updateHoverIndex = (index: number | null) => {
    hoverIndexRef.current = index
    setHoverIndex(index)
    redrawRef.current?.()
  }

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const plotStart = CHART_PAD.left
    const plotWidth = rect.width - CHART_PAD.left - (professional ? (rect.width < 640 ? 78 : 72) : CHART_PAD.right)
    const normalized = Math.max(0, Math.min(1, (event.clientX - rect.left - plotStart) / plotWidth))
    updateHoverIndex(Math.round(normalized * (series.length - 1)))
  }

  return (
    <div
      className={`equity-canvas-shell ${presentation} ${professional ? 'professional' : ''}`}
      data-reveal-state={revealState}
      data-vfx="volume-execution-pulses"
      data-checkpoint-values={[4, 8, 12].map((index) => formatSignedPercent(series[index])).join(',')}
      data-timeframe={timeframe}
      data-market={marketSymbol}
      data-market-bars={marketBars.length}
      data-series-end={series.at(-1)?.toFixed(2)}
      data-execution-index={executionIndex}
    >
      {professional && <><div className="chart-return-label" aria-hidden="true">TETH STRATEGY · RETURN %</div><div className="chart-scale-label" aria-hidden="true">{marketSymbol} · USDT</div></>}
      <canvas
        ref={canvasRef}
        className="equity-result-canvas"
        tabIndex={interactive ? 0 : -1}
        role={interactive ? 'img' : undefined}
        aria-hidden={interactive ? undefined : true}
        aria-label={interactive ? `${isStress ? '스트레스' : '검증'} 백테스트 누적 수익률과 ${marketSymbol} 보유 수익률 비교 차트. 좌우 방향키로 시점별 수치를 탐색할 수 있습니다.` : undefined}
        onKeyDown={(event) => {
          if (!interactive) return
          if (event.key === 'ArrowRight') {
            event.preventDefault()
            updateHoverIndex(hoverIndexRef.current === null ? 0 : Math.min(series.length - 1, hoverIndexRef.current + 1))
          } else if (event.key === 'ArrowLeft') {
            event.preventDefault()
            updateHoverIndex(hoverIndexRef.current === null ? series.length - 1 : Math.max(0, hoverIndexRef.current - 1))
          } else if (event.key === 'Home') {
            event.preventDefault()
            updateHoverIndex(0)
          } else if (event.key === 'End') {
            event.preventDefault()
            updateHoverIndex(series.length - 1)
          } else if (event.key === 'Escape') {
            updateHoverIndex(null)
          }
        }}
        onPointerMove={interactive ? onPointerMove : undefined}
        onPointerLeave={interactive ? () => updateHoverIndex(null) : undefined}
        onBlur={interactive ? () => updateHoverIndex(null) : undefined}
      />
      {hoverIndex !== null && (
        <div className="canvas-tooltip" role="status" aria-live="polite" style={{ left: `${tooltipLeft}px` }}>
          <span>{chartLabels[hoverIndex]}</span>
          <strong className={series[hoverIndex] >= 0 ? 'positive' : 'negative'}>{series[hoverIndex] > 0 ? '+' : ''}{series[hoverIndex].toFixed(1)}%</strong>
          <small>{marketSymbol} {BENCHMARK_SERIES[hoverIndex] > 0 ? '+' : ''}{BENCHMARK_SERIES[hoverIndex].toFixed(1)}%</small>
        </div>
      )}
      {presentation === 'cinematic' && executionIndex >= 0 && (
        <aside
          key={`${mode}-${executionIndex}`}
          className={`execution-toast ${series[executionEvents[executionIndex].index] < 0 ? 'negative' : 'positive'}`}
          data-component="executionToast"
          role="status"
          aria-live="polite"
          aria-label={`${executionEvents[executionIndex].label}, 손익 ${formatSignedPercent(series[executionEvents[executionIndex].index])}`}
        >
          <span className="execution-toast-signal" aria-hidden="true"><i /></span>
          <span className="execution-toast-copy">
            <small>{executionEvents[executionIndex].code}</small>
            <strong>{executionEvents[executionIndex].label}</strong>
            <em>{executionEvents[executionIndex].detail}</em>
          </span>
          <b aria-hidden="true" data-value={`P&L ${formatSignedPercent(series[executionEvents[executionIndex].index])}`} />
        </aside>
      )}
    </div>
  )
}
