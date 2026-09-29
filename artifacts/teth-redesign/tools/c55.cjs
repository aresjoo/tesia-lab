// 간단한 1차: 공포 탐욕 지수 조건 + AI 가 대화에서 전략서를 채우는 [STRATEGY] 태그
const fs=require('fs'), D=__dirname+'/', R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/';
const ed=(file,pairs)=>{ let s=fs.readFileSync(file,'utf8'); for(const [x,y,n] of pairs){ const c=s.split(x).length-1; if(c!==(n||1)) throw new Error(file.slice(-14)+' x'+c+': '+x.slice(0,90)); s=s.split(x).join(y); } fs.writeFileSync(file,s); };

// ── 엔진: 공포 탐욕 지수 상한(fng)을 사는 조건에 더한다. 그날 발표된 값만 쓴다
ed(D+'agent-core.js',[
  ["function mkHybridRun(c){","/* 공포 탐욕 지수(그날 00시 UTC 발표, 그날 종가 판단에 쓸 수 있음). 자료가 없으면 null */\nfunction mkFng(i){ var f=window.TETH_PX&&TETH_PX.fng; return f&&f[i]!=null?f[i]:null; }\nfunction mkHybridRun(c){"],
  ["trendOk:!c.tf||gap>3,up:up,","trendOk:!c.tf||gap>3,fng:mkFng(i),fngOk:c.fng==null||(mkFng(i)!=null&&mkFng(i)<=c.fng),up:up,"],
  ["        if(q.rsiOk&&q.bounceOk&&q.trendOk){ var up2=q.up;","        if(q.rsiOk&&q.bounceOk&&q.trendOk&&q.fngOk){ var up2=q.up;"],
  ["fee:b.fee,rsi:q.rsi,bounce:q.bounce,up:up2,of:U.length}); } } } }","fee:b.fee,rsi:q.rsi,bounce:q.bounce,fng:q.fng,up:up2,of:U.length}); } } } }"],
  ["function mkRuleRun(c){ return mkHybridRun({asset:c.asset,rsiTh:c.rsiTh,tp:c.tp,sl:c.sl,tf:c.tf,every:1,gate:0,startI:c.startI}); }","function mkRuleRun(c){ return mkHybridRun({asset:c.asset,rsiTh:c.rsiTh,tp:c.tp,sl:c.sl,tf:c.tf,fng:c.fng,every:1,gate:0,startI:c.startI}); }"],
]);
ed(D+'rd-ui.js',[["  return mkRuleRun({asset:c.asset,rsiTh:c.rsiTh,tp:c.tp,sl:c.sl,tf:!!c.tf,startI:st});","  return mkRuleRun({asset:c.asset,rsiTh:c.rsiTh,tp:c.tp,sl:c.sl,tf:!!c.tf,fng:c.fng,startI:st});"]]);
ed(R+'index.html',[["function tfMkBt(p){ var r=mkRuleRun({asset:p.px,rsiTh:p.rsiTh,tp:p.tp,sl:p.sl,tf:!!p.trendFilter,startI:p.startI});","function tfMkBt(p){ var r=mkRuleRun({asset:p.px,rsiTh:p.rsiTh,tp:p.tp,sl:p.sl,tf:!!p.trendFilter,fng:p.fng,startI:p.startI});"],
  ["  return {sl:p.sl,tp:p.tp!=null?p.tp:null,rsiTh:p.rsiTh,trendFilter:!!p.trendFilter,startI:s2,endI:p.endI!=null?p.endI:end,px:p.px||null,eng:p.eng||null};","  return {sl:p.sl,tp:p.tp!=null?p.tp:null,rsiTh:p.rsiTh,trendFilter:!!p.trendFilter,startI:s2,endI:p.endI!=null?p.endI:end,px:p.px||null,eng:p.eng||null,fng:p.fng!=null?p.fng:null};"],
  ["function tfTmKey(p){ return [p.sl,p.tp,p.rsiTh,p.trendFilter?1:0,p.startI,p.endI,p.px||'',p.eng||''].join('|'); }","function tfTmKey(p){ return [p.sl,p.tp,p.rsiTh,p.trendFilter?1:0,p.startI,p.endI,p.px||'',p.eng||'',p.fng!=null?p.fng:''].join('|'); }"]]);

