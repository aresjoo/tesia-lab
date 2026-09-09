import { useEffect, useRef } from 'react'

export function ConversationCosmos() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reduceMotion = motionPreference.matches || document.documentElement.classList.contains('client-motion-paused')
    let animationFrame = 0
    let visible = true
    let pageVisible = !document.hidden
    let width = 1
    let height = 1
    let stars: Array<{ x: number; y: number; radius: number; phase: number; speed: number; driftX: number; driftY: number }> = []

    const createStars = () => {
      const count = width < 680 ? 38 : 84
      stars = Array.from({ length: count }, (_, index) => ({
        x: ((index * 47.71 + 11) % 100) / 100,
        y: ((index * 73.37 + 29) % 100) / 100,
        radius: .45 + (index % 5) * .18,
        phase: index * 1.618,
        speed: .42 + (index % 7) * .09,
        driftX: ((index % 3) - 1) * .0018,
        driftY: (((index + 1) % 3) - 1) * .0012,
      }))
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      createStars()
    }

    const draw = (time = 6000) => {
      const seconds = time / 1000
      context.clearRect(0, 0, width, height)

      for (const star of stars) {
        const x = (((star.x + star.driftX * seconds) % 1) + 1) % 1 * width
        const y = (((star.y + star.driftY * seconds) % 1) + 1) % 1 * height
        const alpha = reduceMotion ? .34 : .18 + Math.abs(Math.sin(star.phase + seconds * star.speed)) * .44
        context.fillStyle = `rgba(205, 220, 255, ${alpha})`
        context.beginPath()
        context.arc(x, y, star.radius, 0, Math.PI * 2)
        context.fill()
      }

      if (!reduceMotion && visible && pageVisible) animationFrame = window.requestAnimationFrame(draw)
    }

    resize()
    draw()

    const resizeObserver = new ResizeObserver(() => {
      resize()
      if (reduceMotion) draw()
    })
    resizeObserver.observe(canvas)
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      window.cancelAnimationFrame(animationFrame)
      if (visible && pageVisible) draw()
    }, { threshold: .01 })
    intersectionObserver.observe(canvas)
    const onMotionChange = () => {
      reduceMotion = motionPreference.matches || document.documentElement.classList.contains('client-motion-paused')
      window.cancelAnimationFrame(animationFrame)
      draw()
    }
    const motionObserver = new MutationObserver(onMotionChange)
    motionObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    const onVisibilityChange = () => {
      pageVisible = !document.hidden
      window.cancelAnimationFrame(animationFrame)
      if (pageVisible && visible) draw()
    }
    motionPreference.addEventListener('change', onMotionChange)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      motionObserver.disconnect()
      motionPreference.removeEventListener('change', onMotionChange)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.cancelAnimationFrame(animationFrame)
    }
  }, [])

  return <canvas ref={canvasRef} className="conversation-cosmos" aria-hidden="true" />
}
