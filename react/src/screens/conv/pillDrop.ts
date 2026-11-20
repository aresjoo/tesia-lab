// PC 에서 보내는 순간 홈 입력창이 아래 입력창 자리로 흘러 내려가는 연출 (원본 gPillDropStart, gPillDropEnd).
// 화면이 바뀌기 전의 알약을 그대로 본뜬 뒤 떨어뜨리는 것이라 DOM 을 직접 다룬다.
import { G, bump } from '../../state/conv';

export type Drop = { g: HTMLElement; r: DOMRect } | null;

/** gPillDropStart(): 홈 화면이 바뀌기 전에 알약의 자리를 본떠 둔다 */
export function gPillDropStart(): Drop {
  if (window.innerWidth <= 860) return null; /* 모바일은 입력창이 이미 아래에 있다 */
  try {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  } catch {
    /* 무시 */
  }
  const pill = document.getElementById('g-pill');
  if (!pill || G.mode !== 'home' || pill.classList.contains('fullscr')) return null;
  const r = pill.getBoundingClientRect();
  if (!r.height || r.top < 0 || r.top > window.innerHeight) return null;
  const g = pill.cloneNode(true) as HTMLElement;
  g.removeAttribute('id');
  /* 떨어지는 상자는 내려앉을 입력창과 같은 구성(글 칸과 보내기 단추)으로 만든다 */
  g.querySelectorAll('.plus,.g-exp,.g-plus-pop,.g-pill-sp').forEach((n) => n.remove());
  const gt = g.querySelector('textarea');
  if (gt) {
    gt.value = '';
    gt.style.height = '21px';
    gt.placeholder = G.placeholder || '시장에 대해 무엇이든 물어보십시오';
  }
  g.classList.remove('multi');
  const sb = g.querySelector<HTMLElement>('.g-send');
  if (sb) {
    sb.style.display = 'inline-flex';
    sb.classList.remove('pop', 'out');
  }
  g.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  g.setAttribute('aria-hidden', 'true');
  g.style.cssText =
    'position:fixed;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;margin:0;z-index:55;pointer-events:none;will-change:transform;' + 'transition:transform .34s cubic-bezier(.3,0,.15,1),width .34s cubic-bezier(.3,0,.15,1),height .34s cubic-bezier(.3,0,.15,1),opacity .2s ease .14s';
  document.body.appendChild(g);
  return { g, r };
}
/** gPillDropEnd(d): 대화 화면이 그려진 뒤 아래 입력창 자리로 떨어뜨린다 */
export function gPillDropEnd(d: Drop) {
  if (!d) return;
  const wrap = document.getElementById('g-composer-wrap');
  const shown = !!wrap && !wrap.hidden;
  if (shown) {
    G.dropFly = true; /* 내려앉을 때까지 진짜 입력창을 가린다 */
    bump();
  }
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const tgt = shown && wrap ? wrap.querySelector('.g-composer') : null;
      if (tgt) {
        const tr = tgt.getBoundingClientRect();
        d.g.style.width = tr.width + 'px';
        d.g.style.height = tr.height + 'px';
        d.g.style.transform = 'translate(' + (tr.left - d.r.left) + 'px,' + (tr.top - d.r.top) + 'px)';
      } else {
        d.g.style.transform = 'translateY(' + (window.innerHeight - d.r.top - d.r.height - 24) + 'px)';
        d.g.style.opacity = '0';
      }
    }),
  );
  setTimeout(() => {
    G.dropFly = false;
    bump();
    if (d.g.parentNode) d.g.remove();
  }, 400);
}
