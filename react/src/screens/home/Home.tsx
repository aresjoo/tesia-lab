// 홈 (원본 gHome): 히어로 문구 > 템플릿 카드 갤러리 > 아래 고정 입력 띠.
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { GSUB, pickGreet } from '../../core/greets';
import { PH_ROT } from '../../core/i18n.data';
import { TF_TPL_ACTS, TF_TPL_ASSETS, type TplAct, type TplAsset } from '../../core/templates.data';
import { EMPTY_SEL, TPL_MAX, tplOf, tplText, tplToggle, type TplKind, type TplSel } from '../../core/templates';
import { G } from '../../state/conv';
import { useBodyClass, useL, useOutside, usePop } from '../../state/hooks';
import { gNew } from '../../state/tai';
import { gPillDropEnd, gPillDropStart } from '../conv/pillDrop';
import { authOpen, setState, toast, useApp } from '../../state/store';
import { POLICY, withLinks } from '../../shell/Overlays';
import { Cosmos } from './Cosmos';
import { TplArt, TplThumb } from './TplArt';

/** 첫 진입에만 등장 연출을 한다. 다시 들어오면 바로 보인다. */
let homeEntered = false;
/** 다른 화면으로 바로 들어온 경우에 부른다: 원본은 부팅 때 홈을 먼저 한 번 그리므로(gHome 의 TF_HOME_ENTR) 나중에 홈으로 오면 등장 연출이 없다 */
export const homeMarkEntered = () => {
  homeEntered = true;
};

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Lovable식 입력 안내문: 앞머리는 고정, 뒤 문구는 타자 치듯 바뀐다 (원본 phRotStart) */
function usePlaceholderRot(lang: string, paused: boolean) {
  const [ph, setPh] = useState('');
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    const lg = PH_ROT.list[lang] ? lang : 'ko';
    const pre = () => (window.innerWidth <= 860 ? PH_ROT.prefixM : PH_ROT.prefix)[lg];
    const list = PH_ROT.list[lg];
    if (reduced()) {
      setPh(pre() + list[0]);
      return;
    }
    let pi = Math.floor(Math.random() * list.length);
    let ci = 0;
    let mode: 'type' | 'hold' | 'del' = 'type';
    let hold = 0;
    setPh(pre());
    const t = setInterval(() => {
      if (pausedRef.current) return;
      const cur = list[pi];
      if (mode === 'type') {
        ci++;
        setPh(pre() + cur.slice(0, ci));
        if (ci >= cur.length) {
          mode = 'hold';
          hold = 0;
        }
      } else if (mode === 'hold') {
        if (++hold >= 24) mode = 'del';
      } else {
        ci = Math.max(0, ci - 2);
        setPh(pre() + cur.slice(0, ci));
        if (ci <= 0) {
          pi = (pi + 1) % list.length;
          mode = 'type';
        }
      }
    }, 70);
    return () => clearInterval(t);
  }, [lang]);
  return ph;
}

