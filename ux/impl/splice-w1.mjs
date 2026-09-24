import fs from 'node:fs'; import vm from 'node:vm';
const F='index.html';
let src=fs.readFileSync(F,'utf8');
const lines=src.split('\n');
const s=lines.findIndex(l=>l.startsWith('/* ── 데모 상태 조작 패널 (QA) — UI 분기 상태 토글'));
const e=lines.findIndex((l,i)=>i>s&&l.startsWith('/* 구버전(채팅 스택형) 카드 호환'));
if(s<0||e<0) throw new Error('anchors not found '+s+' '+e);
const w1=fs.readFileSync('ux/impl/w1-foundation.js','utf8').replace(/\r\n/g,'\n');
lines.splice(s,e-s,...w1.split('\n'));
src=lines.join('\n');
// CSS anchors + QA css before </style>
const css=`/* ══ W1: QA 실험실 ══ */
#tf-devpanel{width:330px;max-height:calc(100vh - 120px);overflow:auto;padding:12px 12px 10px}
#tf-devpanel .qa-sec{margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08)}
#tf-devpanel .qa-st{font-size:10.5px;font-weight:700;letter-spacing:.06em;color:rgba(255,255,255,.4);margin-bottom:6px}
#tf-devpanel .qa-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}
#tf-devpanel .qa-pre{text-align:left;font-size:11px;line-height:1.3;padding:6px 7px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:var(--gt2);cursor:pointer;font-family:inherit}
#tf-devpanel .qa-pre:hover{background:rgba(255,255,255,.07);color:#fff}
#tf-devpanel .qa-pre.on{border-color:#c8f43c;color:#c8f43c;background:rgba(200,244,60,.08)}
#tf-devpanel .qa-expect{font-size:11px}
#tf-devpanel .qa-row{display:grid;grid-template-columns:52px 1fr;gap:2px 8px;padding:4px 0;border-bottom:1px dashed rgba(255,255,255,.06)}
#tf-devpanel .qa-row span{color:rgba(255,255,255,.4)}
#tf-devpanel .qa-row b{color:var(--gt);font-weight:600;grid-column:2}
#tf-devpanel .qa-row i{color:rgba(255,255,255,.35);font-style:normal;grid-column:2;font-size:10.5px}
#tf-devpanel .qa-row i:before{content:'기대: '}
#tf-devpanel .qa-pf{display:flex;gap:6px;margin-top:8px}
#tf-devpanel .qa-pf button{flex:1;height:28px;border-radius:7px;border:1px solid rgba(255,255,255,.14);background:transparent;color:var(--gt2);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit}
#tf-devpanel .qa-pf button.on{background:rgba(78,192,141,.18);color:var(--gg);border-color:rgba(78,192,141,.4)}
#tf-devpanel .qa-pf button.on.fail{background:rgba(238,118,106,.18);color:#ee766a;border-color:rgba(238,118,106,.4)}
#tf-devpanel .qa-prow{display:flex;justify-content:space-between;align-items:center;width:100%;padding:5px 6px;border:0;background:none;border-radius:7px;cursor:pointer;font-family:inherit;color:var(--gt2);font-size:11.5px}
#tf-devpanel .qa-prow:hover{background:rgba(255,255,255,.06)}
#tf-devpanel .qa-prow em{font-style:normal;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:999px;background:rgba(255,255,255,.07);color:rgba(255,255,255,.45)}
#tf-devpanel .qa-prow.s-IN_REVIEW em{background:rgba(96,165,250,.18);color:#8fbcff}
#tf-devpanel .qa-prow.s-PASS em{background:rgba(78,192,141,.18);color:var(--gg)}
#tf-devpanel .qa-prow.s-FAIL em{background:rgba(238,118,106,.18);color:#ee766a}
#tf-devpanel details.qa-adv{margin-top:10px;border-top:1px solid rgba(255,255,255,.08);padding-top:6px}
#tf-devpanel details.qa-adv summary{cursor:pointer;font-size:11px;color:rgba(255,255,255,.4);padding:4px 0}
.tf-kind{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.02em;padding:2px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.14);color:var(--gt2);vertical-align:middle}
.tf-kind-agent{color:#c8f43c;border-color:rgba(200,244,60,.4)}
.tf-kind-follow{color:#8fbcff;border-color:rgba(143,188,255,.4)}
.tf-kind-sub{color:rgba(255,255,255,.45);border-style:dashed}
/* ==CSS:tx== */
/* ==CSS:ac== */
/* ==CSS:mk== */
/* ==CSS:cx== */
/* ==CSS:tm== */
`;
src=src.replace('\n</style>', '\n'+css+'</style>');
fs.writeFileSync(F,src);
// syntax check inline scripts
const re=/<script>([\s\S]*?)<\/script>/g; let m,i=0;
while((m=re.exec(src))){ i++; try{ new vm.Script(m[1],{filename:'inline'+i}); console.log('script',i,'ok',m[1].length); }catch(err){ console.log('script',i,'SYNTAX ERROR',err.message); const ln=(err.stack.match(/inline\d+:(\d+)/)||[])[1]; console.log(' at line',ln); if(ln){ const L=m[1].split('\n'); console.log(L.slice(ln-3,ln+2).join('\n')); } } }
console.log('spliced', s, e, 'total lines', src.split('\n').length);
