// 원본 <aside id="g-side">. class 와 id 는 원본 CSS 가 그대로 먹도록 바꾸지 않는다.
import type { MouseEvent } from 'react';
import { legacy } from '../core/config';
import { SessList } from '../screens/conv/SessList';
import { G, gHistory, gHome, useConv } from '../state/conv';
import { useL } from '../state/hooks';
import { goHome, nav } from '../state/route';
import { authOpen, getState, setState, sideMobClose, sideToggle, useApp } from '../state/store';
import { GearPath, Ico, InfoPath } from './icons';

/** gSetMenu(e): 누른 자리(프로필 줄이나 톱니) 위에 메뉴를 띄운다 */
export function openSetMenu(e: MouseEvent<HTMLElement>) {
  e.stopPropagation();
  if (getState().setMenu.open) {
    setState({ setMenu: { open: false } });
    return;
  }
  if (window.innerWidth > 640) {
    let r = e.currentTarget.getBoundingClientRect();
    const side = document.getElementById('g-side');
    if (!r.width && side) r = side.getBoundingClientRect();
    setState({ setMenu: { open: true, left: Math.max(10, Math.min(r.left, window.innerWidth - 260)), bottom: window.innerHeight - r.top + 10 }, glcOpen: false });
  } else setState({ setMenu: { open: true }, glcOpen: false });
}

