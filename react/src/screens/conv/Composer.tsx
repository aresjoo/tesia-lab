// 아래 입력창(gComposer, gSend 의 화면 쪽, taiBusySync)과 그 위의 질문 패널(sk-ask: skaRender).
import { useEffect, useRef, useState } from 'react';
import { NET } from '../../core/tai/stream';
import { G, gScrollBottom, useConv } from '../../state/conv';
import { useBodyClass } from '../../state/hooks';
import { TAI, gSend, skaFree, skaFreeOpen, skaNav, skaNext, skaPick, taiAskClose, taiAskSkip, taiStop } from '../../state/tai';

const Chev = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/** skaRender(id): AI 가 모르는 것만 묻는 패널. 하나 고르면 다음 질문으로 넘어간다 */
function Ska() {
  const st = G.ask;
  const free = useRef<HTMLInputElement>(null);
  const freeOn = !!st && st.freeOn === st.idx;
  useEffect(() => {
    if (freeOn) free.current?.focus();
  }, [freeOn, st && st.idx]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!st) return G.askDock ? <div id="g-askdock" /> : null;
  const s = st.steps[st.idx];
  const n = st.steps.length;
  return (
    <div id="g-askdock">
      <div className="ska" id={st.id} role="dialog" aria-label="TETH의 질문">
        <div className="hd">
          <b>{s.title || '몇 가지만 확인하겠습니다'}</b>
          {n > 1 && (
            <span className="pg">
              <button type="button" aria-label="이전 질문" onClick={() => skaNav(-1)} disabled={st.idx === 0}>
                <Chev d="M15 6l-6 6 6 6" />
              </button>
              <span>{n + '개 중 ' + (st.idx + 1)}</span>
              <button type="button" aria-label="다음 질문" onClick={() => skaNav(1)} disabled={st.idx === n - 1}>
                <Chev d="M9 6l6 6-6 6" />
              </button>
            </span>
          )}
          <button type="button" className="x" aria-label="닫기" onClick={taiAskClose}>
            ✕
          </button>
        </div>
        <div className="ops">
          {s.options.slice(0, 6).map((o, i) => {
            const on = st.picks[st.idx].indexOf(i) >= 0;
            return (
              <button type="button" className={'op' + (on ? ' on' : '')} aria-pressed={on} onClick={() => skaPick(i)} key={st.idx + '-' + i}>
                <b>{o.t}</b>
                {o.d && <span>{o.d}</span>}
              </button>
            );
          })}
          {freeOn ? (
            <div className="op free">
              <input
                id={st.id + '-f'}
                type="text"
                placeholder="직접 답을 적어 주십시오"
                defaultValue={st.free[st.idx] || ''}
                ref={free}
                key={st.idx}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    skaFree(e.currentTarget.value);
                  }
                }}
              />
              <button type="button" className="send" onClick={() => skaFree(free.current ? free.current.value : '')}>
                확인
              </button>
            </div>
          ) : (
            <button type="button" className="op" onClick={skaFreeOpen}>
              <b>직접 답변 작성</b>
            </button>
          )}
        </div>
        <div className="ft">
          <button type="button" className="lk" onClick={taiAskSkip}>
            AI가 알아서 판단
          </button>
          {s.multi && (
            <button type="button" className="go" onClick={skaNext}>
              {st.idx < n - 1 ? '다음' : '보내기'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Composer() {
  useConv();
  const on = !!G.cur && (G.mode === 'conv' || (G.mode === 'activity' && G.cur.status !== 'run'));
  const [value, setValue] = useState('');
  const [multi, setMulti] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  useBodyClass('g-inchat', on); /* 대화 중에만 고객센터 단추를 숨긴다 */

  /** 글 길이에 맞춰 높이를 고친다. PC 에서 여러 줄이면 알약 모서리가 커진다 */
  const fit = () => {
    const f = ta.current;
    if (!f) return;
    f.style.height = 'auto';
    f.style.height = Math.min(f.scrollHeight, 120) + 'px';
    if (window.innerWidth > 860) setMulti(f.scrollHeight > 30);
  };
  /* 바깥에서 입력창을 채우거나 비운다 (보낸 말 수정, 보낸 뒤 비우기, 직접 답변 작성) */
  const fillSeq = G.fill ? G.fill.seq : 0;
  useEffect(() => {
    const fl = G.fill;
    const f = ta.current;
    if (!fl || !f) return;
    if (fl.text != null) {
      setValue(fl.text);
      f.value = fl.text;
      if (fl.text) fit();
      else {
        f.style.height = 'auto';
        setMulti(false);
      }
    }
    if (fl.focus) {
      try {
        f.focus();
      } catch {
        /* 무시 */
      }
    }
  }, [fillSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = () => {
    gSend(ta.current ? ta.current.value : value);
  };
  /** taiBusySync(): 받는 중이면 중지 단추, 조사 중이면 흐린 보내기 단추 */
  const streaming = !!NET.req;
  const busy = !streaming && TAI.busy && Date.now() - TAI.busyAt < 180000;
  return (
    <>
      <button id="g-newmsg" className="g-newmsg" hidden={!G.newmsg} onClick={() => gScrollBottom(true)}>
        ↓ 새 응답 보기
      </button>
      <div className={'g-composer-wrap' + (G.dropFly ? ' drop-fly' : '')} id="g-composer-wrap" hidden={!on}>
        <Ska />
        <div className={'g-composer' + (multi ? ' multi' : '')}>
          <div id="g-ctx-chip" />
          <textarea
            id="g-in"
            rows={1}
            placeholder={G.placeholder || '시장에 대해 무엇이든 물어보십시오'}
            aria-label="AI에게 입력"
            spellCheck={false}
            autoComplete="off"
            ref={ta}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              fit();
            }}
            onKeyDown={(e) => {
              /* 한글 조합 중의 Enter 는 보내지 않는다. Shift+Enter 는 줄바꿈 */
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault();
                send();
              }
            }}
          />
          <div className="g-composer-row">
            <span className="g-model" />
            <button className="g-send" id="g-send-btn" onClick={streaming ? taiStop : send} aria-label={streaming ? '생성 중지' : busy ? '조사 진행 중' : '전송'} style={busy ? { opacity: 0.4 } : undefined}>
              {streaming ? <span className="stopsq" /> : '↑'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