export function Home() {
  const L = useL();
  const lang = useApp((s) => s.lang);
  const user = useApp((s) => s.user);
  const [first] = useState(() => !homeEntered);
  const [entr, setEntr] = useState(first);
  const [sel, setSel] = useState<TplSel>(EMPTY_SEL);
  const [value, setValue] = useState('');
  const [multi, setMulti] = useState(false);
  const [full, setFull] = useState(false);
  const [resein, setResein] = useState(false);
  const [plus, setPlus] = useState(false);
  const [send, setSend] = useState<'none' | 'show' | 'pop' | 'out'>('none');
  const ta = useRef<HTMLTextAreaElement>(null);
  const pill = useRef<HTMLDivElement>(null);
  const plusPop = useRef<HTMLDivElement>(null);
  const plusT = useRef<{ t?: ReturnType<typeof setTimeout>; c?: ReturnType<typeof setTimeout> }>({});

  const greet = useMemo(() => pickGreet(lang), [lang]);
  const sub = (GSUB[lang] || GSUB.ko).split('\n');
  const tpl = tplText(sel);
  const typed = value.trim();
  const rot = usePlaceholderRot(lang, !!tpl);
  const plusState = usePop(plus);

  useEffect(() => {
    homeEntered = true;
    if (!first) return;
    const t = setTimeout(() => setEntr(false), 1900);
    return () => clearTimeout(t);
  }, [first]);
  useEffect(() => {
    if (window.innerWidth > 860) ta.current?.focus();
  }, []);
  /* 템플릿을 고르거나 풀 때마다, 고른 것이 남아 있으면 입력창에 포커스 */
  useEffect(() => {
    if (sel.acts.length || sel.assets.length) ta.current?.focus();
  }, [sel]);

  /* 보내기 단추: 글이 생기면 튀어나오고, 지우면 작아지며 사라진다. 칩만 골라도 보인다. */
  const want = !!typed || !!tpl;
  const hadText = useRef(false);
  useEffect(() => {
    if (want) {
      setSend(typed ? 'pop' : (s) => (s === 'none' || s === 'out' ? 'show' : s));
      hadText.current = !!typed;
      return;
    }
    if (!hadText.current) {
      setSend('none');
      return;
    }
    hadText.current = false;
    setSend('out');
    const t = setTimeout(() => setSend('none'), 200);
    return () => clearTimeout(t);
  }, [want, !!typed]); // eslint-disable-line react-hooks/exhaustive-deps

  useBodyClass('kb-open', !!typed);
  useOutside(plus, (t) => !!plusPop.current?.contains(t), () => setPlus(false));

  /** 여러 줄이면 알약이 넓어진다. 켜짐과 꺼짐이 서로 흔들리지 않게 바뀐 뒤의 폭에서 다시 잰다. */
  const fitHeight = () => {
    const el = ta.current;
    const p = pill.current;
    if (!el || !p) return;
    el.style.height = 'auto';
    if (!p.classList.contains('fullscr')) {
      let m = p.classList.contains('multi');
      if (!m) {
        if (el.scrollHeight > 30) m = true;
      } else {
        p.classList.remove('multi');
        el.style.height = 'auto';
        m = el.scrollHeight > 30;
      }
      p.classList.toggle('multi', m);
      setMulti(m);
      el.style.height = 'auto';
    }
    el.style.height = Math.min(el.scrollHeight, 147) + 'px';
  };

  /** tfTplPick */
  const pick = (kind: TplKind, id: string) => {
    const next = tplToggle(sel, kind, id);
    if (next === 'max') toast('최대 ' + TPL_MAX + '개까지 선택할 수 있습니다');
    else setSel(next);
  };

  /** gNew: 템플릿만 골랐으면 만든 명령 그대로, 글도 있으면 명령 + 글 */
  const submit = () => {
    const text = tpl ? (typed ? tpl.cmd + '. ' + typed : tpl.cmd) : typed || '비트코인이 떨어졌을 때 사는 전략';
    /* 손님이 보내면 가입 창을 띄우고, 가입이 끝나면 이어서 시작한다 */
    if (!user) {
      setState({ pendingNew: text });
      authOpen('signup');
      return;
    }
    const drop = gPillDropStart(); /* 홈 화면이 바뀌기 전에 알약의 자리를 본떠 둔다 */
    gNew(text, typed || text); /* 말풍선에는 사용자가 실제로 쓴 글만 */
    gPillDropEnd(drop);
  };
  /* 치다 만 글도 가입 직후 이어서 보낸다 (원본 AUTH.draft) */
  useEffect(() => {
    G.homeDraft = () => (typed ? { text: tpl ? tpl.cmd + '. ' + typed : typed, typed } : null);
    return () => {
      G.homeDraft = null;
    };
  });

  /** gExpToggle */
  const expToggle = (e?: MouseEvent) => {
    e?.stopPropagation();
    if (full) {
      setFull(false);
      setResein(true);
      setTimeout(() => setResein(false), 250);
    } else setFull(true);
    ta.current?.focus();
  };
  useEffect(() => {
    if (!full) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        expToggle();
      }
    };
    document.addEventListener('keydown', h, true);
    return () => document.removeEventListener('keydown', h, true);
  }, [full]); // eslint-disable-line react-hooks/exhaustive-deps

  const card = (kind: TplKind, t: TplAct | TplAsset, i: number) => {
    const on = sel[kind].includes(t.id);
    const d = first && entr ? ({ '--d': (kind === 'acts' ? 0.24 + i * 0.07 : 0.55 + Math.min(i, 14) * 0.035).toFixed(2) + 's' } as CSSProperties) : undefined;
    return (
      <button type="button" key={kind + t.id} className={'g-tpl' + (on ? ' on' : '')} style={d} data-k={kind} data-id={t.id} onClick={() => pick(kind, t.id)} aria-pressed={on}>
        <TplThumb t={t} />
        {t.bdg && <span className={'tbdg' + (t.bdg === 'HOT' ? ' hot' : '')}>{t.bdg}</span>}
        <span className="lb">{t.lb}</span>
      </button>
    );
  };
  const chips = (['acts', 'assets'] as const).flatMap((kind) =>
    sel[kind].map((id) => {
      const t = kind === 'acts' ? tplOf('acts', id) : tplOf('assets', id);
      if (!t) return null;
      return (
        <span className="tchip" key={kind + id}>
          <span className="th">{'img' in t ? <TplThumb t={t} /> : <TplArt id={t.id} w={42} h={42} />}</span>
          {t.lb}
          <button type="button" aria-label={t.lb + ' 선택 해제'} onClick={() => pick(kind, id)}>
            ×
          </button>
        </span>
      );
    }),
  );
  const expLabel = L(full ? 'comp.exit' : 'comp.full');

  return (
    <div className={'g-home' + (entr ? ' entr' : '')} style={{ minHeight: 'calc(100vh - 120px)', position: 'relative' }}>
      <Cosmos />
      <span className="g-hero-spark brand-bg" />
      <div className="g-hello">
        {greet.split('\n').map((t, i) => (
          <Fragment key={i}>
            {i > 0 && ' '}
            <span className="hseg">{t}</span>
          </Fragment>
        ))}
      </div>
      <div className="g-sub">
        {sub.length > 1 ? sub[0] + ' ' : sub[0]}
        {sub.length > 1 && (
          <>
            <br className="sbr" />
            {sub[1]}
          </>
        )}
      </div>
      <div className="g-tplwrap">
        <div className="g-tpls" id="g-tpls">
          {TF_TPL_ACTS.map((t, i) => card('acts', t, i))}
          {TF_TPL_ASSETS.map((t, i) => card('assets', t, i))}
        </div>
      </div>
      <div className="g-pillband">
        <div className="g-chipstack">
          {!user && (
            <div className="g-free-row">
              <button className="g-freecta" onClick={() => authOpen('signup')}>
                <span>{L('auth.free')}</span>
              </button>
            </div>
          )}
        </div>
        <div className={'g-pill' + (tpl ? ' has-tpl' : '') + (multi ? ' multi' : '') + (full ? ' fullscr' : '') + (resein ? ' resein' : '')} id="g-pill" ref={pill}>
          <div className="g-tpl-sel" id="g-tpl-sel" style={{ display: chips.length ? 'flex' : 'none' }}>
            {chips}
          </div>
          <span
            className="plus"
            role="button"
            aria-label={L('plus.t')}
            onClick={(e) => {
              e.stopPropagation();
              setPlus((v) => !v);
            }}
            onMouseEnter={() => {
              clearTimeout(plusT.current.c);
              plusT.current.t = setTimeout(() => setPlus(true), 500);
            }}
            onMouseLeave={() => {
              clearTimeout(plusT.current.t);
              plusT.current.c = setTimeout(() => setPlus(false), 250);
            }}
          >
            ＋
          </span>
          <textarea
            id="g-home-in"
            ref={ta}
            rows={1}
            placeholder={tpl ? tpl.q : rot || L('home.ph')}
            aria-label={L('home.idea')}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              requestAnimationFrame(fitHeight);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button className="g-exp" id="g-exp" onClick={expToggle} aria-label={expLabel}>
            <svg className="i-exp" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" />
            </svg>
            <svg className="i-col" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10h-6V4M14 10l7-7M4 14h6v6M10 14l-7 7" />
            </svg>
            <span className="tip" id="g-exp-tip">
              {expLabel}
            </span>
          </button>
          <span className="g-pill-sp" />
          <button className={'g-send' + (send === 'pop' ? ' pop' : send === 'out' ? ' out' : '')} id="g-home-send" onClick={submit} aria-label={L('home.send')} style={{ display: send === 'none' ? 'none' : 'inline-flex' }}>
            ↑
          </button>
          <div
            className={'g-plus-pop' + plusState.cls}
            id="g-plus-pop"
            ref={plusPop}
            onMouseEnter={() => clearTimeout(plusT.current.c)}
            onMouseLeave={() => {
              clearTimeout(plusT.current.t);
              plusT.current.c = setTimeout(() => setPlus(false), 250);
            }}
          >
            <b>{L('plus.t')}</b>
            <p>{user ? '곧 제공됩니다.' : L('plus.b')}</p>
            <div className="row">
              {user ? (
                <button className="go" onClick={() => setPlus(false)}>
                  확인
                </button>
              ) : (
                <button className="go" onClick={() => authOpen('login')}>
                  {L('nav.login')}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="g-terms">{withLinks(L('home.terms'), POLICY)}</div>
      </div>
    </div>
  );
}
