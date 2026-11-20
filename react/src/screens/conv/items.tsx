// 대화 줄에 놓이는 것들. 원본이 gThreadAdd 로 붙이던 HTML 과 같은 짜임이다.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Act, Item, Session, TlineItem } from '../../core/tai/types';
import { chipFree, chipGo, chipPick, chipSkip, cardClose, nextAsk, taiActDo, taiErrRetry, taiFbEtc, taiFbPick, taiUEdit, taiVote, tfResume, tfVerifyGo } from '../../state/tai';
import { getState, toast } from '../../state/store';
import { Act2, LogoDraw } from './Act2';
import { ChartCard } from './ChartCard';
import { Md } from './Md';

type Of<K extends Item['k']> = Extract<Item, { k: K }>;
const Svg = ({ size, sw = 1.8, children, style }: { size: number; sw?: number; children: ReactNode; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {children}
  </svg>
);
const PencilPath = <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />;
const CopyPath = (
  <>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </>
);
const ThumbPath = (
  <>
    <path d="M14 9V5a2 2 0 0 0-2-2l-3 7v10h8.3a2 2 0 0 0 2-1.7l1-6A2 2 0 0 0 18.3 10H14z" />
    <path d="M9 20H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h3" />
  </>
);
/** TAI_CHECK */
const TaiCheck = (
  <Svg size={14}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.2l2.4 2.4 4.6-5" />
  </Svg>
);
const Arrow = <span className="ar">→</span>;

/** gConvUser(t) */
function UserRow({ it }: { it: Of<'user'> }) {
  /** taiUCopy(b) */
  const copy = () => {
    try {
      navigator.clipboard.writeText(it.text).catch(() => {});
    } catch {
      /* 무시 */
    }
    toast('복사 완료');
  };
  return (
    <div className="g-urow">
      <span className="g-uacts">
        <button onClick={() => taiUEdit(it.text)} aria-label="수정">
          <Svg size={13}>{PencilPath}</Svg>
        </button>
        <button onClick={copy} aria-label="복사">
          <Svg size={13}>{CopyPath}</Svg>
        </button>
      </span>
      <div className="g-umsg">{it.text}</div>
    </div>
  );
}

/** taiGauge(g) 와 taiGaugeGo(host): 새로 붙을 때는 50 대 50 에서 실제 값으로 차오른다 */
function Gauge({ g }: { g: NonNullable<Of<'ai'>['gauge']> }) {
  const [w, setW] = useState(g.anim ? 50 : g.up);
  const [n, setN] = useState(g.anim ? 50 : g.up);
  useEffect(() => {
    if (!g.anim) return;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        setW(g.up);
        const t0 = performance.now();
        const tick = () => {
          let k = Math.min(1, (performance.now() - t0) / 600);
          k = k * (2 - k);
          setN(Math.round(50 + (g.up - 50) * k));
          if (k < 1) raf = requestAnimationFrame(tick);
        };
        tick();
      });
    });
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="g-gauge">
      <div className="t">
        <b>{g.label}</b>
        <span>{'방향 감각' + (g.symbol ? ', ' + g.symbol : '') + ', 지표 기반 추정, 검증된 확률 아님'}</span>
      </div>
      <div className="bar">
        <span className="u" style={{ width: w + '%' }} />
        <span className="d" style={{ width: 100 - w + '%' }} />
      </div>
      <div className="lg">
        <span className="u">
          상승 <em className="n">{n}</em>%
        </span>
        <span className="d">
          하락 <em className="n">{100 - n}</em>%
        </span>
      </div>
    </div>
  );
}
/** taiTline(list) */
function Tline({ items }: { items: TlineItem[] }) {
  return (
    <div className="g-evtl">
      <div className="tl-hd">
        <span>주요 사건과 당시 시세 흐름</span>
        <span className="tl-note">실측 일봉 기준</span>
      </div>
      {items.map((it, i) => {
        const dir = it.chg == null ? '' : it.chg >= 0 ? 'up' : 'dn';
        return (
          <div className={'tl-node ' + dir} key={i}>
            <span className="tl-spine">
              <i className="tl-dot" />
              <i className="tl-line" />
            </span>
            <div className="tl-body">
              <div className="tl-meta">
                <span className="tl-date">
                  {it.d.slice(5).replace('-', '.')}
                  {it.mapped && (
                    <>
                      {' '}
                      <em className="tl-map">{it.mapped} 거래일 반영</em>
                    </>
                  )}
                </span>
                {it.chg != null && (
                  <span className={'tl-px ' + dir}>
                    {it.px != null ? String(it.px) : ''} <em>{(it.chg >= 0 ? '+' : '') + it.chg + '%'}</em>
                  </span>
                )}
              </div>
              <div className="tl-title">{it.t}</div>
              {it.src && <div className="tl-src">{it.src}</div>}
            </div>
          </div>
        );
      })}
      <div className="tl-dis">사건 발생 시점과 당시 일봉의 선후 관계를 정리한 것이며, 사건이 등락의 유일하거나 직접적인 원인임을 뜻하지 않습니다. 등락은 직전 거래일 종가 대비.</div>
    </div>
  );
}

