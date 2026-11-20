// 홈 템플릿 갤러리의 규칙: 여러 개 고르기(최대 10)와 고른 것으로 문장 만들기.
import { TF_TPL_ACTS, TF_TPL_ASSETS, type TplAct, type TplAsset } from './templates.data';

export const TPL_MAX = 10;
export type TplKind = 'acts' | 'assets';
export type TplSel = { acts: string[]; assets: string[] };
export const EMPTY_SEL: TplSel = { acts: [], assets: [] };

const last = (w: string) => w.charCodeAt(w.length - 1);
const hasBatchim = (w: string) => {
  const c = last(w);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
};
export const josa = (w: string) => (hasBatchim(w) ? '을' : '를');
export const waGwa = (w: string) => (hasBatchim(w) ? '과' : '와');

export function tplOf(kind: 'acts', id: string): TplAct | null;
export function tplOf(kind: 'assets', id: string): TplAsset | null;
export function tplOf(kind: TplKind, id: string): TplAct | TplAsset | null {
  return (kind === 'acts' ? TF_TPL_ACTS : TF_TPL_ASSETS).find((x) => x.id === id) || null;
}

/** 고른 템플릿으로 입력창 안내문(q)과 보낼 명령(cmd)을 만든다. 고른 것이 없으면 null. */
export function tplText(sel: TplSel): { q: string; cmd: string } | null {
  const acts = sel.acts.map((id) => tplOf('acts', id)).filter((x): x is TplAct => !!x);
  const assets = sel.assets.map((id) => tplOf('assets', id)).filter((x): x is TplAsset => !!x);
  if (!acts.length && !assets.length) return null;
  const lbs = assets.map((x) => x.lb);
  const A = lbs.length ? (lbs.length === 1 ? lbs[0] : lbs.slice(0, -1).join(', ') + waGwa(lbs[lbs.length - 2]) + ' ' + lbs[lbs.length - 1]) : '';
  const fill = (t: string) => t.replace('{A}{obj}', A ? A + josa(A) : '').replace('{A}', A);
  const ender = (st: string) => (st.charAt(st.length - 1) === '주' ? st.slice(0, -1) + '줘' : st + '어줘');
  let q: string;
  let cmd: string;
  if (!acts.length) {
    q = lbs.length === 1 ? A + '에 대해 무엇이 궁금하십니까?' : A + ', 무엇이 궁금하십니까?';
    cmd = lbs.length === 1 ? A + ' 지금 어떤 상황인지 분석해줘' : A + ' 지금 상황을 비교 분석해줘';
  } else if (acts.length === 1) {
    q = A ? fill(acts[0].q) : acts[0].q0;
    cmd = ender(A ? fill(acts[0].frag) : acts[0].frag0);
  } else {
    const actLbs = acts.map((x) => x.lb).join(', ');
    q = A ? A + '로 ' + actLbs + '까지 한 번에 해드리면 되겠습니까?' : actLbs + ', 어떤 종목으로 해보겠습니까?';
    const stems = [A ? fill(acts[0].frag) : acts[0].frag0];
    for (let i = 1; i < acts.length; i++) stems.push(acts[i].more);
    cmd = stems.slice(0, -1).map((s) => s + '고').join(', ') + ', ' + ender(stems[stems.length - 1]);
  }
  return { q, cmd };
}

/** 카드 하나 고르기와 풀기. 최대 개수를 넘으면 'max' 를 돌려준다. */
export function tplToggle(sel: TplSel, kind: TplKind, id: string): TplSel | 'max' {
  const arr = sel[kind];
  if (arr.includes(id)) return { ...sel, [kind]: arr.filter((x) => x !== id) };
  if (sel.acts.length + sel.assets.length >= TPL_MAX) return 'max';
  return { ...sel, [kind]: [...arr, id] };
}