// ── 백테스트 화면: 규칙과 근거에 공포 탐욕 지수를 보인다
ed(D+'bt-a.js',[
  ["    o.push(['사는 때','되돌림 점수가 '+c.rsiTh+' 아래로 내려간 뒤 하루 만에 0.5% 넘게 다시 오르면'+(c.tf?', 오름세일 때만':'')]);","    o.push(['사는 때','되돌림 점수가 '+c.rsiTh+' 아래로 내려간 뒤 하루 만에 0.5% 넘게 다시 오르면'+(c.tf?', 오름세일 때만':'')+(c.fng!=null?', 공포 탐욕 지수가 '+c.fng+' 이하일 때만':'')]);"],
  [".concat(gate&&e.of?[['오름세 종목',e.of+'개 중 '+e.up+'개, 기준 '+need+'개 이상']]:[]).concat([['산 가격',btPx(e.px)]])},e); return; }",".concat(gate&&e.of?[['오름세 종목',e.of+'개 중 '+e.up+'개, 기준 '+need+'개 이상']]:[]).concat(c.fng!=null&&e.fng!=null?[['공포 탐욕 지수',e.fng+', 기준 '+c.fng+' 이하']]:[]).concat([['산 가격',btPx(e.px)]])},e); return; }"],
]);

// ── 내 전략: AI 가 채운 전략서(t.aiSpec)가 있으면 그 값을 쓴다
ed(D+'bt-c.js',[
  ["  var p=(t.cloneFrom&&t.pendingP)?t.pendingP:tfParams(), iv=t.intake,","  var p=(t.cloneFrom&&t.pendingP)?t.pendingP:tfParams(t.aiSpec?{sl:t.aiSpec.sl,tp:t.aiSpec.tp,rsiTh:t.aiSpec.rsiTh,trendFilter:!!t.aiSpec.tf,fng:t.aiSpec.fng}:null), iv=t.intake,"],
  ["  var cfg={id:'mine',kind:'rule',asset:a,rsiTh:p.rsiTh,tp:p.tp,sl:p.sl,tf:p.trendFilter?1:0,startI:61};","  var cfg={id:'mine',kind:'rule',asset:a,rsiTh:p.rsiTh,tp:p.tp,sl:p.sl,tf:p.trendFilter?1:0,fng:p.fng!=null?p.fng:null,startI:61};"],
  ["  var name=(t.cloneFrom?t.cloneFrom+' 님 전략, ':'')+a+' 반등 매수';","  var name=(t.cloneFrom?t.cloneFrom+' 님 전략, ':'')+(t.aiSpec&&t.aiSpec.name?t.aiSpec.name:a+' 반등 매수');"],
  ["+sl+'% 내려가면, 또는 25일이 지나면 팔아요.';","+sl+'% 내려가면, 또는 25일이 지나면 팔아요.'+(p.fng!=null?' 공포 탐욕 지수가 '+p.fng+' 이하일 때만 사요.':'');"],
]);