/** 답변 말풍선 (gConvAI 의 짧은 글, taiMarket 의 본문) */
function AiMsg({ it }: { it: Of<'ai'> }) {
  const txt = useRef<HTMLSpanElement>(null);
  const [copied, setCopied] = useState(false);
  if (it.plain != null) return <div className="g-amsg">{it.plain}</div>;
  /** taiCopy(b): 복사가 실제로 된 뒤에만 됐다고 알린다 */
  const copy = () => {
    const ok = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast('복사 완료');
    };
    try {
      navigator.clipboard.writeText(txt.current ? txt.current.textContent || '' : '').then(ok, () => toast('복사 권한을 확인해주십시오'));
    } catch {
      toast('복사 권한을 확인해주십시오');
    }
  };
  const live = it.live;
  const g = it.gauge || null;
  return (
    <div className="g-amsg">
      {g && g.top && <Gauge g={g} />}
      <span className="tai-txt" ref={txt}>
        {live ? (
          <>
            <span className="md-done">{live.head ? <Md src={live.head} /> : null}</span>
            <span className="md-live">
              {live.h4 != null ? (
                <h4>
                  {live.h4}
                  <span className="tcur" />
                </h4>
              ) : (
                <p>
                  {live.tail}
                  <span className="tcur" />
                </p>
              )}
            </span>
          </>
        ) : it.fresh ? (
          <>
            <span className="md-done" />
            <span className="md-live" />
          </>
        ) : (
          <Md src={it.md || ''} />
        )}
      </span>
      {g && !g.top && <Gauge g={g} />}
      {it.tline && <Tline items={it.tline} />}
      {it.src && <div className="g-srcstrip">{'근거: 웹 검색 ' + it.src.n + '회, 결과 ' + it.src.all + '개, 원문 ' + it.src.ok + '개 확인. 상세와 링크는 위 작업 기록에서'}</div>}
      {it.acts && (
        <div className="g-acts">
          <button aria-label="좋습니다" className={it.vote === 1 ? 'on' : undefined} onClick={() => taiVote(it.id, 1)}>
            <Svg size={15}>{ThumbPath}</Svg>
          </button>
          <button aria-label="별로입니다" className={it.vote === -1 ? 'on' : undefined} onClick={() => taiVote(it.id, -1)}>
            <Svg size={15} style={{ transform: 'rotate(180deg)' }}>
              {ThumbPath}
            </Svg>
          </button>
          <button aria-label="복사" className={copied ? 'on' : undefined} onClick={copy}>
            {copied ? (
              <Svg size={15} sw={2}>
                <path d="M4.5 12.5l5 5 10-11" />
              </Svg>
            ) : (
              <Svg size={15}>{CopyPath}</Svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/** TAI_ACT_IC */
const ACT_IC: Record<string, ReactNode> = {
  alert: (
    <Svg size={15}>
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </Svg>
  ),
  backtest: (
    <Svg size={15}>
      <path d="M3 20h18M6 16l4-6 3 3 5-8" />
    </Svg>
  ),
  delegate_trade: (
    <Svg size={15}>
      <path d="M4 12h10M10 6l6 6-6 6" />
      <path d="M20 5v14" />
    </Svg>
  ),
  auto_trade: (
    <Svg size={15}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
    </Svg>
  ),
};
/** taiNext(items,acts) */
function NextCol({ it }: { it: Of<'next'> }) {
  const hasAct = it.rows.some((r) => r.t === 'a');
  const badge = it.badge;
  return (
    <div className="g-nextcol" id={it.id}>
      {it.rows.map((r, i) =>
        r.t === 'a' ? (
          <button className="g-acbtn" data-a={i} disabled={!!r.saved} onClick={() => taiActDo(it.id, i)} key={i}>
            <span className="lf">
              {ACT_IC[(r.a as Act).type]}
              <span className="tx">{r.saved ? '조건 저장됨 ✓' : r.a.label}</span>
            </span>
            <span className="rt">
              {badge && <span className="bdg">바로 실행</span>}
              {Arrow}
            </span>
          </button>
        ) : (
          <button className="g-nextq" onClick={() => nextAsk(r.q)} key={i}>
            <span>{r.q}</span>
            {Arrow}
          </button>
        ),
      )}
      {hasAct && <div className="g-actnote">모두 무료입니다.</div>}
    </div>
  );
}

/** taiFeedback(), taiFbEtc(id) */
function FbCard({ it }: { it: Of<'fb'> }) {
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (it.etc) ta.current?.focus();
  }, [it.etc]);
  const opts = ['사실과 다름', '요청 사항을 따르지 않음', '내용이 도움이 되지 않음', '오래되거나 부정확한 정보', '안전하지 않거나 부적절함'];
  return (
    <div className="g-askcard" id={it.id}>
      <div className="hd">
        <span className="t">무엇이 문제였습니까?</span>
        <span className="x" onClick={() => cardClose(it.id)}>
          ×
        </span>
      </div>
      <div style={{ fontSize: '12.5px', color: 'var(--gt3)' }}>제공해 주시는 의견은 TETH를 모두에게 더 유용하도록 개선하는 데 도움이 됩니다.</div>
      {it.etc ? (
        <div className="fbp" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <textarea className="fbt" placeholder="어떤 점이 문제였는지 알려주십시오" rows={3} ref={ta} />
          <button className="pill" style={{ alignSelf: 'flex-end' }} onClick={() => taiFbPick(it.id, ta.current ? ta.current.value : '')}>
            제출
          </button>
        </div>
      ) : (
        <div className="fbp">
          {opts.map((o) => (
            <button className="pill" onClick={() => taiFbPick(it.id, o)} key={o}>
              {o}
            </button>
          ))}
          <button className="pill" onClick={() => taiFbEtc(it.id)}>
            기타
          </button>
        </div>
      )}
    </div>
  );
}

/** gConvChips(items,card): 스크립트 질문 카드 */
function Chips({ it }: { it: Of<'chips'> }) {
  const card = it.card;
  if (!card)
    return (
      <div className="g-chiprow" id={it.id}>
        {it.items.map((c, i) => (
          <button className="g-qchip" data-i={i} onClick={() => chipPick(it.id, i)} key={i}>
            {c.label}
          </button>
        ))}
      </div>
    );
  return (
    <div className="g-chiprow gclw" id={it.id}>
      <div className="gcl-badge">
        <span className="dot" />
        입력이 필요합니다, 아래 카드에서 답해주십시오
      </div>
      <div className="gcl" role="group" aria-label={card.title}>
        <div className="hd">
          <span className="pg num">{'질문 ' + card.pg[0] + ' / ' + card.pg[1]}</span>
          <b>{card.title}</b>
          <button type="button" className="x" data-skip="1" aria-label="이 질문 건너뛰기 (추천값으로 진행)" onClick={() => chipSkip(it.id)}>
            ✕
          </button>
        </div>
        {card.sub && <div className="sub">{card.sub}</div>}
        {it.items.map((c, i) => (
          <button type="button" className="op" data-i={i} onClick={() => chipPick(it.id, i)} key={i}>
            <b>{c.label}</b>
            {c.desc && <span>{c.desc}</span>}
          </button>
        ))}
        <button type="button" className="free" data-free="1" onClick={() => chipFree(it.id)}>
          직접 답변 작성
          {card.freeHint && <span style={{ display: 'block', fontSize: '11.5px', marginTop: '2px', opacity: 0.8 }}>{card.freeHint}</span>}
        </button>
      </div>
    </div>
  );
}

/** tfAiStrategy(sp) 의 전략 카드 */
function TfSum({ it }: { it: Of<'tfsum'> }) {
  const c = it.card;
  const row = (k: string, v: string) => (
    <div className="r">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
  return (
    <div className="tf-sum" id={it.id}>
      <div className="h">{c.title}</div>
      <div className="rows">
        {row('자산', c.asset)}
        {row('사는 때', c.buy)}
        {row('파는 때', c.sell)}
        {row('돌려 볼 기간', c.period)}
        {c.skip && row('검증에서 뺀 조건', c.skip)}
      </div>
      <div style={{ fontSize: '11.5px', color: 'var(--gt3)', lineHeight: 1.7, margin: '-4px 0 13px' }}>실제 일봉 시세로 하루씩 다시 돌립니다. 살 때와 팔 때마다 수수료 0.1%를 뺍니다.</div>
      <button className="tf-btn p" onClick={() => tfVerifyGo(it.id)}>
        과거로 돌려 보기
      </button>
    </div>
  );
}
/** tfVerifyGo(id) 가 남기는 완료 줄 */
function TfDone({ it }: { it: Of<'tfdone'> }) {
  return (
    <div className="tf-card done" id={it.id} style={{ maxWidth: '640px' }}>
      <div className="tf-hd">
        <span className="ok">{TaiCheck}</span>
        <span className="tt">{it.asset + ' 전략 검증'}</span>
        <span className="ans" style={{ cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '3px' }} onClick={tfResume}>
          이어서 보기
        </span>
      </div>
    </div>
  );
}

export function ThreadItem({ it, sess }: { it: Item; sess: Session }) {
  switch (it.k) {
    case 'user':
      return <UserRow it={it} />;
    case 'usum':
      return (
        <div className="g-usum">
          {it.rows.map((r, i) => (
            <div className="rw" key={i}>
              <b>{r.b}</b>
              <span>{r.v}</span>
            </div>
          ))}
        </div>
      );
    case 'ai':
      return <AiMsg it={it} />;
    case 'act': {
      const d = sess.acts && sess.acts[it.id];
      return d ? <Act2 d={d} /> : null;
    }
    case 'chart':
      return <ChartCard it={it} />;
    case 'px':
      return (
        <div className="g-pxcard">
          <span className="as">{it.as}</span>
          <b className="pv">{it.pv}</b>
          <span className={'chg ' + (it.up ? 'u' : 'd')}>{it.chg}</span>
          <span className="meta">{it.meta}</span>
        </div>
      );
    case 'status':
      return it.done ? (
        <div className="g-status done">
          <span className="lb">{it.label}</span>
        </div>
      ) : (
        <div className="g-status" id={it.id}>
          <LogoDraw w={24} />
          <span className="lb">{it.label}</span>
        </div>
      );
    case 'next':
      return <NextCol it={{ ...it, badge: it.badge && !(getState().user as { plan?: unknown } | null)?.plan }} />;
    case 'chip':
      return (
        <div className="g-nextcol" id={it.go === 'offretry' ? it.id : undefined}>
          <button className="g-nextq" onClick={() => chipGo(it.id)}>
            <span>{it.label}</span>
            {Arrow}
          </button>
        </div>
      );
    case 'err':
      return (
        <div className="g-errcard" id={it.id}>
          <b>답변을 불러오지 못했습니다.</b>
          <div className="d">네트워크 연결이 불안정하거나 AI 요청 처리 중 문제가 발생했습니다.</div>
          <button className="rt" onClick={() => taiErrRetry(it.id)}>
            다시 시도
          </button>
        </div>
      );
    case 'asknote':
      return it.done ? (
        <div className="ska-note done" id={it.id}>
          질문에 답했습니다
        </div>
      ) : (
        <div className="ska-note" id={it.id}>
          {(it.n > 1 ? '몇 가지만 여쭙겠습니다. 아래에서 ' + it.n + '개에 답해 주십시오' : '아래에서 골라 주십시오') + ' '}
          <span aria-hidden="true">↓</span>
        </div>
      );
    case 'fb':
      return <FbCard it={it} />;
    case 'think':
      return (
        <div className="g-think" data-tid={it.id}>
          <span className="tdots">
            <i />
            <i />
            <i />
          </span>
          <span>{it.label}</span>
        </div>
      );
    case 'tfmsg':
      return (
        <div className="g-amsg" style={{ animation: 'tfIn .4s var(--ease) both' }}>
          <span className="tai-txt">{it.text}</span>
        </div>
      );
    case 'tfsum':
      return <TfSum it={it} />;
    case 'tfdone':
      return <TfDone it={it} />;
    case 'chips':
      return <Chips it={it} />;
  }
}
