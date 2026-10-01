const fs=require('fs');
let j=fs.readFileSync('sk-cpx.js','utf8'), n=0;
const r=(a,b)=>{ if(!j.includes(a)) throw new Error('miss '+a.slice(0,70)); j=j.split(a).join(b); n++; };
// NICE: 대기 설명 문구, 빈 포지션 중복 설명 삭제, 빈 거래 문구, 원본 수익률
r("'예산 '+cpUsd(d.waiting,0)+'이 원본 전략의 다음 진입을 기다리고 있습니다.'","'원본 전략이 다음에 진입하면 예산 '+cpUsd(d.waiting,0)+'을 반영합니다.'");
r("cpxEmpty('현재 포지션 없음',on?(c2.winding?'새 진입을 멈췄습니다. 남은 포지션이 없습니다.':'원본 전략이 진입하면 같은 비율로 함께 진입합니다.'):'복사를 중단해 포지션이 없습니다.')",
  "cpxEmpty('현재 포지션 없음',on?(c2.winding?'새 진입을 멈췄습니다. 남은 포지션이 없습니다.':''):'복사를 중단해 포지션이 없습니다.')");
r("cpxEmpty('종료된 거래가 없습니다','원본 전략이 거래를 끝내면 여기에 쌓입니다.')","cpxEmpty('종료된 거래가 없습니다','참여한 거래가 종료되면 여기에 표시합니다.')");
r("'원본 '+mkPct0(x.chg,1)","'원본 수익률 '+mkPct0(x.chg,1)");
r("num\">원본 '+mkPct0(x.pnl*100,1)","num\">원본 수익률 '+mkPct0(x.pnl*100,1)");
// MUST: 상담 안내 한 줄
r("+'<div id=\"cq-tabb\">'+(tab==='bal'?cpxBudgetTab(c2,d):cpxTradesTab(c2,d))+'</div></section>'",
  "+'<div id=\"cq-tabb\">'+(tab==='bal'?cpxBudgetTab(c2,d):cpxTradesTab(c2,d))+'</div></section>'\n    +'<p class=\"cq-help\">막히면 상담원이 24시간 답합니다. <button type=\"button\" class=\"pl-link\" onclick=\"tfTxHelp()\">상담원에게 묻기</button></p>'");
fs.writeFileSync('sk-cpx.js',j);
let c=fs.readFileSync('sk-cpx.css','utf8');
c=c.replace(".cq-hero small i::before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:#9a9a9a;margin-right:6px;vertical-align:2px}\n","");
c+=`
/* s3 반영: 비교 설명은 한 줄 설명 규격, 상태 점 없음, 상담 안내, 거래 행 펼침 표시 */
.cq-why{font-size:18px;line-height:1.5;color:#cdcdcd}
.cq-hero small i{margin-left:4px}
.cq-help{margin:48px 0 0;padding-top:20px;border-top:1px solid rgba(255,255,255,.1);font-size:14px;color:#9a9a9a}
.cq-help .pl-link{margin-left:4px}
details.cq-det>summary .z{padding-right:22px;position:relative}
details.cq-det>summary .z::after{content:'';position:absolute;right:2px;top:50%;width:7px;height:7px;border-right:1.5px solid #9a9a9a;border-bottom:1.5px solid #9a9a9a;transform:translateY(-70%) rotate(45deg);transition:transform .15s}
details.cq-det[open]>summary .z::after{transform:translateY(-30%) rotate(-135deg)}
@media (max-width:768px){ .cq-why{font-size:16px} }
`;
fs.writeFileSync('sk-cpx.css',c); console.log('ok',n, c.includes("i::before"));
