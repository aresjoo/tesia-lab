// 판단 기록 (원본 mkChatHtml, mkChatRow, mkChatBody, mkChatMore): 지금 상태, 최근 판단, 전략 개요를 대화 줄로 보여 준다.
// 원본이 그린 뒤 글자를 고치는 층(skdApply, skdDedupe)까지 여기서 한 번에 낸다.
import { useMemo, useState, type ReactNode } from 'react';
import { mkChatMsgs, mkChatOut, mkChatTitle, mkTS, type ChatMsg } from '../../core/engine/chat';
import type { Strat } from '../../core/engine/types';
import { GlossBtn, mkGloss } from './Gloss';
import { SKD_RULE, skdBody, skdLabel } from './skd';

/** 본문 한 줄의 마디: 글자, 용어 단추, 색 입힌 손익률. 원본 DOM 의 글자 마디와 같은 단위다 */
type Node = { t: 'txt'; v: string } | { t: 'g'; k: string; v: string } | { t: 'pct'; up: boolean; v: string };
const txtOf = (ns: Node[]) => ns.map((n) => n.v).join('');

/** mkChatBody(t) 의 한 토막: 용어를 단추로, +1.2% 같은 값을 색 글자로 */
function tokens(parts: ReturnType<typeof mkGloss>): Node[] {
  const out: Node[] = [];
  parts.forEach((p) => {
    if (p.g) {
      out.push({ t: 'g', k: p.v, v: p.v });
      return;
    }
    p.v.split(/([+-]\d[\d,]*(?:\.\d+)?%)/).forEach((x, i) => {
      if (!x) return;
      if (i % 2) out.push({ t: 'pct', up: x.charAt(0) === '+', v: x });
      else out.push({ t: 'txt', v: x });
    });
  });
  return out;
}
/** 글자 마디가 붙어 있으면 하나로 (HTML 을 읽으면 그렇게 된다) */
function merge(ns: Node[]): Node[] {
  const out: Node[] = [];
  ns.forEach((n) => {
    const p = out[out.length - 1];
    if (n.t === 'txt' && p && p.t === 'txt') p.v += n.v;
    else out.push({ ...n });
  });
  return out;
}

/** mkChatBody(t) + skdApply + skdDedupe: 첫 문장은 굵게, 나머지는 이어서 */
function chatBody(t: string, dedupe: boolean): { head: Node[] | null; rest: Node[] } {
  const j = t.search(/[.!?]\s/);
  const headT = j > 0 ? t.slice(0, j + 1) : t;
  const restT = j > 0 ? t.slice(j + 2) : '';
  /* 용어는 첫 문장과 나머지를 통틀어 한 번씩만 단추가 된다 */
  const g = mkGloss(headT + '\u0003' + restT, true);
  const cut = g.findIndex((p) => !p.g && p.v.indexOf('\u0003') >= 0);
  const sep = g[cut] as { g: false; v: string };
  const k = sep.v.indexOf('\u0003');
  const gh = g.slice(0, cut).concat(sep.v.slice(0, k) ? [{ g: false, v: sep.v.slice(0, k) }] : []);
  const gr = (sep.v.slice(k + 1) ? [{ g: false, v: sep.v.slice(k + 1) } as (typeof g)[number]] : []).concat(g.slice(cut + 1));
  let head: Node[] | null = tokens(gh);
  let rest: Node[] = gr.length ? merge([{ t: 'txt', v: ' ' } as Node].concat(tokens(gr))) : [];
  /* skdApply: 글자 마디마다 */
  const fix = (ns: Node[]) => ns.forEach((n) => (n.v = skdBody(n.v)));
  fix(head);
  fix(rest);
  if (dedupe) {
    /* skdDedupe: 글자 마디를 문장 끝(다. )에서 쪼갠 뒤 문장별로 묶고, 규칙 설명 문장은 지운다 */
    const split: Node[] = [];
    rest.forEach((n) => {
      if (n.t !== 'txt') {
        split.push(n);
        return;
      }
      let cur = n.v;
      let i: number;
      while ((i = cur.search(/다\. ?/)) >= 0 && i + 2 < cur.length) {
        const c = i + 2 + (cur.charAt(i + 2) === ' ' ? 1 : 0);
        if (c >= cur.length) break;
        split.push({ t: 'txt', v: cur.slice(0, c) });
        cur = cur.slice(c);
      }
      split.push({ t: 'txt', v: cur });
    });
    /* 굵은 첫 문장은 통째로 한 마디다 */
    type Item = { strong: true; v: string } | { strong: false; n: Node; v: string };
    const items: Item[] = [{ strong: true, v: txtOf(head) } as Item].concat(split.map((n) => ({ strong: false, n, v: n.v })));
    const groups: Item[][] = [];
    let sent: Item[] = [];
    items.forEach((it) => {
      sent.push(it);
      if (/다\. ?$/.test(it.v)) {
        groups.push(sent);
        sent = [];
      }
    });
    if (sent.length) groups.push(sent);
    const keep: Node[] = [];
    groups.forEach((gp) => {
      const gone = SKD_RULE.test(gp.map((it) => it.v).join(''));
      gp.forEach((it) => {
        if (it.strong) {
          if (gone) head = null;
        } else if (!gone) keep.push(it.n);
      });
    });
    rest = keep;
    /* 쪼갠 뒤에도 원본은 다시 훑는다 */
    if (head) fix(head);
    fix(rest);
  }
  return { head, rest };
}