// ── 대화: 전략서 태그를 읽어 카드로 보여 주고, 누르면 새 백테스트 화면으로
ed(R+'index.html',[
  ["CHART|SETUP|","CHART|SETUP|STRATEGY|",4],
  ["      var mS=acc.match(/\\[SETUP\\s+(\\{[\\s\\S]*?\\})\\s*\\]/),setup=null; if(mS){ setup={}; try{ setup=JSON.parse(mS[1])||{}; }catch(e){} }",
   "      var mS=acc.match(/\\[SETUP\\s+(\\{[\\s\\S]*?\\})\\s*\\]/),setup=null; if(mS){ setup={}; try{ setup=JSON.parse(mS[1])||{}; }catch(e){} }\r\n      var mSp=acc.match(/\\[STRATEGY\\s+(\\{[\\s\\S]*?\\})\\s*\\]/),spec=null; if(mSp){ try{ spec=JSON.parse(mSp[1]); }catch(e){} } if(spec) setup=null; /* AI 가 채운 전략서가 있으면 질문 카드 대신 그것으로 */"],
  ["      if(setup&&conv&&live){ /* 자동매매 동의","      if(spec&&live){ delay(info?1400:600,function(){ if(G.cur===sess) tfAiStrategy(spec); }); }\r\n      else if(setup&&conv&&live){ /* 자동매매 동의"],
  ["   +'\\n사용자가 자동매매 전략 생성, 매매 위임,",
   "   +'\\n전략 설계서: 사용자가 사고파는 조건을 구체적으로 말하거나(예: \"비트코인 크게 빠지면 사서 10% 오르면 팔아\", \"공포 지수 낮을 때만 사\") 전략을 직접 설계해 달라고 하면, SETUP 대신 답변 마지막 줄에 정확히 이 형식의 태그를 붙여라: [STRATEGY {\"asset\":\"비트코인\",\"depth\":\"deep\",\"tp\":10,\"sl\":-5,\"fng\":25,\"trend\":false,\"period\":\"1y\",\"name\":\"공포에 사는 비트코인\"}]. asset 은 비트코인, 이더리움, 솔라나, 리플, 도지코인, 에이다, 아발란체, 비앤비, 테슬라, 엔비디아, 애플, 마이크로소프트, 아마존, 메타, 알파벳, 에이엠디, 금, 나스닥, S&P 500 중 하나. depth 는 얼마나 밀렸을 때 살지로 shallow(조금), mid(보통), deep(크게). tp 는 익절 %(없으면 null), sl 은 손절 %(음수, -1에서 -15). fng 는 공포 탐욕 지수 상한(그 값 이하일 때만 산다, 코인에만, 없으면 null). trend 가 true 면 가격이 한쪽으로 뚜렷할 때만 산다. period 는 1y, 2y, all. name 은 14자 이내. 이 엔진이 계산할 수 있는 것은 \"밀렸다가 하루 0.5% 넘게 반등한 날 산다\"는 사는 방식 하나와 익절, 손절, 25일 보유 한도, 공포 탐욕 지수 상한뿐이다. 사용자의 조건이 이 틀과 다르면 가장 가까운 값으로 옮기고, 무엇이 달라졌는지 한 문장으로 솔직하게 말하라. 뉴스, 거래량, 다른 지표처럼 계산할 수 없는 조건은 빼고 뺐다고 말하라. 수익률을 예상하거나 숫자를 지어내지 마라. 결과는 화면의 백테스트가 실제 시세로 계산한다. 이 태그를 붙이면 NEXT, ACT, SETUP 은 붙이지 않는다.'\r\n   +'\\n사용자가 자동매매 전략 생성, 매매 위임,"],
  ["function tfIntakeDone(){",
`/* AI 가 채운 전략서 → 카드 한 장. 값은 여기서 다시 검사한다(프롬프트를 믿지 않는다) */
var TF_AI_DEPTH={shallow:52,mid:44,deep:38};
function tfAiStrategy(sp){
  var t=tfS(), a=String(sp&&sp.asset||''); a=(typeof BT_MINE_ALIAS!=='undefined'&&BT_MINE_ALIAS[a])||a;
  if(!(window.TETH_PX&&TETH_PX.px[a])){ tfAiMsg(gEsc(a||'이 자산')+'은 아직 백테스트할 가격 자료가 없어요. 비트코인, 이더리움, 미국 대형주, 금, 나스닥 같은 자산으로 바꿔 볼까요?'); return; }
  var num=function(v,lo,hi){ v=Number(v); return isFinite(v)?Math.max(lo,Math.min(hi,Math.round(v*10)/10)):null; };
  var crypto=/비트코인|이더리움|솔라나|리플|도지코인|에이다|아발란체|비앤비/.test(a);
  var spec={rsiTh:TF_AI_DEPTH[sp.depth]||44,tp:sp.tp==null?null:num(sp.tp,1,60),sl:-Math.abs(num(sp.sl,-15,-1)||5),fng:(crypto&&sp.fng!=null)?num(sp.fng,5,95):null,tf:!!sp.trend,name:String(sp.name||'').slice(0,14)||null};
  if(spec.sl>-1) spec.sl=-1; if(spec.sl<-15) spec.sl=-15;
  var pi=sp.period==='2y'?1:sp.period==='all'?2:0, PL=TFCOPY.intakeOpt.period;
  t.cloneFrom=null; t.followId=null; t.pendingP=null; t.cur=null; t.score=0; t.workDone=false; t.aiSpec=spec;
  t.intake={asset:{i:0,label:a},assetInfo:tfAssetLookup(a),style:{i:1,label:'AI 설계'},budget:{i:1,label:TFCOPY.intakeOpt.budget[1][0]},period:{i:pi,label:PL[pi][0]},stop:{i:0,label:spec.sl+'%까지'}};
  t.qi=TF_QS.length; t.stage='ready'; tfSave();
  TAI.nn=(TAI.nn||0)+1; var id='tfai'+Date.now().toString(36)+TAI.nn;
  var dep={52:'조금 밀렸다가',44:'적당히 밀렸다가',38:'크게 밀렸다가'}[spec.rsiTh]||'밀렸다가';
  var row=function(k,v){ return '<div class="r"><span class="k">'+k+'</span><span class="v">'+v+'</span></div>'; };
  var html='<div class="tf-sum" id="'+id+'"><div class="h">'+gEsc(spec.name||a+' 전략')+'</div><div class="rows">'
    +row('자산',gEsc(a))
    +row('사는 때',dep+' 하루 0.5% 넘게 반등한 날'+(spec.tf?', 방향이 뚜렷할 때만':'')+(spec.fng!=null?', 공포 탐욕 지수 '+spec.fng+' 이하일 때만':''))
    +row('파는 때',(spec.tp!=null?'+'+spec.tp+'% 오르거나 ':'')+spec.sl+'% 내리면, 또는 25일이 지나면')
    +row('돌려 볼 기간',gEsc(PL[pi][0]))
    +'</div><div style="font-size:11.5px;color:var(--gt3);line-height:1.7;margin:-4px 0 13px">실제 일봉 시세로 하루씩 다시 돌려요. 살 때와 팔 때마다 수수료 0.1%를 빼요.</div>'
    +'<button class="tf-btn p" onclick="tfVerifyGo(\\''+id+'\\')">과거로 돌려 보기</button></div>';
  taiThreadAdd(html); gScrollBottom();
}
function tfIntakeDone(){`],
  // 질문 카드를 다시 시작하거나 새로 시작하면 AI 전략서는 버린다
  ["  var t=tfS(); t.intake={}; t.qi=0; t.stage='intake'; if(t.cur&&t.cur.sig){","  var t=tfS(); t.intake={}; t.qi=0; t.stage='intake'; t.aiSpec=null; if(t.cur&&t.cur.sig){"],
  ["  t.intake={}; t.qi=0; t.tries=[]; t.cur=null; t.score=0; t.stage='intake'; t.workDone=false; t.plan=null;","  t.intake={}; t.qi=0; t.tries=[]; t.cur=null; t.score=0; t.stage='intake'; t.workDone=false; t.plan=null; t.aiSpec=null;"],
]);
console.log('ok');
