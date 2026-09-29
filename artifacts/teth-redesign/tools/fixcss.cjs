const fs=require('fs'); let s=fs.readFileSync('rd.css','utf8');
function rep(a,b){ if(s.split(a).length!==2) throw new Error('anchor '+a.slice(0,50)); s=s.replace(a,()=>b); }
rep(".mk3-head h3{margin:0;min-width:0;font-size:17px;",".mk3-head h3{margin:0;min-width:0;font-size:18px;");
rep("#g-root .mk3 .mk3-t{display:block;font-size:17px;","#g-root .mk3 .mk3-t{display:block;font-size:18px;");
rep(".mk3-how{display:flex;align-items:baseline;gap:8px;margin:12px 0 0;font-size:12.5px;",".mk3-how{display:flex;align-items:baseline;gap:8px;margin:12px 0 0;font-size:13.5px;");
rep("#g-root .mk3 .mk3-ret b{font-size:17px;","#g-root .mk3 .mk3-ret b{font-size:16px;");
rep(".mk3 .mk-spark{width:72px;height:26px;flex:none;opacity:.8}",".mk3 .mk-spark{width:72px;height:26px;flex:none;opacity:.85}\n.mk3 .mk-spark path[fill^=\"url\"]{display:none}");
rep("#g-root .mk3 .mk3-stats{margin:10px 0 0;padding:10px 0 0;","#g-root .mk3 .mk3-stats{margin:16px 0 0;padding:12px 0 0;");
rep(".mk3-b{height:36px;padding:0 14px;",".mk3-b{height:36px;width:80px;padding:0;");
rep(".mk3-bar{display:block}",".mk3-bar{display:block}\n.mk3-kindrow{display:flex;align-items:center;gap:18px;margin:0 0 14px;flex-wrap:wrap}");
rep(".mk3-kindhelp{margin:10px 0 14px;",".mk3-kindhelp{margin:0;flex:1;min-width:260px;");
rep(".mk3-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}",".mk3-two{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px}\n.mk3-nowh{display:flex;align-items:baseline;justify-content:space-between;gap:12px}\n.mk3-nowp{border-color:rgba(255,255,255,.22)}\n.mk3-gauge{position:relative;display:block;height:2px;margin:12px 0 6px;background:rgba(255,255,255,.16);border-radius:2px;max-width:280px}\n.mk3-gauge u{position:absolute;top:-6px;width:1.5px;height:14px;background:#e9ebee;text-decoration:none}\n.mk3-gauge i{position:absolute;top:-4px;width:10px;height:10px;margin-left:-5px;border-radius:50%;background:#131517;border:2px solid #e9ebee}\n.mk3-gauge-t{display:block;font-size:12.5px;color:var(--gt3)}\n.mk3-since{margin:14px 0 0;font-size:12.5px;color:var(--gt3)}");
rep(".mk3-asof{margin:12px 0 0;font-size:12px;color:var(--gt3)}",".mk3-asof{font-size:12px;color:var(--gt3)}");
rep(".mk3-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));",".mk3-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));");
rep("  .mk3-dh-acts .mk-pri{flex:1;min-width:0}","  .mk3-dh-acts{flex-wrap:wrap}\n  .mk3-dh-acts .mk-pri{flex:0 0 120px;min-width:0;height:44px;padding:0}\n  .mk3-dh-meta{order:3;flex:0 0 100%;margin:4px 0 0}\n  #g-root .mk3 .mk3-one{min-height:0}\n  .mk3-b{height:44px}\n  .mk3-kindrow{gap:10px}");
fs.writeFileSync('rd.css',s); console.log('css ok');
