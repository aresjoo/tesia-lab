const fs=require('fs'); let s=fs.readFileSync('apply2.cjs','utf8');
const a="function rep(a,b,opt){ a=nl(a); b=nl(b); const n=t.split(a).length-1;"; if(!s.includes(a)) throw new Error('rep');
s=s.replace(a,"function rep(a,b,opt){ a=nl(a); b=nl(b); if(opt&&t.includes(b)) return; const n=t.split(a).length-1;");
// 5c 와 5f 를 한 단계로
const c1=s.indexOf('// 5c.'), c2=s.indexOf('// 5d.'); const f1=s.indexOf('// 5f.'), f2=s.indexOf('// 5g.');
const merged="// 5c. 가격 캐시 키: 설정, 길이, 데이터 버전\nif(!t.includes(\"(window.MK_DATA_V||''); if(MK_PXC[ck]) return MK_PXC[ck];\")){\n  t=t.replace(/  (?:if\(MK_PXC\[key\]\) return MK_PXC\[key\];\r\n  var c=\(window\.MK_PX_CFG\|\|\{\}\)\[key\]; if\(!c\) return PRICE0;|var c=\(window\.MK_PX_CFG\|\|\{\}\)\[key\]; if\(!c\) return PRICE0;\r\n  var ck=key\+'\|'\+c\.join\('\/'\); if\(MK_PXC\[ck\]\) return MK_PXC\[ck\];)/,\"  var c=(window.MK_PX_CFG||{})[key]; if(!c) return PRICE0;\r\n  var ck=key+'|'+c.join('/')+'|'+PRICE0.length+'|'+(window.MK_DATA_V||''); if(MK_PXC[ck]) return MK_PXC[ck];\");\n  t=t.replace('  return (MK_PXC[key]=p);','  return (MK_PXC[ck]=p);');\n  if(!t.includes(\"(window.MK_DATA_V||''); if(MK_PXC[ck]) return MK_PXC[ck];\")) throw new Error('px cache');\n}\n";
s=s.slice(0,f1)+s.slice(f2); s=s.slice(0,c1)+merged+s.slice(c2);
fs.writeFileSync('apply2.cjs',s); console.log('ok');
