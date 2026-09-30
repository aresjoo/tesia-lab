// 복사 창 픽셀 검수 1차 반영
const fs=require('fs');
let p=fs.readFileSync('sk-copy.js','utf8');
const rep=(a,b)=>{ const i=p.indexOf(a); if(i<0) throw new Error('miss '+a.slice(0,60)); p=p.slice(0,i)+b+p.slice(i+a.length); };
// 본문 스크롤 + 아래 고정 단추
rep(`+'<div class="skc-hd"><h2 id="mk-f-t">전략 복사</h2>`,`+'<div class="skc-body">'+'<div class="skc-hd"><h2 id="mk-f-t">전략 복사</h2>`);
rep(`+'<button type="button" class="pl-cta pl-cta-w skc-cta"`,`+'</div><div class="skc-ft">'+'<button type="button" class="pl-cta pl-cta-w skc-cta"`);
rep(`+'<p class="skc-foot">복사는 무료이며 언제든 멈출 수 있습니다.</p>'`,`+'<p class="skc-foot">복사는 무료이며 언제든 멈출 수 있습니다.</p></div>'`);
// 레버리지 문장: 지금 값부터
rep(`'<p class="skc-lev">레버리지 변경도 원본을 따릅니다. 현재 <b class="num">'+lev+'배</b>입니다.</p>'`,`'<p class="skc-lev">현재 레버리지는 <span class="num">'+lev+'배</span>입니다. 원본에서 바꾸면 내 복사에도 적용됩니다.</p>'`);
// 세부 설정
rep(`aria-expanded="false" onclick="skcMore()">복사 설정</button>`,`aria-expanded="false" onclick="skcMore()">세부 설정</button>`);
rep(`b.textContent=a.hidden?'복사 설정':'복사 설정 접기';`,`b.textContent=a.hidden?'세부 설정':'세부 설정 접기';`);
// 시작 시점 설명
rep(`>현재 포지션부터</button></div></div>'`,`>현재 포지션부터</button></div><div class="skc-hint" id="skc-ex-h">원본이 새로 진입할 때부터 따라갑니다.</div></div>'`);
rep(`function skcEx(v,btn){ mkFollowExisting(v,btn);`,`function skcEx(v,btn){ mkFollowExisting(v,btn); var h=$('skc-ex-h'); if(h) h.textContent=v==='copy'?'원본이 지금 가진 포지션을 현재 가격으로 바로 따라 삽니다.':'원본이 새로 진입할 때부터 따라갑니다.';`);
// 확인 행: 입력한 값은 미달이어도 그대로 보인다
rep(`function skcSum(v){ var el=$('mk-f-sum'); if(!el) return; var L=Math.abs(TF_MKF.loss||20);`,`function skcSum(v){ var el=$('mk-f-sum'); if(!el) return; var L=Math.abs(TF_MKF.loss||20); if(v==null){ var raw=parseFloat(($('cps-amt')||{}).value); if(isFinite(raw)&&raw>0) v=raw; }`);
rep(`skcRow('손실 중단',`,`skcRow('손실 중단 기준',`);
fs.writeFileSync('sk-copy.js',p);
let c=fs.readFileSync('sk-copy.css','utf8');
c+=`
/* 픽셀 검수 1차 반영: 본문만 스크롤, 단추는 아래 고정, 글자 16/14 */
.mk-follow.skc{display:flex;flex-direction:column;padding:0;overflow:hidden;max-height:min(90vh,860px)}
.skc-body{flex:1;min-height:0;overflow-y:auto;scrollbar-gutter:stable;padding:24px 28px 8px}
.skc-ft{flex:none;padding:14px 28px 18px;border-top:1px solid rgba(255,255,255,.08);background:#303030}
.skc-fld>label,.skc-fld>.lb{font-size:16px}
.skc-sum .r{font-size:16px}
.skc-hint{font-size:14px}
.skc-lev{font-size:16px;line-height:24px;font-weight:400;color:#dbe6ff}
.skc-in{border-color:rgba(255,255,255,.12)}
@media (max-width:760px){
  .mk-follow.skc{padding:0;max-height:92vh}
  .skc-body{padding:22px 16px 8px}
  .skc-ft{padding:12px 16px calc(14px + env(safe-area-inset-bottom))}
}
`;
fs.writeFileSync('sk-copy.css',c); console.log('ok');
