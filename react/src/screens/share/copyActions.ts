// 복사 흐름의 동작 (원본 cpSetupGo, skcSheet, tfMkActivate, cpStart, cpAdjCommit, cpFlat, cpClose, mkStopGo, mkWindCheck).
// 화면은 FollowSheet.tsx(복사 설정 창)와 CopyDetail.tsx(복사한 전략 상세)가 그린다.
// 거래소 연결과 본인 확인은 거래소 연결 화면(screens/account/brokers 의 acStart, acRunGate)으로 잇는다.
import { MK_STOP_L, CPP_PAIR } from '../../core/share.data';
import { cpCalc, type Copy } from '../../core/copy';
import { MK_ASOF, PRICE0 } from '../../core/engine/data';
import { tfSSFind } from '../../core/engine/catalog';
import type { Strat } from '../../core/engine/types';
import { cpUsd, tfSSNe } from '../../core/engine/format';
import { acConnList, acEx, acS, tfIntentSet } from '../../core/account/ac';
import { acStart } from '../account/brokers/flow';
import { acRunGate } from '../account/brokers/kyc';
import { nav } from '../../state/route';
import { getShare, setShare } from '../../state/share';
import { authOpen, getState, toast } from '../../state/store';

/** cpFind(id) */
export function cpFind(id: string): Copy | null {
  return getShare().cp.copies.find((x) => x.id === id) || null;
}
/** 복사 한 건을 고쳐 쓴다 (원본은 객체를 바로 고치고 tfSaveNow) */
function patchCopy(cid: string, f: (c: Copy) => Copy, spot?: (n: number) => number) {
  setShare((s) => ({ cp: { ...s.cp, spot: spot ? spot(s.cp.spot) : s.cp.spot, copies: s.cp.copies.map((c) => (c.id === cid ? f(c) : c)) } }));
}
/** 전략의 마지막 봉 */
function lastBar(nick: string): number | null {
  const s = tfSSFind(nick);
  const eq = s && s.r && s.r.eq;
  return eq && eq.length ? eq[eq.length - 1].i : null;
}

/** tfMkActivate(): 주문 권한 거래소가 없으면 거래소 연결(acStart)로 넘긴다. 연결을 마치면 acAfter 가 이 전략의 복사 설정 창을 다시 연다 */
function toConnect(s: Strat) {
  followClose();
  acStart({ need: s.ex && acEx(s.ex) ? s.ex : null, name: s.name || s.nick, after: { kind: 'copy', id: tfSSNe(s.nick) } });
}

/** cpSetupGo(ne): 「전략 복사하기」. 손님은 가입(하려던 일로 기억), 회원은 복사 설정 창 */
export function cpSetupGo(id: string) {
  if (!getState().user) {
    authOpen('signup');
    tfIntentSet({ kind: 'copy', id, from: window.location.hash });
    return;
  }
  followOpen(id);
}
/** mkFollowSheet(ne) = skcSheet(ne): 거래소가 없으면 연결로, 있으면 복사 설정 창. 거래소 연결을 마친 뒤(acAfter)에도 여기로 온다 */
export function followOpen(id: string) {
  const s = tfSSFind(safeDecode(id));
  if (!s) {
    toast('지금은 복사할 수 없는 전략입니다');
    return;
  }
  if (!getShare().apiEx) {
    toConnect(s);
    return;
  }
  setShare({ follow: s.id });
}
function safeDecode(ne: string): string {
  try {
    return decodeURIComponent(ne);
  } catch {
    return ne;
  }
}
/** mkFollowClose() */
export function followClose() {
  setShare({ follow: null });
}

/** tfShareHub('follow'): 복사한 전략 목록은 터미널(#/trade)에 있다 */
export function goFollowList() {
  nav('#/trade');
}

/** cpStart(ne): 복사 시작. 폼 검사는 창이 끝내고 넘긴다 */
export function cpStart(id: string, form: { amt: number; loss: number; existing: string; cap: number }): boolean {
  if (!getState().user) {
    authOpen('signup');
    return false;
  }
  const s2 = tfSSFind(safeDecode(id));
  if (!s2) return false;
  /* acRunGate: 이 전략의 거래소(없으면 처음 연결한 거래소)의 본인 확인이 안 끝났으면 확인 창을 띄우고, 끝나면 이어서 시작한다 */
  const ex = s2.ex && acEx(s2.ex) && acS().conn[s2.ex] ? s2.ex : acConnList()[0] || null;
  let done = false; /* 확인이 이미 끝났으면 바로 시작해 창이 닫힌다. 확인 창을 띄웠으면 창은 그대로 두고 끝난 뒤 이어 간다 */
  acRunGate(ex, () => {
    done = cpStartGo(s2, form);
  });
  return done;
}
/** cpStart 의 본문 (본인 확인을 지난 뒤) */
function cpStartGo(s2: Strat, form: { amt: number; loss: number; existing: string; cap: number }): boolean {
  const sh = getShare();
  const nick = s2.nick; /* ID 나 옛 이름으로 들어와도 같은 전략으로 저장 */
  /* tfDerive().entitlement.follow: 주문 권한 거래소가 없으면 거래소 연결로 (tfAcSheet) */
  if (!sh.apiEx) {
    followClose();
    acStart({ ex: 'bitget', after: { kind: 'terminal' } });
    return false;
  }
  if (sh.cp.copies.some((x) => x.nick === nick && x.status === 'active')) {
    /* 전략당 활성 전략 복사 1건 */
    toast('이미 이 전략을 따라가고 있습니다. 복사한 전략 탭에서 관리할 수 있습니다');
    followClose();
    goFollowList();
    return false;
  }
  const amt = form.amt;
  const eqA = s2.r.eq || [];
  const now = Date.now();
  const startI = eqA.length > 31 ? eqA[eqA.length - 31].i : null; /* 데모: 시작을 30봉 전으로 시뮬 */
  const c2: Copy = {
    id: 'cp' + now,
    nick,
    mode: 'ratio',
    amount: amt,
    pairs: [CPP_PAIR[s2.asset] || s2.asset],
    gen: { asof: MK_ASOF.slice(), len: PRICE0.length },
    simStartI: startI,
    adv: { marginMode: 'follow', lev: 'follow', slip: 'sys', maxMarginPct: form.cap || 95, maxPosX: 5, maxLoss: form.loss || -20, existing: form.existing || 'skip' },
    at: now,
    status: 'active',
    ledger: [{ at: now, type: 'add', amt, i: startI }] /* 입출금은 덧붙이기만 한다 */,
  };
  setShare((s) => ({ follow: null, cp: { ...s.cp, spot: Math.max(0, s.cp.spot - amt), copies: s.cp.copies.concat([c2]) } }));
  toast(nick + ' 전략 복사를 시작했습니다. ' + (c2.adv.existing === 'copy' ? '지금 든 종목부터 바로 따라갑니다' : '다음 진입부터 자동으로 따라갑니다'));
  goFollowList();
  return true;
}

