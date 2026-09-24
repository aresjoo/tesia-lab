import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const driver=process.env.CDP_DRIVER||'C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs';
const {newPage,closePage,goto,evala,viewport,sleep,shot}=await import(pathToFileURL(driver).href);
const mode=process.argv[2]||'all';
const output=process.env.CODEX_QA_OUT||'ux/shots/codex-fix';
fs.mkdirSync(output,{recursive:true});
// These journeys replace local mock state. Use the dedicated localhost:8781 audit origin.

if(mode==='matrix'||mode==='all'){
const out=output;fs.mkdirSync(out,{recursive:true});
const c=await newPage(), errors=[], results=[];c.on('Runtime.exceptionThrown',p=>errors.push(p.exceptionDetails));
await goto(c,'http://localhost:8781/?v='+Date.now(),1200);
const snap=`(()=>{const root=document.getElementById('g-content'),text=root.innerText,d=tfDerive(),scroll=document.getElementById('g-scroll');const vis=e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;return {mode:G.mode,hash:location.hash,nf:TF_ONNF,share:TF_ONSHARE,d,text,primary:[...root.querySelectorAll('.pri,.tx-cta,.cx-pri,.ac-btn.p')].filter(vis).map(e=>e.innerText),ac:!!root.querySelector('.tx-ac'),hscroll:Math.max(document.documentElement.scrollWidth-innerWidth,scroll.scrollWidth-scroll.clientWidth,root.scrollWidth-root.clientWidth),banned:(text.replace(/Bitget UID/g,'').match(/UID|Fast API|PRO|크레딧|소진|업그레이드|위임|체험 모드|카피하기|복제하기|생각의 사슬|·|—/g)||[]),firstCard:root.querySelector('.mk-card')?.getBoundingClientRect().toJSON()};})()`;
for(const w of [1440,390]){
 await viewport(c,w,w===390?844:900,{mobile:w===390});
 for(let i=1;i<=11;i++){
  const id=String(i).padStart(2,'0');await evala(c,`closeModal('modal-auth');tfQaPreset('${id}');`);
  for(const [name,expr] of [['trade',"tfNav('#/trade')"],['plan',"tfNav('#/plan')"],['brokers','tfBrokersView()'],['market',"tfShareHub('find')"]]){
   await evala(c,expr);await sleep(120);let r=await evala(c,snap);r={w,id,name,...r};r.failures=[];
   if(r.d.stateId!==i) r.failures.push('stateId');
   if(r.hscroll>0) r.failures.push('horizontal overflow');
   if(r.banned.length) r.failures.push('forbidden copy');
   if(name==='trade'){
    if(r.mode!==(i===1?'tfintro':'tfinactive'))r.failures.push('trade mode');
    if(!r.primary.some(t=>t.includes(r.d.primaryCTA.label)))r.failures.push('primary CTA');
    if(i>1&&r.ac!==(r.d.activation.api==='none'&&r.d.activation.card==='none'))r.failures.push('activation card');
    if(i>1&&!r.text.includes(r.d.statusLine))r.failures.push('status line');
   }
   if(name==='plan'&&i>1&&!r.text.includes(r.d.bill.line))r.failures.push('billing line');
   if(name==='brokers'&&r.d.activation.api==='done'&&(!r.text.includes('Bitget 연결됨')||!r.text.includes('첫 전략 실행하기')))r.failures.push('connected broker');
   if(name==='market'&&(!r.text.includes('전체 기간 검증 수익률')||r.text.includes('팔로워 수익')))r.failures.push('market period/data');
   results.push(r);
   console.log(w,id,name,r.mode,r.hscroll?'OVERFLOW '+r.hscroll:'',r.banned.length?'BANNED '+r.banned.join(','):'');
   await shot(c,`${out}/${w}-${id}-${name}.png`,{full:false});
   await evala(c,"closeModal('modal-auth')");
  }
 }
}
fs.writeFileSync(out+'/matrix.json',JSON.stringify({errors,results},null,2));
console.log('TOTAL',results.length,'errors',errors.length,'failures',results.filter(r=>r.failures.length).length);if(errors.length||results.some(r=>r.failures.length))process.exitCode=1;
await closePage(c);c.ws.close();

}