export function Sidebar() {
  const L = useL();
  const user = useApp((s) => s.user);
  const collapsed = useApp((s) => s.sideCollapsed);
  const mobileOpen = useApp((s) => s.sideMobileOpen);
  const menuOpen = useApp((s) => s.setMenu.open);
  useConv(); /* 연구 기록 단추의 지금 자리 표시 */

  const home = () => {
    goHome();
    gHome(); /* 열려 있던 대화를 닫는다 */
    sideMobClose();
  };
  /** gBrandClick(): 접힌 레일에서는 사이드바 열기, 펼침에서는 홈 */
  const brandClick = () => {
    if (collapsed && window.innerWidth > 860) sideToggle();
    else home();
  };
  /** gProfileClick(ev) */
  const profileClick = (e: MouseEvent<HTMLElement>) => {
    if (!user) authOpen('login');
    else openSetMenu(e);
  };
  const note = L('side.note').split('|');
  const profileLabel = user ? user.name || '프로필' : L('nav.login');

  return (
    <aside className={'g-side' + (collapsed ? ' collapsed' : '') + (mobileOpen ? ' mobile-open' : '') + (user ? ' authed' : '')} id="g-side">
      <div id="g-brand-row">
        <span className="g-brand-link" onClick={brandClick} role="button" aria-label="홈으로">
          <span className="brand-slot">
            <span className="brand-mark brand-bg" />
            <Ico className="brand-panel" size={19} sw={1.7}>
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <path d="M9.5 4v16" />
              <path d="M13.5 9.5l2.5 2.5-2.5 2.5" />
            </Ico>
          </span>
          <span className="g-word">TETH</span>
          <span className="g-ico-pill" id="gp-open">
            {L('side.open')}
          </span>
        </span>
      </div>
      <div className="g-ico-row" id="g-side-toggle">
        <button className="g-ico-btn" onClick={sideToggle} aria-label={L('side.close')}>
          <Ico className="ico-close" size={19} sw={1.7}>
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d="M9.5 4v16" />
            <path d="M16 9.5L13.5 12l2.5 2.5" />
          </Ico>
        </button>
        <span className="g-ico-pill" id="gp-close">
          {L('side.close')}
        </span>
      </div>
      <button className="g-new" onClick={home} aria-label={L('side.newTip')}>
        <Ico size={17}>
          <path d="M12 3a9 9 0 1 0 9 9" />
          <path d="M17.8 2.8l3.4 3.4L13 14.4l-4 .6.6-4z" />
        </Ico>
        <span className="lb">{L('side.newTip')}</span>
        <span className="g-ico-pill lbp" id="gp-new">
          {L('side.newTip')}
        </span>
      </button>
      <button className={'g-util' + (G.mode === 'history' ? ' cur' : '')} onClick={gHistory}>
        <Ico size={16} sw={1.7} join={false}>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </Ico>
        <span className="lb">연구 기록</span>
        <span className="g-ico-pill lbp">연구 기록</span>
      </button>
      <button className="g-util" id="g-tf-dash-btn" onClick={() => nav('#/trade')}>
        <Ico size={16}>
          <rect x="3" y="4" width="18" height="16" rx="2.5" />
          <path d="M7 15l3-4 2.5 2.5L17 9" />
        </Ico>
        <span className="lb">AI 트레이딩</span>
        <span className="g-ico-pill lbp">AI 트레이딩</span>
      </button>
      <button className="g-util" id="g-tf-share-btn" onClick={() => nav('#/share')}>
        <Ico size={16}>
          <path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8-.7-.7-2-.8-3-.2z" />
          <path d="M12 15l-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 21.5 2c0 2.7-.9 7.5-6 10.6a22.4 22.4 0 0 1-3.5 2.4z" />
          <path d="M9 12H4s.5-3.6 2-5c1.6-1.5 5 0 5 0" />
          <path d="M12 15v5s3.6-.5 5-2c1.5-1.6 0-5 0-5" />
        </Ico>
        <span className="lb">전략 복사</span>
        <span className="g-ico-pill lbp">전략 복사</span>
      </button>
      <button className="g-util" id="g-tf-cx-btn" onClick={() => nav('#/trade')}>
        <Ico size={16}>
          <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
          <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
        </Ico>
        <span className="lb">거래소 연결</span>
        <span className="g-ico-pill lbp">거래소 연결</span>
      </button>
      <div id="g-guest-note">
        <Ico size={15} join={false}>
          {InfoPath}
        </Ico>
        <span>
          {note[0]}
          <a onClick={() => authOpen('login')}>{note[1]}</a>
          {note[2] || ''}
        </span>
      </div>
      <div className="g-sec">최근</div>
      <SessList />
      <div className="g-sec" id="g-live-sec" hidden>
        Live
      </div>
      <div id="g-live-list" />
      <div id="g-side-links">
        <a className="g-util" href={legacy('about/')}>
          <Ico size={15} join={false}>
            {InfoPath}
          </Ico>
          {L('nav.about')}
        </a>
        <a className="g-util" href={legacy('download/')} target="_blank" rel="noopener noreferrer">
          <Ico size={15}>
            <path d="M12 3v12" />
            <path d="M7 10l5 5 5-5" />
            <path d="M5 20h14" />
          </Ico>
          {L('nav.download')}
        </a>
      </div>
      <div className="g-side-bottom">
        <div className={'g-ico-row' + (menuOpen ? ' pill-off' : '')} id="g-gear-row">
          <button className="g-ico-btn" id="g-gear-btn" onClick={openSetMenu} aria-label={L('menu.settings')}>
            <Ico size={19}>{GearPath}</Ico>
          </button>
          <span className="g-ico-pill" id="gp-set">
            {L('menu.settings')}
          </span>
        </div>
        <div className="g-ico-row" id="g-person-row">
          <button className="g-ico-btn" onClick={profileClick} aria-label={profileLabel}>
            <Ico size={21} sw={1.5}>
              <circle cx="12" cy="12" r="9.2" />
              <circle cx="12" cy="9.6" r="3" />
              <path d="M6.4 18.4c1.2-2.6 3.2-3.9 5.6-3.9s4.4 1.3 5.6 3.9" />
            </Ico>
          </button>
          <span className="g-ico-pill" id="g-profile">
            {user ? user.name : L('nav.login')}
          </span>
        </div>
        <button id="g-login-btn" onClick={() => authOpen('login')}>
          {L('side.login')}
        </button>
        <div
          id="g-me-row"
          onClick={openSetMenu}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openSetMenu(e as unknown as MouseEvent<HTMLElement>);
            }
          }}
        >
          <span className="av" id="g-me-av">
            {user && user.name ? user.name.trim().charAt(0).toUpperCase() : ''}
          </span>
          <span id="g-me-name">{user ? user.name : ''}</span>
          <span style={{ flex: 1 }} />
          <Ico className="gear" size={19}>
            {GearPath}
          </Ico>
        </div>
      </div>
    </aside>
  );
}
