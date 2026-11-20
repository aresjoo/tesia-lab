// 셸 위에 뜨는 것들: 앱 배너, 상단 단추, 언어와 통화 패널, 설정 메뉴, 의견 패널, 토스트, 고객지원 버튼.
import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent, type ReactNode } from 'react';
import { legacy } from '../core/config';
import { GLC_CURS, GLC_LANGS } from '../core/i18n.data';
import { useL, useOutside, usePop } from '../state/hooks';
import { nav } from '../state/route';
import { authOpen, bannerClose, logout, setCur, setLang, setState, sideToggle, toast, useApp } from '../state/store';
import { GearPath, Ico, SearchIco } from './icons';

/** {P}..{/} {T}..{/} 자리표가 든 문구를 링크로 바꾼다 */
export function withLinks(text: string, map: Record<string, string>): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\{([A-Z]+)\}(.*?)\{\/\}|\{BR\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[0] === '{BR}') out.push(' ', <br className="tbr" key={m.index} />);
    else
      out.push(
        <a key={m.index} href={map[m[1]]} target="_blank" rel="noopener noreferrer">
          {m[2]}
        </a>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
export const POLICY = { T: legacy('policies/#terms'), P: legacy('policies/#privacy') };

export function AppBanner() {
  const L = useL();
  return (
    <div id="g-appbanner">
      <span className="icon">
        <span className="brand-bg" style={{ width: 26, height: 17 }} />
      </span>
      <span className="t">
        <b>TETH AI</b>
        <span>{L('banner.sub')}</span>
      </span>
      <a className="dl" href={legacy('download/')} target="_blank" rel="noopener noreferrer">
        {L('banner.dl')}
      </a>
      <button className="x" onClick={bannerClose} aria-label="닫기">
        ✕
      </button>
    </div>
  );
}

export function TopBar() {
  const L = useL();
  const user = useApp((s) => s.user);
  return (
    <>
      <button id="g-hamburger" onClick={sideToggle} aria-label={L('common.menu')}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <span id="g-auth-btns" hidden={!!user}>
        <a className="ga-nav" href={legacy('about/')}>
          {L('nav.about')}
        </a>
        <a className="ga-nav" href={legacy('download/')} target="_blank" rel="noopener noreferrer">
          {L('nav.download')}
        </a>
        <button className="ga-login" onClick={() => authOpen('login')}>
          {L('nav.login')}
        </button>
        <button className="ga-signup" onClick={() => authOpen('signup')}>
          {L('nav.signup')}
        </button>
      </span>
      <button
        id="g-globe"
        hidden={!!user}
        onClick={(e) => {
          e.stopPropagation();
          setState((s) => ({ glcOpen: true, setMenu: { open: false }, sideMobileOpen: false, sideCollapsed: s.sideMobileOpen ? true : s.sideCollapsed }));
        }}
        aria-label={L('menu.glc')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.6 2.5 3.9 5.5 3.9 9S14.6 18.5 12 21c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3z" />
        </svg>
        <span className="gtip" id="g-globe-tip">
          {L('menu.glc')}
        </span>
      </button>
    </>
  );
}

export function GlcPanel() {
  const L = useL();
  const open = useApp((s) => s.glcOpen);
  const lang = useApp((s) => s.lang);
  const cur = useApp((s) => s.cur);
  const pop = usePop(open);
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState(0);
  const [qL, setQL] = useState('');
  const [qC, setQC] = useState('');
  const close = () => setState({ glcOpen: false });
  useOutside(open, (t) => !!ref.current?.contains(t), close);
  const hit = (txt: string, q: string) => txt.toLowerCase().indexOf(q.trim().toLowerCase()) >= 0;
  return (
    <div id="glc-panel" ref={ref} className={pop.cls.trim()}>
      <div className="grab2" onClick={close} />
      <button className="x2" onClick={close} aria-label={L('common.close')}>
        ✕
      </button>
      <div className="tabs2">
        <button className={tab === 0 ? 'on' : ''} id="glc-tab-l" onClick={() => setTab(0)}>
          {L('glc.lang')}
        </button>
        <button className={tab === 1 ? 'on' : ''} id="glc-tab-c" onClick={() => setTab(1)}>
          {L('glc.curTab')}
        </button>
      </div>
      <div className="info">
        <span className="ii">i</span>
        <span id="glc-info-txt">{L('glc.info')}</span>
      </div>
      <div className={'col' + (tab === 0 ? ' on' : '')} id="glc-lang">
        <h4>
          <span id="glc-h-lang">{L('glc.lang')}</span> <span className="qi">i</span>
          <span className="qtip" id="glc-lang-tip">
            {L('glc.info')}
          </span>
        </h4>
        <div className="srch">
          <SearchIco />
          <input id="glc-srch-l" placeholder={L('glc.search')} value={qL} onChange={(e) => setQL(e.target.value)} />
        </div>
        <ul id="glc-lang-list">
          {GLC_LANGS.map((l) => (
            <li key={l.c} data-v={l.c} data-on={lang === l.c ? 1 : 0} style={hit(l.n, qL) ? undefined : { display: 'none' }} onClick={() => setLang(l.c)}>
              {l.n}
              <span className="ck">✓</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={'col' + (tab === 1 ? ' on' : '')} id="glc-cur">
        <h4 id="glc-h-cur">{L('glc.cur')}</h4>
        <div className="srch">
          <SearchIco />
          <input id="glc-srch-c" placeholder={L('glc.search')} value={qC} onChange={(e) => setQC(e.target.value)} />
        </div>
        <ul id="glc-cur-list">
          {GLC_CURS.map((c) => (
            <li key={c.c} data-v={c.c} data-on={cur === c.c ? 1 : 0} style={hit(c.c, qC) ? undefined : { display: 'none' }} onClick={() => setCur(c.c)}>
              {c.c}
              <span className="ck">✓</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function SetMenu() {
  const L = useL();
  const user = useApp((s) => s.user);
  const menu = useApp((s) => s.setMenu);
  const pop = usePop(menu.open);
  const ref = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const [sub, setSub] = useState(false);
  const [up, setUp] = useState(false);
  const pos = useRef<{ left?: number; bottom?: number }>({});
  if (menu.open) pos.current = { left: menu.left, bottom: menu.bottom };
  const close = () => setState({ setMenu: { open: false } });
  useOutside(menu.open, (t) => !!ref.current?.contains(t), close);
  useEffect(() => {
    if (!pop.shown) setSub(false);
  }, [pop.shown]);
  /** gmFlip(item): 항목 아래가 좁으면 하위 메뉴를 위로 연다 */
  const flip = (item: HTMLElement) => {
    if (window.innerWidth <= 640 || !subRef.current) return;
    const s = subRef.current;
    const pd = s.style.display;
    const pv = s.style.visibility;
    s.style.visibility = 'hidden';
    s.style.display = 'block';
    const h = s.offsetHeight;
    s.style.display = pd;
    s.style.visibility = pv;
    setUp(item.getBoundingClientRect().top + h > window.innerHeight - 12);
  };
  const item = (fn: () => void) => () => {
    close();
    fn();
  };
  const st = pos.current.left != null && window.innerWidth > 640 ? { left: pos.current.left, bottom: pos.current.bottom, top: 'auto' } : undefined;
  return (
    <div id="g-setmenu" ref={ref} hidden={!pop.shown} className={(pop.closing ? 'pop-closing' : '') + (sub && window.innerWidth <= 640 ? ' subopen' : '')} style={st}>
      <div className="gm-grab" onClick={close} />
      <button
        className="gm-item"
        id="gm-set-item"
        onClick={(e) => {
          e.stopPropagation();
          close();
          if (!user) authOpen('login');
          else nav('#/settings/general');
        }}
      >
        <Ico>{GearPath}</Ico>
        {L('menu.settings')}
      </button>
      <button className="gm-item" onClick={item(() => nav('#/insight'))}>
        <Ico>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </Ico>
        인사이트
      </button>
      <button className="gm-item" onClick={item(() => nav('#/trade'))}>
        <Ico>
          <path d="M3 21h18M5 21V8l7-5 7 5v13" />
          <path d="M9 21v-6h6v6" />
          <path d="M9 11h.01M15 11h.01" />
        </Ico>
        거래소 연결
      </button>
      <button className="gm-item" onClick={item(() => setState({ fbOpen: true }))}>
        <Ico>
          <path d="M4 5h16v12H8l-4 4z" />
          <path d="M12 8.2v.4M12 11v3" />
        </Ico>
        {L('menu.feedback')}
      </button>
      <button className="gm-item" id="gm-cs" hidden={!user} onClick={item(() => setState({ helpOpen: true }))}>
        <Ico>
          <path d="M4.5 13a7.5 7.5 0 0 1 15 0" />
          <rect x="3" y="12.5" width="4" height="6.5" rx="2" />
          <rect x="17" y="12.5" width="4" height="6.5" rx="2" />
          <path d="M19 19v.4a3 3 0 0 1-3 3h-3" />
        </Ico>
        고객센터
      </button>
      <a className="gm-item" id="gm-dl" hidden={!user} href={legacy('download/')} target="_blank" rel="noopener noreferrer" onClick={close}>
        <Ico>
          <rect x="6" y="2.5" width="12" height="19" rx="2.6" />
          <path d="M12 6.2v6.6M9.4 10.4l2.6 2.4 2.6-2.4" />
          <path d="M10.4 18.6h3.2" />
        </Ico>
        앱 다운로드
      </a>
      <div
        className="gm-item"
        role="button"
        tabIndex={0}
        onClick={(e: MouseEvent<HTMLDivElement>) => {
          e.stopPropagation();
          flip(e.currentTarget);
          setSub((v) => !v);
        }}
        onMouseEnter={(e) => flip(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.currentTarget.click();
          }
        }}
      >
        <Ico>
          <rect x="5" y="3" width="16" height="16" rx="3" />
          <path d="M5 7H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1" opacity=".6" />
          <path d="M10.5 8.6a2.6 2.6 0 1 1 3.6 2.4c-.8.35-1.1.8-1.1 1.6" />
          <path d="M13 15.4v.2" />
        </Ico>
        {L('menu.help')}
        <span className="sp" />
        <Ico className="arr" size={14} sw={2}>
          <path d="M9 6l6 6-6 6" />
        </Ico>
        <div className={'gm-sub' + (sub ? ' on' : '') + (up ? ' up' : '')} id="gm-sub-help" ref={subRef} onClick={(e) => e.stopPropagation()}>
          <div className="st">{L('menu.help')}</div>
          <a href={POLICY.T} target="_blank" rel="noopener noreferrer">
            {L('menu.terms')}
          </a>
          <a href={POLICY.P} target="_blank" rel="noopener noreferrer">
            {L('menu.privacy')}
          </a>
          <a href={legacy('about/')}>{L('nav.about')}</a>
        </div>
      </div>
      <button className="gm-item" id="gm-plan" hidden={!user} onClick={item(() => nav('#/plan'))}>
        <Ico>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="M3 10h18" />
          <path d="M7 15h4" />
        </Ico>
        이용 현황
      </button>
      <button className="gm-item" id="gm-logout" hidden={!user} onClick={item(logout)}>
        <Ico>
          <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </Ico>
        로그아웃
      </button>
    </div>
  );
}

export function FeedbackPanel() {
  const L = useL();
  const open = useApp((s) => s.fbOpen);
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  const [shot, setShot] = useState<{ src: string; nm: string } | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setText('');
    setDone(false);
    setShot(null);
    const t = setTimeout(() => ta.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [open]);
  const close = () => setState({ fbOpen: false });
  const attach = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) {
      toast('이미지 파일만 첨부할 수 있습니다');
      e.target.value = '';
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast('10MB 이하 이미지만 첨부할 수 있습니다');
      e.target.value = '';
      return;
    }
    const rd = new FileReader();
    rd.onload = () => setShot({ src: String(rd.result), nm: f.name + ' (' + Math.round(f.size / 1024) + 'KB)' });
    rd.readAsDataURL(f);
  };
  const submit = () => {
    const t = text.trim();
    if (!t) {
      toast(L('fb.req'));
      ta.current?.focus();
      return;
    }
    try {
      const fl = JSON.parse(localStorage.getItem('teth.feedback') || '[]');
      fl.push({ t: t.slice(0, 2000), at: new Date().toISOString() });
      localStorage.setItem('teth.feedback', JSON.stringify(fl.slice(-50)));
    } catch {
      /* 저장 못 해도 완료 화면은 보인다 */
    }
    setDone(true);
  };
  return (
    <div id="fb-panel" className={open ? 'on' : ''}>
      <div id="fb-main" style={{ display: done ? 'none' : 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div className="fb-hd">
          <span id="fb-title">{L('fb.title')}</span>
          <button className="fb-x" onClick={close} aria-label={L('common.close')}>
            ✕
          </button>
        </div>
        <div className="fb-body">
          <label id="fb-lbl">{L('fb.label')}</label>
          <textarea id="fb-text" ref={ta} placeholder={L('fb.ph')} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="fb-sens">
            <span id="fb-sens-t">{L('fb.sens')}</span>
            <span className="fb-q">?</span>
            <div className="fb-tip" id="fb-tip">
              {L('fb.tip')}
            </div>
          </div>
          <div className="fb-shot-desc" id="fb-shot-desc">
            {L('fb.shot')}
          </div>
          <button className="fb-attach" onClick={() => file.current?.click()}>
            <Ico size={17} sw={1.8}>
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 15l5-5 4 4 3-3 6 6" />
              <circle cx="9" cy="9" r="1.3" />
            </Ico>
            <span id="fb-attach-t">{L('fb.attach')}</span>
          </button>
          <input type="file" id="fb-file" ref={file} accept="image/*" hidden onChange={attach} />
          <div className={'fb-prev' + (shot ? ' on' : '')} id="fb-prev">
            <img id="fb-prev-img" alt="첨부된 스크린샷" src={shot?.src} />
            <button
              className="rm"
              onClick={() => {
                setShot(null);
                if (file.current) file.current.value = '';
              }}
              aria-label="첨부 제거"
            >
              ✕
            </button>
            <div className="nm" id="fb-prev-nm">
              {shot?.nm}
            </div>
          </div>
          <div className="fb-fine" id="fb-fine">
            {withLinks(L('fb.fine'), POLICY)}
          </div>
        </div>
        <div className="fb-ft">
          <button className="fb-send" id="fb-send" onClick={submit}>
            {L('fb.send')}
          </button>
        </div>
      </div>
      <div id="fb-done" className={done ? 'on' : ''}>
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="44" stroke="#3d6ef0" strokeWidth="3" />
          <path d="M42 61l12 12 24-26" stroke="#3d6ef0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M95 25c1.2 5 3.8 7.6 8.8 8.8.6.14.6.9 0 1.04-5 1.2-7.6 3.8-8.8 8.8-.14.6-.9.6-1.04 0-1.2-5-3.8-7.6-8.8-8.8-.6-.14-.6-.9 0-1.04 5-1.2 7.6-3.8 8.8-8.8.14-.6.9-.6 1.04 0z" fill="#FFB60A" />
        </svg>
        <b id="fb-done-t">{L('fb.doneT')}</b>
        <p id="fb-done-p">{L('fb.doneP')}</p>
        <button className="cls" id="fb-done-x" onClick={close} aria-label={L('common.close')}>
          {L('common.close')}
        </button>
      </div>
    </div>
  );
}

export function Toast() {
  const t = useApp((s) => s.toast);
  return (
    <div id="toast" role="status" aria-live="polite" className={t.show ? 'show' : ''}>
      {t.text}
    </div>
  );
}

/* 24시간 고객센터 버튼 (원본 help-widget.js). 문구는 위젯이 가진 언어별 표 그대로. */
const HW_LANGS = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'];
const HW = {
  tip: ['24/7 고객지원', '24/7 Support', '24時間サポート', '24/7客服支持', '24/7客服支援', 'Soporte 24/7', 'Assistance 24h/24'],
  body: [
    '무엇이든 물어보십시오. 상담원이 연중무휴 24시간 대기하고 있습니다.',
    'Ask us anything. Our agents are available around the clock.',
    '何でもお尋ねください。担当者が24時間365日対応します。',
    '有任何问题都可以咨询，客服全年无休24小时在线。',
    '有任何問題都可以諮詢，客服全年無休24小時在線。',
    'Pregúntanos lo que sea. Nuestro equipo está disponible 24/7.',
    'Posez-nous vos questions. Notre équipe est disponible 24h/24, 7j/7.',
  ],
  sub: [
    '상담원이 24시간 답합니다. support@teth.ai',
    'Our team answers 24/7. support@teth.ai',
    'ライブチャットは近日提供予定です。support@teth.ai',
    '在线聊天即将上线。support@teth.ai',
    '線上聊天即將上線。support@teth.ai',
    'El chat en vivo llegará pronto. support@teth.ai',
    'Le chat en direct arrive bientôt. support@teth.ai',
  ],
};
export function HelpWidget() {
  const lang = useApp((s) => s.lang);
  const open = useApp((s) => s.helpOpen);
  const i = Math.max(0, HW_LANGS.indexOf(lang));
  const pop = usePop(open);
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useOutside(open, (t) => !!box.current?.contains(t) || !!btn.current?.contains(t), () => setState({ helpOpen: false }));
  return (
    <>
      <button
        id="teth-help"
        ref={btn}
        aria-label={HW.tip[i]}
        onClick={(e) => {
          e.stopPropagation();
          setState((s) => ({ helpOpen: !s.helpOpen }));
        }}
      >
        <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
          <defs>
            <linearGradient id="thg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FF5145" />
              <stop offset=".38" stopColor="#FFB60A" />
              <stop offset=".66" stopColor="#2BAE66" />
              <stop offset="1" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
          <path d="M6.2 15.5a9.8 9.8 0 0 1 19.6 0" stroke="#e6e7ea" strokeWidth="2" strokeLinecap="round" />
          <rect x="3.6" y="14.6" width="5" height="8.4" rx="2.5" fill="#e6e7ea" />
          <rect x="23.4" y="14.6" width="5" height="8.4" rx="2.5" fill="#e6e7ea" />
          <path d="M25.9 23v.9a3.6 3.6 0 0 1-3.6 3.6h-3.4" stroke="#e6e7ea" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="18" cy="27.5" r="1.6" fill="#e6e7ea" />
          <path d="M15.63 11.6c.42 2.6 1.82 4 4.42 4.42.28.05.28.57 0 .62-2.6.42-4 1.82-4.42 4.42-.05.28-.57.28-.62 0-.42-2.6-1.82-4-4.42-4.42-.28-.05-.28-.57 0-.62 2.6-.42 4-1.82 4.42-4.42.05-.28.57-.28.62 0z" fill="url(#thg)" />
        </svg>
        <span className="dot" />
        <span className="tip">{HW.tip[i]}</span>
      </button>
      <div id="teth-help-pop" ref={box} className={pop.shown ? (pop.closing ? 'on closing' : 'on') : ''}>
        <b>
          <i />
          {HW.tip[i]}
        </b>
        {HW.body[i]}
        <div className="sub">{HW.sub[i]}</div>
      </div>
    </>
  );
}