/** cpAdjCommit(cid,v,dir): 예산 추가와 회수 */
export function cpAdjCommit(cid: string, v: number, dir: 'add' | 'out'): boolean {
  const c2 = cpFind(cid);
  if (!c2) return false;
  if (dir === 'add' && v > getShare().cp.spot) {
    toast('사용 가능 금액이 부족합니다');
    return false;
  }
  const i = lastBar(c2.nick); /* i = 그 시점 봉 (반영 시점과 기준가의 기준) */
  patchCopy(cid, (c) => ({ ...c, ledger: c.ledger.concat([{ at: Date.now(), type: dir, amt: v, i }]) }), (n) => (dir === 'add' ? n - v : n + v));
  toast(dir === 'add' ? cpUsd(v, 0) + '를 예산에 추가했습니다' : cpUsd(v, 0) + '를 회수했습니다');
  return true;
}

/** cpClose(cid,silent): 복사를 끝내고 예산을 돌려받는다 */
export function cpClose(cid: string, silent?: boolean) {
  const c0 = cpFind(cid);
  if (!c0 || c0.status !== 'active') return;
  const endI = lastBar(c0.nick);
  const c1: Copy = endI != null ? { ...c0, endI } : c0;
  const d = cpCalc(c1);
  const back = Math.max(0, d.est);
  const now = Date.now();
  patchCopy(cid, () => ({ ...c1, status: 'closed', closedAt: now, settle: { net: d.net, share: d.share, back }, ledger: c1.ledger.concat([{ at: now, type: 'out', amt: back, i: c1.endI ?? null }]) }), (n) => n + back);
  if (silent) return;
  toast('전략 복사를 중단했습니다' + (c1.stopMode && c1.stopMode !== 'now' ? ' (' + MK_STOP_L[c1.stopMode] + ')' : '') + '. ' + cpUsd(back, 0) + '가 예산으로 돌아왔습니다');
  goFollowList();
}

/** cpFlat(cid): 포지션만 정리한다. 멈추는 중이면 복사를 끝낸다. 화면에 남으면 true */
export function cpFlat(cid: string): boolean {
  const c2 = cpFind(cid);
  if (!c2 || c2.status !== 'active') return false;
  const fb = lastBar(c2.nick);
  if (fb == null) return false;
  if (c2.winding) {
    cpClose(cid); /* 정산은 cpClose 한 곳에서 */
    return false;
  }
  /* 정리한 봉을 차례로 남긴다 */
  patchCopy(cid, (c) => {
    const flats = c.flats ? c.flats.slice() : c.flatI != null ? [c.flatI] : [];
    if (flats.indexOf(fb) < 0) flats.push(fb);
    return { ...c, flats, flatI: fb };
  });
  toast('포지션을 정리했습니다. 다음 진입부터 다시 따라갑니다');
  return true;
}

/** mkStopGo(cid,mode): 복사 중단 세 갈래 (지금 정리 / 원본 청산 대기 / 직접 관리). 화면에 남으면 true */
export function mkStopGo(cid: string, mode: string): boolean {
  const c0 = cpFind(cid);
  if (!c0 || c0.status !== 'active') return false;
  const stopMode = MK_STOP_L[mode] ? mode : 'now';
  const d = cpCalc({ ...c0, stopMode });
  if (stopMode === 'now' || !d.posOpen || d.missing) {
    patchCopy(cid, (c) => ({ ...c, stopMode }));
    cpClose(cid);
    return false;
  }
  const stopI = lastBar(c0.nick);
  patchCopy(cid, (c) => ({ ...c, stopMode, winding: true, windAt: Date.now(), ...(stopI != null ? { stopI } : {}) }));
  toast('새 진입을 멈췄습니다. 열린 포지션은 ' + (stopMode === 'wait' ? '원본 전략이 청산할 때 함께 정리합니다' : '내가 정리할 때까지 남아 있습니다'));
  return true;
}

/** mkWindCheck(): 원본 청산을 기다리던 복사는 포지션이 끝났으면 정산한다. 목록(tfShareHub)에 들어올 때 부른다 */
export function mkWindCheck() {
  getShare().cp.copies.forEach((c) => {
    if (c.status === 'active' && c.winding && c.stopMode === 'wait') {
      const d = cpCalc(c);
      if (!d.missing && !d.posOpen) cpClose(c.id, true);
    }
  });
}