function nodes(ns: Node[]): ReactNode[] {
  return ns.map((n, i) =>
    n.t === 'txt' ? (
      n.v
    ) : n.t === 'g' ? (
      <GlossBtn key={i} k={n.k}>
        {n.v}
      </GlossBtn>
    ) : (
      <i key={i} className={n.up ? 'up' : 'dn'}>
        {n.v}
      </i>
    ),
  );
}

/** MKC_IC: 줄 종류마다의 그림 */
const MKC_IC: Record<string, ReactNode> = {
  buy: <path d="M12 19V6M6.5 11.5L12 6l5.5 5.5" />,
  sell: <path d="M12 5v13M6.5 12.500L12 18l5.500-5.500" />,
  now: (
    <>
      <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="8" />
    </>
  ),
  wait: <path d="M9 6v12M15 6v12" />,
  hold: <path d="M6 12h12" />,
  pick: <path d="M5 12.500l4.500 4.500L19 7.500" />,
  intro: <path d="M6 5h12v14H6zM9 9h6M9 13h6" />,
};

/** mkChatRow(s,m,first) */
function Row({ s, m, first }: { s: Strat; m: ChatMsg; first: boolean }) {
  const title = skdLabel(mkChatTitle(m));
  /* 현재 포지션과 전략 개요는 규칙을 설명하는 자리라 문장을 지우지 않는다 */
  const plain = m.k === 'now' || /전략 개요|현재 포지션/.test(title.trim());
  const body = chatBody(m.t, !plain);
  const out = mkChatOut(m);
  /* 판단 기록의 시각은 신호 시각이다. 체결은 다음 날 시가라 거래 내역 날짜와 하루 다를 수 있어 구분한다 */
  let ts = skdBody(m.ts);
  if (!plain && /진입|청산/.test(title.trim())) {
    const mt = ts.trim().match(/^(\d{2})\/(\d{2}) (\d{2}:\d{2})/);
    if (mt) ts = '신호 ' + +mt[1] + '. ' + +mt[2] + '. ' + mt[3] + ', 다음 날 시가 체결';
  }
  return (
    <li className={'mkc-m v2 k-' + m.k + (first ? ' first' : '')}>
      <div className="mkc-ic" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {MKC_IC[m.k] || MKC_IC.wait}
        </svg>
      </div>
      <div className="mkc-b">
        <div className="mkc-h">
          <b>{title}</b>
          {out ? <i className={'mkc-out num ' + (out.charAt(0) === '+' ? 'up' : 'dn')}>{skdBody(out)}</i> : null}
          <time className="num">{ts}</time>
        </div>
        <div className="mkc-t">
          <p>
            {body.head ? <strong>{nodes(body.head)}</strong> : null}
            {nodes(body.rest)}
          </p>
        </div>
        {m.cnt ? <p className="mkc-n num">{skdBody('같은 판단 ' + m.cnt + '회 연속, ' + mkTS(s, m.from as number, null, 3).replace(/ .*$/, '') + '부터')}</p> : null}
      </div>
    </li>
  );
}

/** mkChatHtml(s,r,ne,pd): 판단 기록 구역. 기록은 고른 기간과 상관없이 전체 기간의 것이다 */
export function ChatLog({ s }: { s: Strat; pd: string }) {
  const ms = useMemo(() => mkChatMsgs(s, s.r, 6), [s]);
  const [all, setAll] = useState(false);
  if (!ms.length) return null;
  return (
    <section className="mk3-sec mkc">
      <div className="mk3-sec-h">
        <h3>판단 기록</h3>
      </div>
      <ol className={'mkc-list' + (all ? ' all' : '')}>
        {ms.map((m, i) => (
          <Row key={m.k + m.i + (m.a || '') + i} s={s} m={m} first={i === 0} />
        ))}
      </ol>
      {/* mkChatMore(b) */}
      {ms.length > 3 && !all ? (
        <button type="button" className="mkc-more" onClick={() => setAll(true)}>
          {skdBody('이전 기록 ' + (ms.length - 3) + '건 더 보기')}
        </button>
      ) : null}
    </section>
  );
}
