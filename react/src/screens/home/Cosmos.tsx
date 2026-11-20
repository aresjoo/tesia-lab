// 홈 뒤의 별 배경 (원본 gCosmosStart). 별은 프레임마다 조금씩 흐르고 반짝인다.
import { useEffect, useRef } from 'react';

export function Cosmos() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const cx = cv?.getContext('2d');
    if (!cv || !cx) return;
    let W = 0;
    let H = 0;
    const fit = () => {
      const r = cv.getBoundingClientRect();
      const d = Math.min(devicePixelRatio || 1, 2);
      W = r.width || 1;
      H = r.height || 1;
      cv.width = Math.round(W * d);
      cv.height = Math.round(H * d);
      cx.setTransform(d, 0, 0, d, 0, 0);
    };
    fit();
    const mob = W < 680;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const sm = (v: number) => {
      v = v < 0 ? 0 : v > 1 ? 1 : v;
      return v * v * (3 - 2 * v);
    };
    const NS = mob ? 40 : 88;
    const stars = Array.from({ length: NS }, () => ({ x: Math.random(), y: Math.random(), r: rnd(0.5, 1.5), tw: rnd(0, 6.28), ts: rnd(0.5, 1.3), vx: rnd(-0.005, 0.005), vy: rnd(-0.003, 0.003) }));
    const advance = (dt: number) => {
      for (const s of stars) {
        s.x = (((s.x + s.vx * dt) % 1) + 1) % 1;
        s.y = (((s.y + s.vy * dt) % 1) + 1) % 1;
        if (!isFinite(s.x) || !isFinite(s.y)) {
          s.x = Math.random();
          s.y = Math.random();
        }
      }
    };
    const render = (tt: number) => {
      cx.clearRect(0, 0, W, H);
      const g = sm(tt / 0.8);
      for (const s of stars) {
        const sx = s.x * W;
        const sy = s.y * H;
        const ef = Math.min(1, sx / 30, (W - sx) / 30);
        if (ef <= 0) continue;
        const sa = (0.22 + 0.55 * Math.abs(Math.sin(s.tw + s.ts * tt))) * 0.62 * ef;
        cx.beginPath();
        cx.arc(sx, sy, s.r, 0, 6.283);
        cx.fillStyle = 'rgba(216,228,255,' + sa + ')';
        cx.fill();
      }
      cx.globalCompositeOperation = 'destination-out';
      if (g < 1) {
        cx.fillStyle = 'rgba(0,0,0,' + (1 - g) + ')';
        cx.fillRect(0, 0, W, H);
      }
      const vg = cx.createRadialGradient(W / 2, H * 0.5, 0, W / 2, H * 0.5, Math.min(W * 0.26, 240));
      vg.addColorStop(0, 'rgba(0,0,0,.5)');
      vg.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = vg;
      cx.fillRect(0, 0, W, H);
      const eg = cx.createLinearGradient(0, 0, 0, H);
      eg.addColorStop(0, 'rgba(0,0,0,.9)');
      eg.addColorStop(Math.min(0.2, 40 / H), 'rgba(0,0,0,0)');
      eg.addColorStop(Math.max(0.8, 1 - 40 / H), 'rgba(0,0,0,0)');
      eg.addColorStop(1, 'rgba(0,0,0,.9)');
      cx.fillStyle = eg;
      cx.fillRect(0, 0, W, H);
      cx.globalCompositeOperation = 'source-over';
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const onr = () => {
        fit();
        render(6);
      };
      addEventListener('resize', onr);
      render(6);
      return () => removeEventListener('resize', onr);
    }
    addEventListener('resize', fit);
    let raf = 0;
    let t = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;
      advance(dt);
      render(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', fit);
    };
  }, []);
  return <canvas className="g-cosmos" id="g-cosmos" ref={ref} aria-hidden="true" />;
}
