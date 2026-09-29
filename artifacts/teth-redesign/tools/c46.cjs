// F01: 입력한 번호(uidIn)와 확인된 번호(uid)를 나눈다. 번호가 바뀌거나 확인에 실패하면 그 계정에 딸린 확인과 연결은 무효가 된다
const fs=require('fs'), D=__dirname+'/';
const rep=(s,x,y,n)=>{ const c=s.split(x).length-1; if(c!==(n||1)) throw new Error('x'+c+': '+x.slice(0,70)); return s.split(x).join(y); };
let g=fs.readFileSync(D+'bt-go.js','utf8');
g=rep(g,"flow={step:'pick',path:null,ex:null,uid:'',has:1,joined:0,card:null,api:null,okUid:0}; return t.bt.flow; }",
"flow={step:'pick',path:null,ex:null,uid:'',uidIn:'',has:1,joined:0,card:null,api:null,okUid:0}; return t.bt.flow; }\n/* 계정이 달라지면 그 계정으로 했던 확인과 연결을 무효로 한다. 입력해 둔 번호는 칸에 남긴다 */\nfunction btInval(f){ var t=tfS(); if(f.uid&&!f.uidIn) f.uidIn=f.uid; f.uid=''; f.okUid=0; if(f.api){ f.api=null; t.conn=false; } t.uidLinked=false; }");
g=rep(g,"function btDoneK(k){ var f=btF(); return k==='pick'?!!f.path:k==='uid'?!!f.okUid:k==='api'?!!f.api:!!f.card; }",
"function btDoneK(k){ var f=btF(); return k==='pick'?!!f.path:k==='uid'?!!(f.okUid&&f.uid):k==='api'?!!(f.api&&(f.path!=='partner'||(f.okUid&&f.uid))):!!f.card; }");
g=rep(g,"var f=btF(); if(f.step==='done'&&!f.api) f.step='pick';","var f=btF(); if(f.step==='done'&&btGoNextStep()!=='done') f.step=f.path?btGoNextStep():'pick';");
g=rep(g,"if(f.path!==k){ f.okUid=0; f.api=null; f.card=null; f.ex=null; f.uid=''; f.joined=0; f.has=1; }","if(f.path!==k){ btInval(f); f.api=null; f.card=null; f.ex=null; f.uidIn=''; f.joined=0; f.has=1; }");
g=rep(g,"if(btExOf(f)===e) return; f.ex=e; f.okUid=0; f.api=null; f.joined=0; tfSave(); btGoRe(); }","if(btExOf(f)===e) return; f.ex=e; btInval(f); f.api=null; f.uidIn=''; f.joined=0; tfSave(); btGoRe(); }");
g=rep(g,"'예: 38291042',f.uid,","'예: 38291042',f.uidIn||f.uid,");
g=rep(g,"var f=btF(), ex=btExOf(f), nm=btExName(ex); f.uid=v; tfSave();","var f=btF(), ex=btExOf(f), nm=btExName(ex); if(v!==f.uid) btInval(f); f.uidIn=v; tfSave();");
g=rep(g,"if(btExOf(g)!==ex) return; g.okUid=1; g.step=btGoNextStep();","if(btExOf(g)!==ex||g.uidIn!==v) return; g.uid=v; g.uidIn=''; g.okUid=1; g.step=btGoNextStep();");
g=rep(g,"function(x){\n    btErr('btg-uid',x.err);","function(x){\n    var g=btF(); btInval(g); tfSave();\n    btErr('btg-uid',x.err);");
g=rep(g,"function btToOwn(){ var f=btF(); f.path='own'; f.okUid=0; f.api=null; f.step='api'; tfSave(); btGoRe(); }","function btToOwn(){ var f=btF(); btInval(f); f.api=null; f.path='own'; f.step='api'; tfSave(); btGoRe(); }");
// 연결 완료 기록에는 확인된 번호만 남긴다
g=rep(g,"uid:g.uid||t.uid||'',err:null}","uid:g.path==='partner'?g.uid:'',err:null}");
fs.writeFileSync(D+'bt-go.js',g);
console.log('go ok');
