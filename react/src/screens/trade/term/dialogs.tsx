// 터미널의 대화상자, 카드 메뉴, 모바일 전략 고르기. 원본 tfTmTradeDlg, tfTmVerDlg, tfTmMenu, tfTmRename,
// tfTmCloneEx, tfTmDelete, tfTmHalt, tfTmDrawer 를 옮겼다. body 에 붙는 창이라 터미널 글자 규칙은 타지 않는다.
import { fmtDate, idxToDate, mkPx } from '../../../core/trade/engine';
import { TF_TM_ST, tfNFTime, tfTmPct, tfTmWonS } from '../../../core/trade/term';
import { tfBackToChat } from '../bridge';
import { getPreview, getTf } from '../store';
import { tfDrawer, tfDrawerClose, tfSS3Dlg, tfSS3DlgClose, tfTmMenuOff, tfTmMenuOpen } from './overlay';
import { TF_BROKERS, tfExOf2 } from './parts';
import { all, calc, setTm, TF_TM, tfTmClone, tfTmDeleteGo, tfTmHaltGo, tfTmInert, tfTmOf, tfTmRenameGo, tfTmSelect, tfTmSetStatus } from './tm';

const usd0 = (n: number) => Math.round(n).toLocaleString();

/** tfTmTradeDlg(key,entryI): 거래 한 건의 일곱 걸음 */
export function tfTmTradeDlg(key: string, entryI: number) {
  const s = tfTmOf(key);
  if (!s) return;
  const c = calc(s);
  const t2 = c.trades.filter((x) => x.entry === entryI).pop();
  if (!t2) return;
  const px = mkPx((s.p && s.p.px) || null);
  const evE = c.L.evs[t2.entry - s.p.startI];
  const holdN = Math.max(0, t2.exit - t2.entry - 1);
  const evX = c.L.evs[t2.exit - s.p.startI];
  const xp = t2.kind === 'sl' ? px[t2.entry] * (1 + s.p.sl / 100) : t2.kind === 'tp' ? px[t2.entry] * (1 + (s.p.tp as number) / 100) : px[t2.exit];
  const steps: [string, string, string][] = [
    ['진입 결정', fmtDate(idxToDate(t2.entry)), evE ? evE.txt : '조건 충족'],
    ['주문 생성', '시장가 매수, 수량 ' + (t2.capB / px[t2.entry]).toFixed(4), '검증 통과 설정으로 자동 생성'],
    ['체결', '$' + usd0(px[t2.entry]), '전량 체결'],
    ['포지션 관리', holdN + '봉 보유', holdN ? '매 봉 손절 ' + s.p.sl + '%' + (s.p.tp != null ? ', 익절 +' + s.p.tp + '%' : '') + ', 25봉 규칙 평가, 조건 미도달로 유지' : '진입 직후 청산 조건 도달'],
    ['청산 결정', fmtDate(idxToDate(t2.exit)), evX ? evX.txt : '규칙 실행'],
    ['청산 체결', '$' + usd0(xp), (({ sl: '손절 규칙가', tp: '익절 규칙가', time: '종가' } as Record<string, string>)[t2.kind] || '') + ' 기준'],
    ['최종 결과', tfTmWonS(t2.krw) + ' (' + tfTmPct(t2.pnl * 100, 1) + ')', '수수료 왕복 0.2% 반영'],
  ];
  tfSS3Dlg(
    s.asset + ' LONG 거래 추적',
    <div className="tft-lc num">
      {steps.map((sp, i2) => (
        <div className="lc1" key={i2}>
          <span className="n2">{i2 + 1}</span>
          <div className="b2">
            <b>{sp[0]}</b>
            <span className="v2">{sp[1]}</span>
            <p>{sp[2]}</p>
          </div>
        </div>
      ))}
    </div>,
    true,
  );
}

