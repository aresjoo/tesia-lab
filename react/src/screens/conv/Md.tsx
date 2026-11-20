// 답변 본문 그리기 (원본 taiMd 가 만들던 HTML 과 같은 짜임).
import { memo, useMemo, useState } from 'react';
import { taiMd, type Block, type Inline } from '../../core/tai/md';
import { toast } from '../../state/store';

function Inl({ c }: { c: Inline[] }) {
  return (
    <>
      {c.map((n, i) => {
        if (typeof n === 'string') return n;
        if (n.t === 'a')
          return (
            <a key={i} href={n.href} target="_blank" rel="noopener noreferrer">
              <Inl c={n.c} />
            </a>
          );
        if (n.t === 'b')
          return (
            <b key={i}>
              <Inl c={n.c} />
            </b>
          );
        return (
          <code key={i}>
            <Inl c={n.c} />
          </code>
        );
      })}
    </>
  );
}

/** taiCodeCopy(b) */
function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [ok, setOk] = useState(false);
  const copy = () => {
    try {
      navigator.clipboard.writeText(code).catch(() => {});
    } catch {
      /* 무시 */
    }
    setOk(true);
    setTimeout(() => setOk(false), 1500);
    toast('복사 완료');
  };
  return (
    <div className="codeblk">
      <div className="ch">
        <span>{lang}</span>
        <button onClick={copy} aria-label="코드 복사">
          {ok ? '✓ 복사됨' : '복사'}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Blk({ b }: { b: Block }) {
  switch (b.t) {
    case 'p':
      return (
        <p>
          <Inl c={b.c} />
        </p>
      );
    case 'h4':
      return (
        <h4>
          <Inl c={b.c} />
        </h4>
      );
    case 'quote':
      return (
        <blockquote>
          <Inl c={b.c} />
        </blockquote>
      );
    case 'sp8':
      return <div className="sp8" />;
    case 'ul':
      return (
        <ul className={b.n ? 'nl' : undefined}>
          {b.items.map((it, i) => (
            <li key={i}>
              {it.no && <em className="no">{it.no}</em>}
              <Inl c={it.c} />
            </li>
          ))}
        </ul>
      );
    case 'table':
      return (
        <div className="tblwrap">
          <table>
            <tbody>
              <tr>
                {b.head.map((c, i) => (
                  <th key={i}>
                    <Inl c={c} />
                  </th>
                ))}
              </tr>
              {b.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, k) => (
                    <td key={k}>
                      <Inl c={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'code':
      return <CodeBlock lang={b.lang} code={b.code} />;
  }
}

/** 마크다운 원문 하나를 그린다. 원문이 같으면 다시 풀지 않는다(받는 중에는 확정된 줄이 바뀔 때만 다시 푼다). */
export const Md = memo(function Md({ src }: { src: string }) {
  const blocks = useMemo(() => taiMd(src), [src]);
  return (
    <>
      {blocks.map((b, i) => (
        <Blk key={i} b={b} />
      ))}
    </>
  );
});
