// 답변 글 끝에 AI 가 붙이는 태그([CHART {...}], [ASK {...}], [NEXT [...]], [TITLE "..."] 등)를 읽고 떼어 낸다.
import type { Act, AskCfg, Gauge, TlineIn } from './types';

/** taiTagJson(src,tag): [TAG {…}] 를 중괄호 짝으로 잘라 온다 */
export function taiTagJson(src: string, tag: string): { raw: string; json: string } | null {
  const i = src.indexOf('[' + tag);
  if (i < 0) return null;
  const j = src.indexOf('{', i);
  if (j < 0) return null;
  let d = 0;
  let k = j;
  let inStr = false;
  let esc = false;
  for (; k < src.length; k++) {
    const ch = src[k];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === '\\') {
      esc = true;
      continue;
    }
    if (ch === '"') inStr = !inStr;
    else if (!inStr) {
      if (ch === '{') d++;
      else if (ch === '}') {
        d--;
        if (!d) break;
      }
    }
  }
  if (d) return null;
  const close = src.indexOf(']', k + 1);
  return { raw: src.slice(i, close >= 0 ? close + 1 : k + 1), json: src.slice(j, k + 1) };
}

/** taiMarket 의 stripTags: 화면에 보일 글에서 태그를 모두 뗀다 */
export function stripTags(s: string): string {
  const a = taiTagJson(s, 'ASK');
  if (a) s = s.split(a.raw).join('');
  return s
    .replace(/\[(?:CHART|SETUP|STRATEGY|GAUGE|ORDER)\s+\{[\s\S]*?\}\s*\]/g, '')
    .replace(/\[(?:NEXT|ACT|TLINE)\s+\[[\s\S]*?\]\s*\]/g, '')
    .replace(/\[TITLE\s+"[^"\n]*"\s*\]/g, '')
    .trim();
}

const TAG_HEAD = /\[(?:CHART|SETUP|STRATEGY|NEXT|ASK|TITLE|GAUGE|ACT|TLINE|ORDER)/;
/** 태그가 시작되기 전까지의 글 (끊긴 답변을 마무리할 때) */
export const beforeTags = (s: string) => s.split(TAG_HEAD)[0].trim();

/** 받는 중인 글을 확정된 줄들(head)과 지금 쓰는 줄(tail)로 나눈다. 쓰는 줄이 머리글이면 h4 에 그 글 */
export function streamView(segAcc: string): { head: string; tail: string; h4: string | null } {
  const vis = segAcc.split(TAG_HEAD)[0].replace(/\[[A-Z]{0,6}$/, '');
  const cut = vis.lastIndexOf('\n');
  const head = cut >= 0 ? vis.slice(0, cut) : '';
  const tail = cut >= 0 ? vis.slice(cut + 1) : vis;
  const mH = tail.match(/^#{2,4}\s+(.*)$/);
  return { head, tail, h4: mH ? mH[1] : null };
}

export type ChartTag = { tv?: string; data?: string; label?: string };
export type SetupTag = { entryMode?: string | null; pair?: string | null };
export type Tags = {
  info: ChartTag | null;
  setup: SetupTag | null;
  spec: unknown;
  order: unknown;
  ask: AskCfg | null;
  nexts: string[] | null;
  gauge: Gauge | null;
  acts: Act[] | null;
  tline: TlineIn[] | null;
  title: string | null;
};
function json<T>(s: string | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}
/** 다 받은 답변에서 태그를 읽는다 (taiMarket 의 완료 콜백 앞부분) */
export function parseTags(acc: string): Tags {
  const info = json<ChartTag>(acc.match(/\[CHART\s+(\{[\s\S]*?\})\s*\]/)?.[1]);
  const mS = acc.match(/\[SETUP\s+(\{[\s\S]*?\})\s*\]/);
  let setup: SetupTag | null = mS ? json<SetupTag>(mS[1]) || {} : null;
  let spec = json<unknown>(acc.match(/\[STRATEGY\s+(\{[\s\S]*?\})\s*\]/)?.[1]);
  if (spec) setup = null;
  const order = json<unknown>(acc.match(/\[ORDER\s+(\{[\s\S]*?\})\s*\]/)?.[1]);
  if (order) {
    setup = null;
    spec = null;
  }
  const a = taiTagJson(acc, 'ASK');
  return {
    info,
    setup,
    spec,
    order,
    ask: a ? json<AskCfg>(a.json) : null,
    nexts: json<string[]>(acc.match(/\[NEXT\s+(\[[\s\S]*?\])\s*\]/)?.[1]),
    gauge: json<Gauge>(acc.match(/\[GAUGE\s+(\{[\s\S]*?\})\s*\]/)?.[1]),
    acts: json<Act[]>(acc.match(/\[ACT\s+(\[[\s\S]*?\])\s*\]/)?.[1]),
    tline: json<TlineIn[]>(acc.match(/\[TLINE\s+(\[[\s\S]*?\])\s*\]/)?.[1]),
    title: acc.match(/\[TITLE\s+"([^"\n]{1,40})"\s*\]/)?.[1] ?? null,
  };
}

/** 스트림 한 줄("data: {...}")을 이벤트로. 형식이 아니면 null */
export type StreamEv = {
  text?: string;
  think?: string;
  tok?: number;
  tool?: { name: string; q?: string; id?: string };
  sres?: { n: number; results?: { t: string; u: string }[]; error?: boolean };
  fres?: { u?: string; error?: unknown };
  tres?: { error?: boolean };
  mres?: { id: string; ok?: boolean; meta?: { iv?: string; n?: number; src?: string }; cached?: boolean; code?: unknown };
  done?: boolean;
  usage?: { in: number; out: number };
  error?: unknown;
};
export function parseSseLine(line: string): StreamEv | null {
  if (line.indexOf('data: ') !== 0) return null;
  try {
    return JSON.parse(line.slice(6)) as StreamEv;
  } catch {
    return null;
  }
}