type VerHist = { at: number; from: string; to: string; by?: string; diff: string };
/** tfTmVerDlg(key): 버전 기록 */
export function tfTmVerDlg(key: string) {
  const s = tfTmOf(key);
  if (!s) return;
  const t = getTf();
  const raw = s.src === 'demo' ? ((t.termDemo && (t.termDemo[(s.ref as { id: string }).id] as { verHist?: VerHist[] })) || {}).verHist : (s.ref as { verHist?: VerHist[] }).verHist;
  const vh = (raw || []).slice().reverse();
  tfSS3Dlg(
    '버전 기록: ' + s.name,
    <div className="ss3-cp">
      <div className="sumr num">
        <span>현재 버전</span>
        <b>{s.ver}</b>
      </div>
      {vh.length ? (
        vh.map((v, i) => (
          <div className="sumr num" key={i}>
            <span>
              {v.from + ' → ' + v.to}
              <br />
              <small style={{ color: 'var(--gt3)' }}>{tfNFTime(v.at) + ', ' + (v.by || '사용자')}</small>
            </span>
            <b style={{ fontWeight: 400, fontSize: '12.5px', textAlign: 'right', maxWidth: '280px' }}>{v.diff}</b>
          </div>
        ))
      ) : (
        <div className="ntc" style={{ marginTop: '14px' }}>
          아직 수정 이력이 없습니다. Agent 패널에서 자연어로 전략을 수정하면 버전이 생성됩니다.
        </div>
      )}
    </div>,
  );
}

/** tfTmRename(key) */
function tfTmRename(key: string) {
  const s = tfTmOf(key);
  if (!s) return;
  tfSS3Dlg(
    '이름 변경',
    <div className="ss3-cp">
      <div className="fld3">
        <label htmlFor="tft-rn">전략 이름</label>
        <input type="text" id="tft-rn" maxLength={30} defaultValue={s.name} />
      </div>
      <div className="acts3">
        <button type="button" className="obtn" onClick={() => tfSS3DlgClose()}>
          취소
        </button>
        <button
          type="button"
          className="wbtn"
          onClick={() => {
            const el = document.getElementById('tft-rn') as HTMLInputElement | null;
            if (!el) return;
            if (tfTmRenameGo(key, el.value)) tfSS3DlgClose();
          }}
        >
          저장
        </button>
      </div>
    </div>,
  );
}
/** tfTmCloneEx(key) */
function tfTmCloneEx(key: string) {
  const s = tfTmOf(key);
  if (!s) return;
  const exs = TF_BROKERS.map((b) => b.id).filter((x) => x !== s.ex);
  tfSS3Dlg(
    '다른 거래소에 복제',
    <div className="ss3-cp">
      <div className="ntc">{'"' + s.name + '" 설정 그대로 다른 거래소에 실행 전 상태로 복제합니다. (시뮬레이션)'}</div>
      {exs.map((x) => {
        const e = tfExOf2(x);
        return (
          <button
            type="button"
            className="ss3-radio"
            key={x}
            onClick={() => {
              tfSS3DlgClose();
              tfTmClone(key, x, e.name);
            }}
          >
            <span className="rn">{e.name}</span>
            <span className="rs">{(e.conn ? '파트너 거래소' : '거래소') + ', 복제 후 검증 상태 유지'}</span>
          </button>
        );
      })}
      <div className="acts3">
        <button type="button" className="obtn" onClick={() => tfSS3DlgClose()} style={{ flex: 1 }}>
          취소
        </button>
      </div>
    </div>,
  );
}
/** tfTmDelete(key) */
function tfTmDelete(key: string) {
  const s = tfTmOf(key);
  if (!s) return;
  if (s.status === 'live') {
    tfSS3Dlg(
      '삭제할 수 없습니다',
      <div className="ss3-cp">
        <div className="ntc">
          이 전략은 현재 <b>실행 중</b>입니다.
          <br />
          삭제하려면 먼저 전략 실행을 중지해야 합니다.
        </div>
        <div className="acts3">
          <button type="button" className="obtn" onClick={() => tfSS3DlgClose()}>
            취소
          </button>
          <button
            type="button"
            className="wbtn"
            onClick={() => {
              tfSS3DlgClose();
              tfTmSetStatus(key, 'off', '삭제 준비');
            }}
          >
            전략 중지
          </button>
        </div>
      </div>,
    );
    return;
  }
  tfSS3Dlg(
    '전략 삭제',
    <div className="ss3-cp">
      <div className="ntc">
        {'"' + s.name + '" 전략을 삭제하겠습니까?'}
        <br />
        판단 기록과 버전 이력도 함께 사라집니다. 되돌릴 수 없습니다.
      </div>
      <div className="acts3">
        <button type="button" className="obtn" onClick={() => tfSS3DlgClose()}>
          취소
        </button>
        <button
          type="button"
          className="ss3-dbtn"
          style={{ flex: 1 }}
          onClick={() => {
            tfTmDeleteGo(key);
            tfSS3DlgClose();
          }}
        >
          삭제
        </button>
      </div>
    </div>,
  );
}

