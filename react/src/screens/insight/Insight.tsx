// 인사이트 (#/insight, #/insight/<slug>, #/insight/t/<tag>, #/insight/p/<token>, #/insight/email).
// 원본 tfInsRoute, tfIns2Home, tfIns2View, tfIns2PView, tfIns2Email 과 그 상호작용을 옮겼다. class 와 DOM 짜임은 원본 그대로다.
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import {
  insAssetAsk,
  insBodyFor,
  insHomeRows,
  insNext,
  insPTokCheck,
  insShareUrl,
  insTopics,
  tfIns2Ago,
  tfIns2AuOf,
  tfIns2DateLine,
  tfIns2Md,
  tfIns2Meta,
  tfIns2Of,
  tfIns2PData,
  tfIns2PInfo,
  tfIns2PTok,
  tfIns2Trend,
  tfIns2Ts,
  tfIns2Url,
  tfInsRoute,
  tfInsTagKo,
  type InsPData,
} from '../../core/insight/insight';
import { TF_INS2_AUTH, type InsPost, type InsSec } from '../../core/insight/insight.data';
import { nav } from '../../state/route';
import { authOpen, getState, setState, toast, useApp } from '../../state/store';
import { AssetIcon, FyAvatar, IcShare, InsArt, InsAvatar, InsFig, SnsFb, SnsLi, SnsLnk, SnsX } from './InsArt';
import { NFX_IC, Ss3Dlg, scrollTopNow, tfTrack, useViewEnter } from './NFView';
import { useTf } from './tfState';

const go = (r: string) => () => nav(r);
const docBase = () => window.location.origin + window.location.pathname;

/** tfIns2Md(s) */
/* tail: 뒤에 붙는 글자. 원본처럼 앞 글자와 한 글자 노드가 되게 마지막 조각에 붙인다 */
const Md = ({ s, tail }: { s: string; tail?: string }) => {
  const segs = tfIns2Md(s);
  const last = segs.length - 1;
  const endsText = last >= 0 && !segs[last].b;
  return (
    <>
      {segs.map((x, i) => (x.b ? <b key={i}>{x.t}</b> : i === last && tail ? x.t + tail : x.t))}
      {tail && !endsText ? tail : null}
    </>
  );
};

/** TF_INS_RESUME: 손님 게이트에서 가입이나 로그인을 시작한 글과 그때의 스크롤 자리. 다른 데서 인증 창을 다시 열면 버린다(seq 가 달라진다) */
let INS_RESUME: { slug: string; st: number; seq: number } | null = null;

/** tfIns2GateGo(slug,login) */
function tfIns2GateGo(slug: string, login?: boolean) {
  const sc = document.getElementById('g-scroll');
  const st0 = sc ? sc.scrollTop : 0;
  authOpen(login ? 'login' : 'signup');
  INS_RESUME = { slug, st: st0, seq: getState().auth.seq };
  setState({ pendingNew: null });
  tfTrack('ins_gate', { slug, login: !!login });
}