if(mode==='journeys'||mode==='all'){
const c=await newPage(), errors=[], checks=[];c.on('Runtime.exceptionThrown',p=>errors.push(p.exceptionDetails));
await viewport(c,1440,900);const base='http://localhost:8781/';
await goto(c,base+'?v='+Date.now(),1200);
async function run(name,expression,expect){const got=await evala(c,expression);const pass=expect(got);checks.push({name,pass,got});console.log(pass?'PASS':'FAIL',name,JSON.stringify(got).slice(0,320));}
async function act(s,ms=150){await evala(c,s);await sleep(ms);}
await act("tfQaPreset('01');tfNav('#/trade')");await run('guest',"G.mode",x=>x==='tfintro');
await act("tfDevTgl('login')");await run('same trade login',"G.mode",x=>x==='tfinactive');
await act('tfTradeInactiveLaunch()',3100);await run('paper launch and toast',"({mode:G.mode,owned:tfDerive().facts.owned,env:tfS().strat[0].env,toast:document.getElementById('toast').classList.contains('show')})",x=>x.mode==='tfdash'&&x.owned===1&&x.env==='paper'&&!x.toast);
await goto(c,base+'?v='+Date.now()+'#/trade',1200);await run('paper persistence',"({mode:G.mode,owned:tfDerive().facts.owned})",x=>x.mode==='tfdash'&&x.owned===1);
await act('tfTmHalt()');await run('halt confirmation',"({live:tfTmAll()[0].status,dialog:!!document.getElementById('ss3-dlgw')})",x=>x.live==='live'&&x.dialog);
await act('tfTmHaltGo()');await run('halt stop',"tfTmAll()[0].status",x=>x==='off');
await act("tfTmSetStatus(tfTmAll()[0].key,'live');tfTmAfter()");await run('paper resume without API',"tfTmAll()[0].status",x=>x==='live');
await act("tfQaPreset('01');tfPreviewOpen();tfNFRoute('#/trade')");await run('preview isolation',"({mode:G.mode,owned:tfDerive().facts.owned,count:tfTmAll().length,src:tfTmAll().every(s=>s.src==='demo')})",x=>x.mode==='tfdash'&&x.owned===0&&x.count===6&&x.src);
await act("tfPreviewClose()");await run('preview close',"({mode:G.mode,count:tfTmAll().length})",x=>x.mode==='tfintro'&&x.count===0);
await act("tfQaPreset('02');tfNav('#/trade');tfAcSheetView('bitget',{direct:true})");
await run('inline direct form',"({view:TF_AC.view,uid:!!document.getElementById('ac-uid')})",x=>x.view==='conn'&&x.uid);
await act("document.getElementById('ac-uid').value='38291042';document.getElementById('ac-key').value='BAD123456789';document.getElementById('ac-sec').value='mocksecret123';tfAcConnect('all')",2100);
await run('partial API failure',"({uid:tfDerive().activation.uid,api:tfDerive().activation.api,rows:TF_AC.rows})",x=>x.uid==='done'&&x.api==='none'&&x.rows.api==='fail');
await act("document.getElementById('ac-key').value='mockapikey123';tfAcConnect('all')",2100);
await run('API retry keeps UID, D27 completion',"({act:tfDerive().activation,view:TF_AC.view,done:document.querySelectorAll('.ac-done').length,offset:!!document.querySelector('.ac-done .p2').textContent})",x=>x.act.uid==='done'&&x.act.api==='done'&&x.view==='done'&&x.done===1&&!x.offset);
await act('tfAcContinue()');await run('completion dismissed',"({done:document.querySelectorAll('.ac-done').length,ctx:TF_UP_CTX,resume:TF_NF_RESUME})",x=>!x.done&&!x.ctx&&!x.resume);
await goto(c,base+'?v='+Date.now()+'#/trade',1200);await run('completion not replayed on reload',"({done:document.querySelectorAll('.ac-done').length,api:tfDerive().facts.api})",x=>!x.done&&x.api);
await act("tfQaPreset('02');tfAcSheetView('bitget',{direct:true});document.getElementById('ac-uid').value='00000000';document.getElementById('ac-key').value='mockapikey123';document.getElementById('ac-sec').value='mocksecret123';tfAcConnect('all')",2100);
await run('partial UID failure',"({uid:tfDerive().activation.uid,api:tfDerive().activation.api,rows:TF_AC.rows})",x=>x.uid==='none'&&x.api==='done'&&x.rows.uid==='fail');
await act("document.getElementById('ac-uid').value='38291042';tfAcConnect('all')",2100);await run('UID retry',"TF_AC.view",x=>x==='done');await act('tfAcContinue()');
await act("tfQaPreset('02');tfAcSheet('card');tfAcGo('card');document.getElementById('tfp-num').value='4242 4242 4242 4242';document.getElementById('tfp-exp').value='12/30';document.getElementById('tfp-cvc').value='123';document.getElementById('tfp-nm').value='Mock User';tfPayCardNext();tfPayConfirm()",1600);
await run('card activates derive plan',"({plan:tfDerive().facts.plan,card:bcInit().cardOn,pay:tfS().payDone,sheet:!!document.getElementById('ac-sheet')})",x=>x.plan&&x.card&&x.pay&&!x.sheet);
await act("tfQaPreset('03');tfNav('#/share/copy/세븐틴층')",400);await run('copy deeplink sheet',"({mode:G.mode,sheet:!!document.getElementById('mk-follow')})",x=>x.mode==='tfss3d'&&x.sheet);
await act("document.getElementById('cps-amt').value='100';cpFormSync();cpStart(tfSSNe('세븐틴층'))");
await run('follow start ledger and identity',"({spot:cpState().spot,c:cpState().copies[0],mode:G.mode,tab:tfSSState().ss.tab,nick:tfSSFind('세븐틴층').nick})",x=>x.spot===900&&x.c.ledger[0].amt===100&&x.c.nick===x.nick&&x.c.status==='active'&&x.tab==='follow');
await act("tfNav('#/trade')");await run('follow-only trade matches derive',"({mode:G.mode,terminal:tfDerive().terminalMode,owned:tfDerive().facts.owned,text:document.getElementById('g-content').innerText.slice(0,400)})",x=>x.mode==='tfdash'&&x.terminal==='active');
await act('mkStopDlg(cpState().copies[0].id)');await run('stop three choices',"[...document.querySelectorAll('.mk-stop-o b')].map(e=>e.innerText)",x=>x.join(',')==='지금 정리,원본 청산 대기,직접 관리');
await run('close ledger conservation',"(()=>{const cp=cpState(),c=cp.copies[0],before=cp.spot,back=cpCalc(c).est;cpClose(c.id);const spot=cp.spot;cpClose(c.id);return {diff:spot-before-back,status:c.status,out:c.ledger.filter(e=>e.type==='out').length,again:cp.spot===spot}})()",x=>Math.abs(x.diff)<1e-8&&x.status==='closed'&&x.out===1&&x.again);
await act("tfNav('#/share/t/세븐틴층')");await run('profile redirect',"({hash:decodeURIComponent(location.hash),mode:G.mode,nick:tfSSFind('세븐틴층').nick})",x=>x.hash==='#/share/s/세븐틴층/all'&&x.mode==='tfss3d');
await act("tfNav('#/share/s/세븐틴층/1y/perf')");await run('performance deeplink',"({tab:document.querySelector('.mk-dtabs .on').innerText,kpis:document.querySelectorAll('.mk-kpis.four .mk-kpi').length,chart:!!document.getElementById('ss3-bigchart')})",x=>x.tab==='성과'&&x.kpis===4&&x.chart);
await act("tfNav('#/trade')");await run('route flags trade',"({nf:TF_ONNF,share:TF_ONSHARE})",x=>x.nf&&!x.share);
await act("tfShareHub('find')");await run('route flags market',"({nf:TF_ONNF,share:TF_ONSHARE})",x=>!x.nf&&!x.share);
await act("tfQaPreset('03');tfQaOverlay('strat');tfNav('#/trade')");await run('owned terminal no demo and correct chart',"({all:tfTmAll().map(s=>({src:s.src,tv:s.tv})),agent:document.querySelectorAll('.tm-card.agent').length,price:document.querySelector('.tm-status').innerText})",x=>x.all.length===1&&x.all[0].src==='user'&&x.all[0].tv.startsWith('BITGET:')&&x.agent===0&&x.price.includes('USDT')&&!x.price.includes('₩'));
await run('watch fold',"({n:document.querySelectorAll('.tm-fold').length,txt:document.querySelector('.tm-fold')?.innerText})",x=>x.n>0&&x.txt.includes('관망 유지'));
await act("document.querySelector('.tm-fold').click()");await run('watch expand',"document.querySelector('.tm-fold').getAttribute('aria-expanded')",x=>x==='true');
await viewport(c,390,844,{mobile:true});await act('tfDashView()');await run('mobile terminal',"({summary:document.getElementById('tm-msummary').innerText,overflow:document.documentElement.scrollWidth-innerWidth,scroll:document.getElementById('g-scroll').scrollWidth-document.getElementById('g-scroll').clientWidth})",x=>x.summary.includes('운용 ₩')&&x.summary.includes('누적')&&x.overflow<=0&&x.scroll<=0);
await shot(c,output+'/390-terminal.png',{full:false});
fs.writeFileSync(output+'/journeys.json',JSON.stringify({checks,errors},null,2));console.log('checks',checks.length,'fail',checks.filter(x=>!x.pass).length,'errors',errors.length);
if(errors.length||checks.some(x=>!x.pass))process.exitCode=1;
await closePage(c);c.ws.close();

}