/** tfTmMenu(ev,key): 카드의 ⋯ 메뉴 */
export function tfTmMenu(target: Element, key: string) {
  tfTmMenuOff();
  const s = tfTmOf(key);
  if (!s) return;
  const items: [string, () => void][] = [
    ['전략 상세', () => {
      tfTmSelect(key);
      setTm({ tab: 'dash' });
    }],
    ['이름 변경', () => tfTmRename(key)],
    ['복제', () => tfTmClone(key, null)],
    ['다른 거래소에 복제', () => tfTmCloneEx(key)],
  ];
  if (s.status === 'live') items.push(['일시 중지', () => tfTmSetStatus(key, 'off', '수동 중지')]);
  else if (s.status === 'off') items.push(['다시 시작', () => tfTmSetStatus(key, 'live')]);
  else if (s.status === 'ready') items.push(['지금 시작', () => tfTmSetStatus(key, 'live')]);
  items.push(['버전 기록', () => tfTmVerDlg(key)]);
  const run = (f: () => void) => () => {
    tfTmMenuOff();
    f();
  };
  tfTmMenuOpen(
    target,
    <>
      {items.map((it) => (
        <button key={it[0]} onClick={run(it[1])}>
          {it[0]}
        </button>
      ))}
      <div className="sep" />
      <button className="del" onClick={run(() => tfTmDelete(key))}>
        삭제
      </button>
    </>,
  );
}

/** tfTmHalt(): 긴급 정지. 한 번 더 확인한 뒤 모든 소유 전략을 멈춘다 */
export function tfTmHalt() {
  if (tfTmInert()) return;
  const live = all().filter((s) => s.status === 'live');
  /* 복사한 전략 계정(cpCalc)은 전략 복사 조각의 원장이라 여기서는 내 전략만 센다 */
  const posN = live.filter((s) => !!calc(s).pos).length;
  tfSS3Dlg(
    '긴급 정지',
    <div className="ss3-cp">
      <div className="ntc">모든 전략을 멈추고 포지션을 정리하겠습니까?</div>
      <div className="sumr num">
        <span>실행 중 전략</span>
        <b>{live.length + '개'}</b>
      </div>
      <div className="sumr num">
        <span>정리할 포지션</span>
        <b>{posN + '개'}</b>
      </div>
      <div className="ntc" style={{ marginTop: '10px' }}>
        멈춘 전략은 자동으로 다시 시작되지 않습니다. 확인 후 직접 재개하십시오.
      </div>
      <div className="acts3">
        <button type="button" className="obtn" onClick={() => tfSS3DlgClose()}>
          취소
        </button>
        <button
          type="button"
          className="ss3-dbtn"
          style={{ flex: 1 }}
          onClick={() => {
            tfTmHaltGo();
            tfSS3DlgClose();
          }}
        >
          모두 멈추기
        </button>
      </div>
    </div>,
  );
}

/** tfTmDrawer(): 모바일에서 머리의 이름을 누르면 전략 고르기 */
export function tfTmDrawer() {
  const L = all();
  tfDrawer(
    '전략 선택',
    <div className="tm-dlist">
      {L.map((s) => {
        const st = TF_TM_ST[s.status] || TF_TM_ST.off;
        return (
          <button
            type="button"
            className={'tm-ditem' + (TF_TM.sel === s.key ? ' on' : '')}
            key={s.key}
            onClick={() => {
              tfDrawerClose();
              tfTmSelect(s.key);
            }}
          >
            <span className="nm">{s.name}</span>
            <span className={'st st-' + st[2]}>{st[0] + ' ' + st[1]}</span>
            <span className="sy num">{s.sym + ', ' + (s.exL || '')}</span>
          </button>
        );
      })}
      {!getPreview() && (
        <button
          type="button"
          className="tm-dnew"
          onClick={() => {
            tfDrawerClose();
            tfBackToChat();
          }}
        >
          + 새 전략
        </button>
      )}
    </div>,
  );
}
