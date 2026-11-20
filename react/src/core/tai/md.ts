// 작은 마크다운 해석기 (원본 taiMd). 원본은 HTML 문자열을 만들었고, 여기서는 같은 짜임의 나무를 만든다.
// 지원: ### 머리글, **굵게**, `코드`, [글](주소), 목록, 번호 목록, | 표 |, > 인용, ``` 코드 덩이.

export type Inline = string | { t: 'a'; href: string; c: Inline[] } | { t: 'b'; c: Inline[] } | { t: 'code'; c: Inline[] };
export type Block =
  | { t: 'p'; c: Inline[] }
  | { t: 'h4'; c: Inline[] }
  | { t: 'quote'; c: Inline[] }
  | { t: 'sp8' }
  | { t: 'ul'; n: boolean; items: { no?: string; c: Inline[] }[] }
  | { t: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { t: 'code'; lang: string; code: string };

/* 원본은 링크 > 굵게 > 코드 순서로 문자열을 바꿨다. 같은 순서를 지키려고 바꾼 자리를 표식 글자로 잠깐 치워 둔다. */
const P0 = '';
const P1 = '';
/** inl(s) */
export function mdInline(src: string): Inline[] {
  const nodes: Inline[] = [];
  const hold = (n: Inline) => P0 + (nodes.push(n) - 1) + P1;
  const expand = (s: string): Inline[] => {
    const out: Inline[] = [];
    const re = new RegExp(P0 + '(\\d+)' + P1, 'g');
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push(s.slice(last, m.index));
      out.push(nodes[+m[1]]);
      last = m.index + m[0].length;
    }
    if (last < s.length) out.push(s.slice(last));
    return out;
  };
  let s = src.replace(/\[([^\]]{1,80})\]\((https?:[^)\s]{1,300})\)/g, (_, label: string, href: string) => hold({ t: 'a', href, c: [label] }));
  s = s.replace(/\*\*([^*]+)\*\*/g, (_, body: string) => hold({ t: 'b', c: expand(body) }));
  s = s.replace(/`([^`]+)`/g, (_, body: string) => hold({ t: 'code', c: expand(body) }));
  /* 링크 글 안의 굵게와 코드는 원본에서도 뒤 단계가 처리한다 */
  for (const n of nodes) {
    if (typeof n !== 'string' && n.t === 'a' && typeof n.c[0] === 'string') {
      let lb = n.c[0];
      lb = lb.replace(/\*\*([^*]+)\*\*/g, (_, body: string) => hold({ t: 'b', c: [body] }));
      lb = lb.replace(/`([^`]+)`/g, (_, body: string) => hold({ t: 'code', c: [body] }));
      n.c = expand(lb);
    }
  }
  return expand(s);
}

/** tblHtml(rows) */
function mdTable(rows: string[]): Block | null {
  let cells = rows.map((r) =>
    r
      .replace(/^\s*\||\|\s*$/g, '')
      .split('|')
      .map((c) => c.trim()),
  );
  cells = cells.filter((cs) => !cs.every((c) => /^:?-{2,}:?$/.test(c) || c === ''));
  if (!cells.length) return null;
  return { t: 'table', head: cells[0].map(mdInline), rows: cells.slice(1).map((r) => r.map(mdInline)) };
}

/** taiMdCore(part) */
function mdCore(part: string): Block[] {
  const lines = part.split('\n');
  const out: Block[] = [];
  let ul: Extract<Block, { t: 'ul' }> | null = null;
  let tbl: string[] = [];
  const endUl = () => {
    ul = null;
  };
  const openUl = (n: boolean) => {
    if (!ul || ul.n !== n) {
      ul = { t: 'ul', n, items: [] };
      out.push(ul);
    }
    return ul;
  };
  const endTbl = () => {
    if (tbl.length) {
      const t = mdTable(tbl);
      if (t) out.push(t);
      tbl = [];
    }
  };
  for (const L of lines) {
    if (/^\s*\|.+\|\s*$/.test(L)) {
      endUl();
      tbl.push(L);
      continue;
    }
    endTbl();
    if (/^#{2,4}\s+/.test(L)) {
      endUl();
      out.push({ t: 'h4', c: mdInline(L.replace(/^#{2,4}\s+/, '')) });
      continue;
    }
    if (/^>\s?/.test(L)) {
      endUl();
      out.push({ t: 'quote', c: mdInline(L.replace(/^>\s?/, '')) });
      continue;
    }
    if (/^\s*[-*•]\s+/.test(L)) {
      openUl(false).items.push({ c: mdInline(L.replace(/^\s*[-*•]\s+/, '')) });
      continue;
    }
    const m = L.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (m) {
      openUl(true).items.push({ no: m[1] + '.', c: mdInline(m[2]) });
      continue;
    }
    endUl();
    if (!L.trim()) {
      out.push({ t: 'sp8' });
      continue;
    }
    out.push({ t: 'p', c: mdInline(L) });
  }
  endTbl();
  return out;
}

/** taiMd(src) */
export function taiMd(src: string): Block[] {
  const segs = String(src).split('```');
  if (segs.length <= 1) return mdCore(src);
  const out: Block[] = [];
  segs.forEach((body, i) => {
    if (i % 2 === 1) {
      const nl = body.indexOf('\n');
      let lang = '';
      let code = body;
      if (nl >= 0 && nl < 24 && /^[a-zA-Z0-9+#._-]*$/.test(body.slice(0, nl).trim())) {
        lang = body.slice(0, nl).trim();
        code = body.slice(nl + 1);
      }
      out.push({ t: 'code', lang: lang || 'code', code: code.replace(/\n+$/, '') });
    } else out.push(...mdCore(body));
  });
  return out;
}

/** 나무에서 글자만 (복사, 검색용) */
export function inlineText(c: Inline[]): string {
  return c.map((n) => (typeof n === 'string' ? n : inlineText(n.c))).join('');
}
export function mdText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if (b.t === 'sp8') return '';
      if (b.t === 'code') return b.lang + '복사' + b.code;
      if (b.t === 'ul') return b.items.map((i) => (i.no || '') + inlineText(i.c)).join('');
      if (b.t === 'table') return [b.head, ...b.rows].map((r) => r.map(inlineText).join('')).join('');
      return inlineText(b.c);
    })
    .join('');
}