if(mode==='extra'||mode==='all'){
const c=await newPage(),errors=[],checks=[],screens=[];c.on('Runtime.exceptionThrown',p=>errors.push(p.exceptionDetails));
await viewport(c,1440,900);const base='http://localhost:8781/';await goto(c,base+'?v='+Date.now(),1200);
async function act(s,ms=150){await evala(c,s);await sleep(ms);}
async function check(name,expr,pred){const got=await evala(c,expr),pass=pred(got);checks.push({name,got,pass});console.log(pass?'PASS':'FAIL',name,JSON.stringify(got).slice(0,320));}
async function connect(){await act("document.getElementById('ac-uid').value='38291042';document.getElementById('ac-key').value='mockapikey123';document.getElementById('ac-sec').value='mocksecret123';tfAcConnect('all')",2100);}
await act("tfQaPreset('02');tfDevTgl('strat');tfNav('#/strategy/connect')");await check('connect verified deep link',"({mode:G.mode,hash:location.hash})",x=>x.mode==='tfconnect'&&x.hash==='#/strategy/connect');
await sleep(600);await goto(c,base+'?v='+Date.now()+'#/strategy/connect',1200);await check('connect reload',"G.mode",x=>x==='tfconnect');
await act("tfNav('#/trade')");await act("tfNav('#/plan/rebates')");await check('rebates deep link',"({mode:G.mode,hash:location.hash,text:document.getElementById('g-content').innerText})",x=>x.mode==='nfplan'&&x.text.includes('누적 적립'));
await act('history.back()',400);await check('back to trade',"({mode:G.mode,hash:location.hash})",x=>x.mode==='tfinactive'&&x.hash==='#/trade');
await act("tfQaPreset('02');tfTradeInactiveLaunch();tfS().strat[0].env='live';tfS().strat[0].status='off';window.TF_NF_RESUME={id:String(tfS().strat[0].at),act:'resume'};tfAcSheetView('bitget',{direct:true})");await connect();await act('tfAcContinue()');await check('NF_RESUME restores same bot',"({resume:TF_NF_RESUME,status:tfS().strat[0].status,owned:tfS().strat.length})",x=>x.resume===null&&x.status==='live'&&x.owned===1);
await act("tfAcSheet('bitget');tfAcGo('bitget')");await check('existing connection no second completion',"document.querySelectorAll('.ac-done').length",x=>x===0);
await act("tfQaPreset('02');tfShareHub('find');cpSetupGo(tfSSNe('세븐틴층'));document.getElementById('cps-amt').value='123';tfMkActivate();tfAcGo('bitget')");await connect();await act('tfAcContinue()');await check('UP_CTX follow restores sheet budget',"({ctx:TF_UP_CTX,sheet:!!document.getElementById('mk-follow'),amount:document.getElementById('cps-amt')?.value,enabled:!document.getElementById('cps-cta')?.disabled})",x=>x.ctx===null&&x.sheet&&x.amount==='123'&&x.enabled);
await act("cpStart(tfSSNe('세븐틴층'));tfNav('#/trade')");await act('tfTmHalt()');await check('follow emergency confirmation',"document.getElementById('ss3-dlgw').innerText",x=>x.includes('1개'));await act('tfTmHaltGo()');await check('follow emergency settles once',"({status:cpState().copies[0].status,owned:tfDerive().facts.owned,out:cpState().copies[0].ledger.filter(e=>e.type==='out').length})",x=>x.status==='closed'&&x.owned===0&&x.out===1);
await act("tfQaPreset('03');tfTradeInactiveLaunch();tfShareHub('find');cpSetupGo(tfSSNe('세븐틴층'));document.getElementById('cps-amt').value='100';cpStart(tfSSNe('세븐틴층'));tfNav('#/trade')");await check('mixed terminal separate units',"({owned:tfDerive().facts.owned,rule:tfTmAll().length,follow:document.querySelector('.tm-follow')?.innerText})",x=>x.owned===2&&x.rule===1&&x.follow.includes('100.00 USDT'));await act('tfTmHaltGo()');await check('mixed emergency all stopped',"({rule:tfTmAll()[0].status,follow:cpState().copies[0].status})",x=>x.rule==='off'&&x.follow==='closed');
await act("tfQaPreset('03');tfQaOverlay('strat');tfQaOverlay('logs');tfNav('#/trade')");await check('QA fixture only overlay',"({n:document.querySelectorAll('.tm-card.agent').length,text:document.getElementById('g-content').innerText})",x=>x.n===2&&x.text.includes('QA 예시, 시뮬레이션'));
await act("tfQaOverlay('logs');tfNav('#/trade')");await check('normal rule fixture absent',"document.querySelectorAll('.tm-card.agent').length",x=>x===0);
for(const w of [1440,390]){
 await viewport(c,w,w===390?844:900,{mobile:w===390});
 for(const [name,expr] of [['terminal',"tfNav('#/trade')"],['perf',"tfNav('#/share/s/세븐틴층/all/perf')"],['broker',"tfBrokerView('bitget')"],['rebates',"tfNav('#/plan/rebates')"],['follow',"tfNav('#/share/copy/세븐틴층')"]]){
  await act(expr,350);const got=await evala(c,`(()=>{const root=document.getElementById('g-content'),sc=document.getElementById('g-scroll'),text=root.innerText;return {mode:G.mode,nf:TF_ONNF,share:TF_ONSHARE,overflow:Math.max(document.documentElement.scrollWidth-innerWidth,sc.scrollWidth-sc.clientWidth),banned:text.replace(/Bitget UID/g,'').match(/UID|Fast API|PRO|크레딧|소진|업그레이드|위임|체험 모드|카피하기|복제하기|생각의 사슬|·|—/g)||[]}})()`);screens.push({w,name,...got});console.log('SCREEN',w,name,got.overflow,got.banned.join(','));await shot(c,`${output}/${w}-extra-${name}.png`,{full:false});await act('mkFollowClose(true)');
 }
}
fs.writeFileSync(output+'/extra.json',JSON.stringify({checks,errors,screens},null,2));console.log('checks',checks.length,'failed',checks.filter(x=>!x.pass).length,'errors',errors.length);
if(errors.length||checks.some(x=>!x.pass))process.exitCode=1;
await closePage(c);c.ws.close();

}