/** tfIns2Ask(q): 늘 새 대화로 묻는다. 대화 화면은 아직 옮기지 않아 보낼 말만 넘기고 홈으로 간다 */
function tfIns2Ask(q: string) {
  if (!getState().user) {
    authOpen('login');
    return;
  }
  try {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch {
    /* 무시 */
  }
  setState({ pendingNew: q });
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** tfIns2Sh(net,slug) */
function tfIns2Sh(net: 'fb' | 'x' | 'in', slug: string) {
  try {
    window.open(insShareUrl(net, docBase(), slug), '_blank', 'noopener,width=680,height=560');
  } catch {
    toast('팝업이 차단됐습니다');
  }
  tfTrack('ins_share', { net, slug });
}
/** tfIns2CopyFb(u): clipboard API 가 없을 때 */
function tfIns2CopyFb(u: string): boolean {
  let ta: HTMLTextAreaElement | null = null;
  let r = false;
  try {
    ta = document.createElement('textarea');
    ta.value = u;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    r = !!document.execCommand('copy');
  } catch {
    r = false;
  }
  if (ta && ta.parentNode) ta.remove();
  return r;
}
/** tfIns2Copy(slug,btn,ev) 의 복사 부분 */
function copyUrl(slug: string, ok: () => void, bad: () => void) {
  const u = tfIns2Url(docBase(), slug);
  const done = () => {
    ok();
    tfTrack('ins_copy', { slug });
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, () => (tfIns2CopyFb(u) ? done() : bad()));
  else if (tfIns2CopyFb(u)) done();
  else bad();
}

/* ── 조각 ── */

const AuMeta = ({ p }: { p: InsPost }) => (
  <div className="mt">
    <span className="nfz-au">
      <InsAvatar id={p.au} sz={16} />
      <span className="nm3">{tfIns2Meta(p)}</span>
    </span>
  </div>
);
/** tfIns2Home 의 cardH(p) */
const Card = ({ p }: { p: InsPost }) => (
  <div className="nfz-card" onClick={go('#/insight/' + p.slug)}>
    <div className="nfz-art" style={{ aspectRatio: '1.78' }}>
      <span className="cat">{p.cat}</span>
      <InsArt k={p.art} ratio="wide" />
    </div>
    <AuMeta p={p} />
    <h4>{p.title}</h4>
    <div className="sm">{p.sub}</div>
  </div>
);
/** 많이 읽는 글 한 줄 */
const TrendRow = ({ p }: { p: InsPost }) => (
  <div className="nfz-tr">
    <div className="by">
      <span>{tfIns2Meta(p)}</span>
    </div>
    <div className="t" onClick={go('#/insight/' + p.slug)}>
      {p.title}
    </div>
  </div>
);
const Back = () => (
  <button type="button" className="nfz-back" onClick={go('#/insight')}>
    ← 인사이트
  </button>
);
const Body = ({ secs }: { secs: InsSec[] }) => (
  <>
    {secs.map((sc, i) =>
      sc.h ? (
        <Fragment key={i}>
          <h2>{sc.h}</h2>
          {(sc.ps || []).map((x, j) => (
            <p key={j}>
              <Md s={x} />
            </p>
          ))}
        </Fragment>
      ) : sc.q ? (
        <div className="nfz-q" key={i}>
          {sc.q}
        </div>
      ) : sc.fig ? (
        <figure className="nfz-fig" style={{ marginLeft: 0, marginRight: 0 }} key={i}>
          <div className="nfz-art">
            <InsFig t={sc.fig.t} />
          </div>
          <div className="cap">{sc.fig.cap}</div>
        </figure>
      ) : null,
    )}
  </>
);

/* ── 홈 (tfIns2Home): 큰 머리 글 + 같은 줄의 FOR YOU + 주제 레일 ── */
function InsHome({ tag, pd, tok }: { tag: string | null; pd: InsPData | null; tok: string | null }) {
  const { rows, head, t1, t3 } = insHomeRows(tag);
  const topics = (
    <div className="nfz-topics">
      <div className="th5">주제별로 보기</div>
      <div className="tw">
        {insTopics().map((t2) => (
          <button type="button" key={t2} className={'tp' + (tag === t2 ? ' on' : '')} onClick={go('#/insight/t/' + encodeURIComponent(t2))}>
            <span>{tfInsTagKo(t2)}</span>
          </button>
        ))}
      </div>
    </div>
  );
  /* 태그 화면과 같은 레일: 주제가 위, 많이 읽는 글이 아래 */
  const rail = (
    <div className="nfz-rail">
      {topics}
      <div className="rh">많이 읽는 글</div>
      {tfIns2Trend().map((p) => (
        <TrendRow key={p.slug} p={p} />
      ))}
    </div>
  );
  let mid: ReactNode;
  if (tag) {
    mid = (
      <div className="nfz-cols">
        <div>
          <div className="nfz-sh" style={{ marginTop: 0 }}>
            <h2>{'태그: ' + tag}</h2>
            <div className="s">
              {rows.length + '개의 인사이트 • '}
              <a style={{ color: 'var(--gb2)', cursor: 'pointer' }} onClick={go('#/insight')}>
                전체 보기
              </a>
            </div>
          </div>
          {rows.length ? (
            <div className="nfz-t1">
              {rows.map((p) => (
                <Card key={p.slug} p={p} />
              ))}
            </div>
          ) : (
            <div className="nfx-empty" style={{ padding: '60px 0' }}>
              <div className="nfx-etit">이 태그의 인사이트가 아직 없습니다</div>
              <div className="nfx-edesc">다른 태그를 눌러보거나 전체 목록으로 돌아가십시오.</div>
            </div>
          )}
        </div>
        {rail}
      </div>
    );
  } else {
    mid = (
      <>
        <div className="nfz-top3">
          <div className="c1">
            {t1.map((p) => (
              <Card key={p.slug} p={p} />
            ))}
          </div>
          <div className="c2">
            {head && (
              <div className="nfz-card nfz-bigc" onClick={go('#/insight/' + head.slug)}>
                <div className="nfz-art">
                  <span className="cat">{head.cat}</span>
                  <InsArt k={head.art} ratio="hero" />
                </div>
                <AuMeta p={head} />
                <h4>{head.title}</h4>
                <div className="sm">{head.sub}</div>
              </div>
            )}
          </div>
          <div className="c3">{rail}</div>
        </div>
        <div className="nfz-cur">
          <span className="avs">
            <InsAvatar id="a1" sz={28} />
            <InsAvatar id="a2" sz={28} />
          </span>
          <span className="tx">
            오늘의 인사이트는 <b>{TF_INS2_AUTH.a1.nm}</b>과 <b>{TF_INS2_AUTH.a2.nm}</b>가 큐레이션했습니다.
          </span>
        </div>
        <div className="nfz-sh">
          <h2>새로운 인사이트</h2>
          <div className="s">최근 72시간, 시장에서 꼭 알아야 할 변화</div>
        </div>
        <div className="nfz-grid3">
          {/* FOR YOU 는 그리드 같은 줄의 첫 카드 */}
          {pd && (
            <div className="nfz-card nfz-fycard" onClick={go('#/insight/p/' + tok)}>
              <span className="fyl">FOR YOU</span>
              <div className="nfz-art" style={{ aspectRatio: '1.78' }}>
                <InsArt k={'p-' + pd.st} ratio="wide" />
              </div>
              <div className="mt">
                <span className="nfz-au">
                  <FyAvatar />
                  <span className="nm3">맞춤 분석 • 방금 전</span>
                </span>
              </div>
              <h4>{pd.title}</h4>
              <div className="sm">{pd.sub}</div>
            </div>
          )}
          {t3.map((p) => (
            <Card key={p.slug} p={p} />
          ))}
        </div>
      </>
    );
  }
  return (
    <div className="nfz-page">
      <div className="nfz-open">
        {/* 날짜는 h1 첫 줄에 같이 둔다 */}
        <h1>
          {tfIns2DateLine() + ', 시장은 이렇게 움직입니다'}
          <br />
          <em>내 전략에 무엇이 달라지는지 함께 봅니다</em>
        </h1>
      </div>
      {mid}
    </div>
  );
}

/* ── 글 상세 (tfIns2View) ── */
const FB_OPTS: [string, string, string][] = [
  ['0', '👎', '도움 안 됨'],
  ['1', '😐', '조금 도움'],
  ['2', '👍', '도움 됨'],
];
const fbRead = (slug: string) => {
  try {
    return localStorage.getItem('TETH_INS_FB:' + slug);
  } catch {
    return null;
  }
};

function InsView({ p, guest }: { p: InsPost; guest: boolean }) {
  const slug = p.slug;
  const au = tfIns2AuOf(p.au);
  /* 공유 팝오버 (tfIns2ShTgl, tfIns2ShOff) */
  const [shOpen, setShOpen] = useState(false);
  useEffect(() => {
    if (!shOpen) return;
    const off = () => setShOpen(false);
    const id = setTimeout(() => document.addEventListener('click', off), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', off);
    };
  }, [shOpen]);
  /* 링크 복사: 토스트 없이 그 자리의 글자가 바뀐다 */
  const [popCopied, setPopCopied] = useState(false);
  const [cpLbl, setCpLbl] = useState<'ok' | 'bad' | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (f: () => void, ms: number) => timers.current.push(setTimeout(f, ms));
  const bad = () => {
    setCpLbl('bad');
    later(() => setCpLbl(null), 2000);
  };
  const copyPop = (e: MouseEvent) => {
    e.stopPropagation();
    copyUrl(
      slug,
      () => {
        setPopCopied(true);
        later(() => {
          setPopCopied(false);
          setShOpen(false);
        }, 1400);
      },
      bad,
    );
  };
  const copyRow = () =>
    copyUrl(
      slug,
      () => {
        setCpLbl('ok');
        later(() => setCpLbl(null), 1600);
      },
      bad,
    );
  /* 도움 됐는지: 한 번 고르면 잠긴다 (tfIns2Fb) */
  const [fb, setFb] = useState<string | null>(() => fbRead(slug));
  const [fbErr, setFbErr] = useState(false);
  const pickFb = (v: string) => {
    if (guest) return;
    if (fbRead(slug) != null) return;
    try {
      localStorage.setItem('TETH_INS_FB:' + slug, v);
    } catch {
      setFbErr(true);
      return;
    }
    setFb(v);
    tfTrack('ins_feedback', { slug, v });
  };
  /* 관련 자산: 바로 보내지 않고 대화상자에서 물을 것을 정리한다 (tfIns2AssetDlg, tfIns2AssetGo) */
  const [astq, setAstq] = useState<{ sym: string; name: string; t: string; sheet: boolean } | null>(null);
  const astIn = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (astq) astIn.current?.focus();
  }, [astq]);
  const assetDlg = (ai: number) => {
    const a = p.assets && p.assets[ai];
    if (!a) return;
    if (guest) {
      authOpen('login');
      return;
    }
    setAstq({ sym: a[0], name: a[1], t: p.title, sheet: window.innerWidth <= 760 });
  };
  const assetGo = () => {
    if (!astq) return;
    const extra = (astIn.current && astIn.current.value.trim()) || '';
    setAstq(null);
    tfIns2Ask(insAssetAsk(astq, extra));
    tfTrack('ins_asset_ask', { sym: astq.sym, extra: !!extra });
  };

  return (
    <div className="nfz-page">
      <Back />
      <div className="nfz-det">
        <article className="nfz-a">
          <h1>{p.title}</h1>
          <div className="deck">{p.sub}</div>
          <div className="nfz-meta">
            <span className="nfz-au">
              <InsAvatar id={p.au} sz={26} />
              <span className="nm3" style={{ fontSize: '12.5px', color: 'var(--gt)' }}>
                {au.nm}
              </span>
            </span>
            <span>,&nbsp;</span>
            <span>{tfIns2Ago(tfIns2Ts(p))}</span>
            <span className="sp" />
            <span className="nfz-shwrap">
              <button
                type="button"
                className="ib"
                aria-label="공유"
                onClick={(e) => {
                  e.stopPropagation();
                  setShOpen((v) => !v);
                }}
              >
                <IcShare />
              </button>
              <span className="nfz-shpop" id="nfz-shpop" hidden={!shOpen}>
                <button type="button" onClick={copyPop}>
                  <SnsLnk />
                  <span className="lb2" style={popCopied ? { color: 'var(--gg)' } : undefined}>
                    {popCopied ? '복사했습니다!' : '링크 복사'}
                  </span>
                </button>
                <button type="button" onClick={() => tfIns2Sh('fb', slug)}>
                  <SnsFb />
                  <span className="lb2">페이스북에 공유하기</span>
                </button>
                <button type="button" onClick={() => tfIns2Sh('x', slug)}>
                  <SnsX />
                  <span className="lb2">X에 공유하기</span>
                </button>
                <button type="button" onClick={() => tfIns2Sh('in', slug)}>
                  <SnsLi />
                  <span className="lb2">LinkedIn에 공유하기</span>
                </button>
              </span>
            </span>
          </div>
          <div className="nfz-art nfz-hero2 nfz-hero">
            <span className="cat">{p.cat}</span>
            <InsArt k={p.art} ratio="hero" />
          </div>
          <div className="nfz-body">
            <Body secs={insBodyFor(p, guest)} />
          </div>
          {guest && (
            <div className="nfz-gatewrap">
              <div className="nfz-fade" />
              <div className="nfz-gate">
                <span className="hl">TETH에서 계속 읽어보십시오</span>
                <div className="s2">
                  무료 계정을 만들면 모든 인사이트와
                  <br />
                  개인화된 시장 분석을 끝까지 읽을 수 있습니다.
                </div>
                <button type="button" className="b1" onClick={() => tfIns2GateGo(slug)}>
                  무료로 시작하기
                </button>
                <div className="fr">영원히 무료, 카드 등록 필요없음</div>
                <div className="lg">
                  이미 계정이 있으십니까? <a onClick={() => tfIns2GateGo(slug, true)}>로그인</a>
                </div>
              </div>
            </div>
          )}
          <div className="nfz-tags">
            {p.tags.map((tg) => (
              <span className="tg" key={tg} onClick={go('#/insight/t/' + encodeURIComponent(tg))}>
                {tfInsTagKo(tg)}
              </span>
            ))}
          </div>
          <div className="nfz-social">
            <button type="button" aria-label="페이스북에 공유" onClick={() => tfIns2Sh('fb', slug)}>
              <SnsFb />
            </button>
            <button type="button" aria-label="X에 공유" onClick={() => tfIns2Sh('x', slug)}>
              <SnsX />
            </button>
            <button type="button" aria-label="LinkedIn에 공유" onClick={() => tfIns2Sh('in', slug)}>
              <SnsLi />
            </button>
            <button type="button" aria-label="링크 복사" onClick={copyRow}>
              <SnsLnk />
            </button>
            <span className="cplbl" id="nfz-cplbl" hidden={!cpLbl} style={cpLbl === 'bad' ? { color: 'var(--gr)' } : undefined}>
              {cpLbl === 'bad' ? '복사에 실패했습니다' : '복사했습니다!'}
            </span>
          </div>
          {p.assets && p.assets.length ? (
            <div className="nfz-assets">
              <div className="ah">이 인사이트에 나온 자산, 지금은 어떤 상황입니까?</div>
              <div className="as">누르면 TETH에게 물어볼 내용을 정리해드립니다.</div>
              <div className="nfz-astrow">
                {p.assets.map((a, ai) => (
                  <div className="nfz-ast" key={a[0]} onClick={() => assetDlg(ai)}>
                    <span className="ico">
                      <AssetIcon sym={a[0]} sz={34} />
                    </span>
                    <span>
                      <span className="nm">{a[1]}</span>
                      <div className="sy">{a[0]}</div>
                    </span>
                    <span className="ar2">{NFX_IC.chev()}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {!guest && (
            <div className="nfz-fb">
              <div className="q">이 인사이트가 도움이 되었습니까?</div>
              <div className={'bs' + (fb != null ? ' locked' : '')} id="nfz-fbrow">
                {FB_OPTS.map((o) => (
                  <button type="button" key={o[0]} className={'nfz-fbb' + (fb === o[0] ? ' on' : '')} data-v={o[0]} onClick={() => pickFb(o[0])}>
                    <span>{o[1]}</span>
                    {o[2]}
                  </button>
                ))}
              </div>
              <div className="fbok" id="nfz-fbok" hidden={fb == null && !fbErr} style={fbErr ? { color: 'var(--gr)' } : undefined}>
                {fbErr ? '저장에 실패했습니다. 잠시 후 다시 시도해주십시오.' : '소중한 의견 감사합니다.'}
              </div>
            </div>
          )}
          <div className="nfz-next">
            <div className="nh">다음 인사이트도 읽어보십시오</div>
            <div className="nfz-nextg">
              {insNext(slug).map((x) => (
                <div className="nfz-nc" key={x.slug} onClick={go('#/insight/' + x.slug)}>
                  <div className="nfz-art">
                    <InsArt k={x.art} ratio="wide" />
                  </div>
                  <div className="mt">{tfIns2Meta(x)}</div>
                  <div className="t">{x.title}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="tfbk-note" style={{ marginTop: 26, textAlign: 'left' }}>
            투자 판단의 최종 책임은 이용자에게 있습니다.
          </div>
        </article>
        <div className="nfz-rail">
          <div className="rh">많이 읽는 글</div>
          {/* 지금 읽는 글은 추천에서 뺀다 */}
          {tfIns2Trend()
            .filter((x) => x.slug !== slug)
            .map((x) => (
              <TrendRow key={x.slug} p={x} />
            ))}
        </div>
      </div>
      {astq && (
        <Ss3Dlg title={astq.name + ' 더 알아보기'} sheet={astq.sheet} onClose={() => setAstq(null)}>
          <div className="ss3-cp nfz-astdlg">
            <div className="ntc" style={{ marginBottom: 12 }}>
              TETH에게 추가적으로 궁금한 점이 있습니까?
              <br />
              <span style={{ fontSize: 12 }}>비워두고 진행해도 됩니다. 기본 분석 질문과 함께 전달됩니다.</span>
            </div>
            <textarea id="nfz-astq" ref={astIn} placeholder="예: 최근 급등 구간의 지지선도 같이 봐줘 (선택)" />
            <div className="acts3">
              <button type="button" className="obtn" onClick={() => setAstq(null)}>
                취소
              </button>
              <button type="button" className="wbtn" onClick={assetGo}>
                TETH에게 물어보기
              </button>
            </div>
          </div>
        </Ss3Dlg>
      )}
    </div>
  );
}

/* ── 맞춤 글 상세 (tfIns2PView) ── */
const P_BTN = { width: 300, maxWidth: '100%', height: 46, borderRadius: 23, border: 0, background: 'var(--gb)', color: '#fff', fontSize: '14.5px', fontWeight: 600, cursor: 'pointer' } as const;
const FORYOU = { fontSize: '10.5px', fontWeight: 700, letterSpacing: '.09em', color: '#c7d2fe' } as const;

/** 만료됐거나 지금 상태와 맞지 않는 주소 */
function InsPStale({ expired, cur }: { expired: boolean; cur: string | null }) {
  return (
    <div className="nfz-page">
      <Back />
      <div className="nfz-det">
        <article className="nfz-a" style={{ paddingTop: 16 }}>
          <h1>{expired ? '이 인사이트는 만료됐습니다' : '이 인사이트는 새 버전으로 갱신됐습니다'}</h1>
          <div className="deck">맞춤 인사이트는 발행 후 48시간 동안 제공됩니다. 지금 상태 기준으로 다시 만들 수 있습니다.</div>
          {cur ? (
            <button type="button" style={P_BTN} onClick={go('#/insight/p/' + cur)}>
              최신 인사이트 다시 생성
            </button>
          ) : (
            <button type="button" style={P_BTN} onClick={go('#/insight')}>
              인사이트 홈으로
            </button>
          )}
        </article>
      </div>
    </div>
  );
}
function InsPView({ pd }: { pd: InsPData }) {
  useEffect(() => {
    tfTrack('ins_personal_view', { st: pd.st });
  }, [pd.st]);
  return (
    <div className="nfz-page">
      <Back />
      <div className="nfz-det">
        <article className="nfz-a">
          <div style={{ margin: '2px 0 10px' }}>
            <span style={{ ...FORYOU, background: 'rgba(99,102,241,.2)', border: '1px solid rgba(129,140,248,.35)', borderRadius: 6, padding: '5px 9px' }}>FOR YOU</span>
          </div>
          <h1>{pd.title}</h1>
          <div className="deck">{pd.sub}</div>
          <div className="nfz-meta">
            <span>{pd.chips.filter(Boolean).join(', ')}</span>
            <span className="sp" />
            <span>48시간 뒤 만료</span>
          </div>
          <div className="nfz-art nfz-hero">
            <InsArt k={'p-' + pd.st} ratio="hero" />
          </div>
          <div className="nfz-body">
            <Body secs={pd.secs} />
          </div>
          <div className="nfz-pcta-wrap">
            {/* tfIns2AskP() */}
            <button type="button" className="nfz-pcta" onClick={() => tfIns2Ask(pd.ask)}>
              {pd.ctaLb + ' →'}
            </button>
          </div>
        </article>
        <div className="nfz-rail">
          <div className="rh">많이 읽는 글</div>
          {tfIns2Trend().map((x) => (
            <TrendRow key={x.slug} p={x} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 이메일 미리보기 (tfIns2Email) ── */
function InsEmail({ pd, tok }: { pd: InsPData; tok: string | null }) {
  const first = pd.secs[0];
  const pStyle = { fontSize: '14.5px', lineHeight: '24px' } as const;
  return (
    <div className="nfz-page" style={{ maxWidth: 860 }}>
      <Back />
      <div className="nfz-mail">
        <div className="mh">
          보낸사람 <b>TETH 인사이트 &lt;insights@teth.ai&gt;</b>
          <br />
          제목 <b>{pd.title}</b>
        </div>
        <div className="mb2">
          <span style={FORYOU}>FOR YOU</span>
          <h2 style={{ fontSize: 22, lineHeight: '30px', color: 'var(--gt)', margin: '10px 0 8px' }}>{pd.title}</h2>
          <div style={{ fontSize: 14, lineHeight: '22px', color: 'var(--gt2)', marginBottom: 16 }}>{pd.sub}</div>
          <div className="nfz-art" style={{ aspectRatio: '2.1', marginBottom: 18 }}>
            <InsArt k={'p-' + pd.st} ratio="wide" />
          </div>
          <div className="nfz-body">
            <h2 style={{ fontSize: 17, marginTop: 6 }}>{first.h}</h2>
            <p style={pStyle}>
              <Md s={first.ps[0]} />
            </p>
            <p style={{ ...pStyle, marginBottom: 0 }}>
              <Md s={(first.ps[1] || '').slice(0, 110)} tail="…" />
            </p>
          </div>
        </div>
        <div className="nfz-mailgate">
          <div className="fd" />
          <button type="button" style={{ width: 280, maxWidth: '100%', height: 44, borderRadius: 22, border: 0, background: 'var(--gb)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }} onClick={go('#/insight/p/' + tok)}>
            TETH에서 계속 읽기
          </button>
          <div style={{ fontSize: '11.5px', color: 'var(--gt3)', marginTop: 12 }}>버튼을 누르면 웹 인사이트로 이동합니다.</div>
        </div>
      </div>
    </div>
  );
}

/** tfInsRoute(h): 주소를 화면으로. 볼 수 없는 주소는 알림을 띄우고 인사이트 홈을 그린다 */
export function Insight({ hash }: { hash: string }) {
  /* 원본은 로그인이 끝나도 화면을 바로 다시 그리지 않고 320ms 뒤에 회원 상태로 그린다. 그때까지는 손님 화면 그대로다 */
  const userNow = useApp((s) => !!s.user);
  const [member, setMember] = useState(userNow);
  const guest = !(userNow && member);
  const tf = useTf();
  useViewEnter(hash);

  const info = tfIns2PInfo(!guest, tf, tf.sessions);
  const pd = tfIns2PData(info);
  const tok = tfIns2PTok(info);
  const r = tfInsRoute(hash);

  let el: ReactNode;
  /** 알림: [토스트, 로그인 창을 열지, 옮겨 갈 주소] */
  let notice: { toast: string; login?: boolean; to?: string } | null = null;
  const home = (tag: string | null = null) => <InsHome tag={tag} pd={tag ? null : pd} tok={tok} />;
  if (r.k === 'home') {
    if (r.toast) notice = { toast: r.toast };
    el = home(r.tag);
  } else if (r.k === 'email') {
    if (guest) {
      notice = { toast: '이메일 미리보기는 로그인 후 볼 수 있습니다', login: true };
      el = home();
    } else if (!pd) {
      notice = { toast: '생성된 맞춤 인사이트가 없습니다' };
      el = home();
    } else el = <InsEmail pd={pd} tok={tok} />;
  } else if (r.k === 'p') {
    const chk = insPTokCheck(r.token);
    if (guest) {
      notice = { toast: '개인화 인사이트는 로그인 후 볼 수 있습니다', login: true };
      el = home();
    } else if (!chk.ok) {
      notice = { toast: '잘못된 인사이트 주소입니다' };
      el = home();
    } else if (chk.expired || !pd || pd.st !== chk.st) el = <InsPStale expired={chk.expired} cur={pd ? tok : null} />;
    else el = <InsPView pd={pd} />;
  } else {
    const p = tfIns2Of(r.slug);
    if (!p) {
      notice = { toast: '글을 찾을 수 없습니다', to: '#/insight' };
      el = null;
    } else el = <InsView key={p.slug} p={p} guest={guest} />;
  }

  const nKey = notice ? notice.toast : '';
  const nRef = useRef(notice);
  nRef.current = notice;
  useEffect(() => {
    const n = nRef.current;
    if (!n) return;
    toast(n.toast);
    if (n.login) authOpen('login');
    if (n.to) nav(n.to);
  }, [hash, nKey]);

  /* 로그인이 끝나면(signupDone): 게이트에서 시작했으면 그 글과 그 자리로(TF_INS_RESUME), 아니면 지금 인사이트 화면을 회원 상태로 다시 그린다 */
  const post = useRef<{ res: { slug: string; st: number } | null; top: boolean } | null>(null);
  useEffect(() => {
    if (!userNow) {
      setMember(false);
      return;
    }
    if (member) return; /* 처음부터 회원 */
    const res = INS_RESUME;
    INS_RESUME = null;
    const s = getState();
    const ok = res && res.seq === s.auth.seq ? res : null;
    if (ok) setState({ pendingNew: null });
    const top = !ok && s.pendingNew == null;
    const t = setTimeout(() => {
      post.current = { res: ok, top };
      setMember(true);
    }, 320);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userNow]);
  /* 회원 상태로 다시 그린 바로 그 자리에서: 맨 위로 올린 다음(gContent), 게이트에서 왔으면 다음 프레임에 보던 자리로 */
  useLayoutEffect(() => {
    const x = post.current;
    if (!x || !member) return;
    post.current = null;
    const res = x.res;
    if (res) {
      if (!tfIns2Of(res.slug)) return;
      const want = '#/insight/' + res.slug;
      if (window.location.hash !== want) {
        try {
          history.replaceState(null, '', want);
        } catch {
          /* 무시 */
        }
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
      scrollTopNow();
      requestAnimationFrame(() => {
        const sc = document.getElementById('g-scroll');
        if (sc) sc.scrollTop = res.st || 0;
      });
    } else if (x.top && /^#\/insight(\/|$)/.test(window.location.hash)) scrollTopNow();
  }, [member]);

  return el;
}
