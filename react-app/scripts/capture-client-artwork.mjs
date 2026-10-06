/** Offline, create-only source-artwork capture. No current account or API.
 * node scripts/capture-client-artwork.mjs <loopback-baseURL> <new-output> ko
 * A foreign run requires the successful KO receipt, never overwrites originals. */
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
if(process.argv[2]==='install'||process.argv[2]==='replace'){
 const replacing=process.argv[2]==='replace'
 const receiptPath=path.resolve(process.argv[3]??'')
 if(!receiptPath.startsWith('/home/beak1/workspaces/active/TETH/.cache/frontend-parity-audit/'))throw Error('Private capture receipt required')
 const receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8')),directory=path.dirname(receiptPath)
 const hash=b=>createHash('sha256').update(b).digest('hex')
 const langs=['en','ja','zh-CN','zh-TW','es','fr'],ids=['about-plan2','dl-chat','about-backtest2','dl-report','about-connect','about-brain','dl-live','about-live']
 if(receipt.status!=='PASS'||!receipt.originalsUnchanged||receipt.captures.length!==48||receipt.blocked.length||receipt.errors.length)throw Error('Complete 48-image proof required')
 for(const [file,sha] of Object.entries(receipt.inputs))if(hash(fs.readFileSync(path.join(root,file)))!==sha)throw Error('Capture inputs changed')
 for(const [file,sha] of Object.entries(receipt.original))if(hash(fs.readFileSync(path.join(root,'public/client-shots',file)))!==sha)throw Error('Original KO artwork changed')
 const manifestPath=path.join(root,'tests/fixtures/client-artwork-provenance.json')
 const previousPath=replacing?path.resolve(process.argv[4]??''):null
 if(replacing&&(!previousPath.startsWith('/home/beak1/workspaces/active/TETH/.cache/frontend-parity-audit/')||previousPath===receiptPath))throw Error('Separate preserved previous receipt required')
 const previous=replacing?JSON.parse(fs.readFileSync(previousPath,'utf8')):null
 const installed=replacing?JSON.parse(fs.readFileSync(manifestPath,'utf8')):null
 if(replacing&&(previous.status!=='PASS'||previous.captures.length!==48||installed.captures.length!==48))throw Error('Exact previous 48-image set required')
 if(!replacing&&fs.existsSync(manifestPath))throw Error('Create-only provenance required')
 const prepared=[],seen=new Set()
 for(const c of receipt.captures){
  const key=c.id+':'+c.language
  if(!langs.includes(c.language)||!ids.includes(c.id)||seen.has(key)||c.webp!==c.id+'.'+c.language+'.webp'||c.encoding?.differentBytes!==0||c.id==='about-live'&&c.frozenPlot?.differentBytes!==0)throw Error('Invalid capture identity or pixel proof')
  seen.add(key)
  const bytes=fs.readFileSync(path.join(directory,c.webp)),destination=path.join(root,'public/client-shots/localized',c.language,c.id+'.webp')
  if(hash(bytes)!==c.webpSHA)throw Error('Changed capture')
  if(replacing){
   const old=previous.captures.find(p=>p.id===c.id&&p.language===c.language),was=installed.captures.find(p=>p.id===c.id&&p.language===c.language)
   if(!old||!was||was.sha256!==old.webpSHA||hash(fs.readFileSync(destination))!==old.webpSHA)throw Error('Previous derived asset CAS mismatch')
  }else if(fs.existsSync(destination))throw Error('Existing destination')
  if(c.id==='dl-report'&&(c.geometry.keyMetrics?.length!==5||c.geometry.keyMetrics.some(m=>!m.visible||m.fontSize<13)))throw Error('Visible mobile financial values required')
  if(c.geometry.sourceVisibleContent?.some(m=>!m.visible))throw Error('Source-visible content clipped')
  prepared.push({bytes,destination,c})
 }
 if(replacing){const archive=path.join(directory,'previous-installed-provenance.json');fs.writeFileSync(archive,fs.readFileSync(manifestPath),{flag:'wx'})}
 for(const {bytes,destination} of prepared){fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes,{flag:replacing?'w':'wx'})}
 const provenance={version:2,sourceSha:receipt.sourceSha,scope:receipt.scope,originalPixelParity:false,actualAppEquivalence:false,apiRequests:0,accountMutations:0,original:receipt.original,inputs:receipt.inputs,
  previousReceiptSHA:replacing?hash(fs.readFileSync(previousPath)):null,
  visibleExcerpt:{shot:'dl-live',source:'/client-shots/dl-live.webp',timestamp:'09/22 08:00:42',text:'ADA를 신규 매수했습니다.',translationSource:'src/client-catalogue-judgment-locale-copy.json:ADA를 신규 매수했습니다.',unseenValuesReconstructed:false},
  translation:{model:'claude-sonnet-5-5',profile:'personal (1)',independentApproval:false},
  chartPreservation:'about-live financial plot pixels are the original bitmap, not live/recomputed OHLC; all WebP files losslessly preserve their PNG captures',
  captures:prepared.map(({c})=>({id:c.id,language:c.language,url:'/client-shots/localized/'+c.language+'/'+c.id+'.webp',width:c.width*c.dpr,height:c.height*c.dpr,sha256:c.webpSHA,bytes:c.webpBytes,encoding:c.encoding,frozenPlot:c.frozenPlot,equitySHA:c.equitySHA,benchmarkSHA:c.benchmarkSHA,metrics:c.metrics,keyMetrics:c.geometry.keyMetrics,sourceVisibleContent:c.geometry.sourceVisibleContent})),
 }
 fs.writeFileSync(manifestPath,JSON.stringify(provenance,null,2)+'\n',{flag:replacing?'w':'wx'})
 console.log(JSON.stringify({installed:prepared.length,bytes:prepared.reduce((n,p)=>n+p.bytes.length,0),originalsUnchanged:true,provenance:'tests/fixtures/client-artwork-provenance.json'}));process.exit(0)
}
const [baseURL,output,localeList='ko',proof]=process.argv.slice(2)
const endpoint=new URL(baseURL)
if(endpoint.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname)||endpoint.origin!==baseURL||!endpoint.port||Number(endpoint.port)<1024||endpoint.username||endpoint.password)throw Error('Explicit loopback test server required')
if(!output||fs.existsSync(output)||path.resolve(output)===root||['src','public','node_modules','.git'].some(dir=>path.resolve(output).startsWith(path.join(root,dir)+path.sep)))throw Error('Create-only isolated test output required')
const locales=localeList.split(','),known=['ko','en','ja','zh-CN','zh-TW','es','fr']
if(new Set(locales).size!==locales.length||locales.some(l=>!known.includes(l)))throw Error('Explicit known locales only')
if(locales.some(l=>l!=='ko')){const p=JSON.parse(fs.readFileSync(proof,'utf8'));if(p.status!=='PASS'||p.captures.length!==8||p.captures.some(c=>c.language!=='ko'))throw Error('Matching KO proof required')}
const shots=[
 {id:'about-plan2',file:'about/about-plan2.webp',width:844,height:517,dpr:2},
 {id:'dl-chat',file:'dl-chat.webp',width:390,height:844,dpr:2},
 {id:'about-backtest2',file:'about/about-backtest2.webp',width:1216,height:700,dpr:2},
 {id:'dl-report',file:'dl-report.webp',width:390,height:844,dpr:2},
 {id:'about-connect',file:'about/about-connect.webp',width:900,height:640,dpr:1},
 {id:'about-brain',file:'about/about-brain.webp',width:392,height:560,dpr:2},
 {id:'dl-live',file:'dl-live.webp',width:390,height:844,dpr:2},
 {id:'about-live',file:'about/about-live.webp',width:1376,height:900,dpr:1},
]
const hash=data=>createHash('sha256').update(data).digest('hex')
const original=Object.fromEntries(['dl-chat.webp','dl-report.webp','dl-live.webp','about/about-plan2.webp','about/about-backtest2.webp','about/about-connect.webp','about/about-live.webp','about/about-brain.webp'].map(file=>[file,hash(fs.readFileSync(path.join(root,'public/client-shots',file)))]))
const inputFiles=['tests/fixtures/client-artwork-capture.tsx','tests/fixtures/client-artwork-copy.json','scripts/capture-client-artwork.mjs','src/client-catalogue-source.json','src/client-catalogue-spot-data.json','src/client-catalogue-futures-data.json','src/client-catalogue.ts','src/client-catalogue-snapshot.ts','src/client-catalogue-market-data.ts','src/client-catalogue-futures-engine.ts','src/client-catalogue-spot-engine.ts','src/client-catalogue-ledger.ts','src/client-catalogue-backtest-result.ts','src/client-catalogue-backtest.ts','src/client-catalogue-presentation.ts','src/components/ClientStrategyGlyph.tsx','src/client-connection-plan.ts']
const inputs=Object.fromEntries(inputFiles.map(file=>[file,hash(fs.readFileSync(path.join(root,file)))]))
inputs['src/client-catalogue-judgment-locale-copy.json']=hash(fs.readFileSync(path.join(root,'src/client-catalogue-judgment-locale-copy.json')))
if(proof){const p=JSON.parse(fs.readFileSync(proof,'utf8'));if(JSON.stringify(p.inputs)!==JSON.stringify(inputs))throw Error('KO proof input freeze mismatch')}
fs.mkdirSync(output,{recursive:true})
const captures=[],blocked=[],errors=[],startedAt=new Date().toISOString()
const browser=await chromium.launch({headless:true})
try{
 for(const language of locales)for(const shot of shots){
  const context=await browser.newContext({viewport:{width:shot.width,height:shot.height},deviceScaleFactor:shot.dpr,locale:language,timezoneId:'UTC',reducedMotion:'reduce'})
  const page=await context.newPage()
  page.on('pageerror',error=>errors.push({shot:shot.id,language,message:error.message}))
  page.on('console',message=>{if(message.type()==='error')errors.push({shot:shot.id,language,message:message.text()})})
  await page.routeWebSocket('**/*',ws=>{blocked.push({kind:'websocket',shot:shot.id});ws.close()})
  await page.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url())
   if(url.origin!==baseURL||request.method()!=='GET'||/^\/(api|auth)\//.test(url.pathname)){blocked.push({kind:'request',path:url.pathname,method:request.method()});return route.abort()}
   // Capture-only Vite transport: CSS modules still install their unchanged
   // source CSS, while HMR/telemetry never establishes a socket. Not product JS.
   if(url.pathname==='/@vite/client')return route.fulfill({contentType:'text/javascript',body:'const styles=new Map();export function createHotContext(){return {data:{},accept(){},dispose(){},prune(){},invalidate(){},on(){},off(){},send(){}}}export function updateStyle(id,css){let s=styles.get(id);if(!s){s=document.createElement("style");document.head.appendChild(s);styles.set(id,s)}s.textContent=css}export function removeStyle(id){styles.get(id)?.remove();styles.delete(id)}export function injectQuery(url){return url}'} )
   if(url.pathname==='/artwork-capture.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"></head><body><div id="fixture"></div></body></html>'})
   return route.continue()
  })
  await page.goto(baseURL+'/artwork-capture.html')
  const observation=await page.evaluate(async({shot,language})=>{
   const refresh='/@react-refresh',runtime=(await import(refresh)).default
   runtime.injectIntoGlobalHook(window);Object.assign(window,{$RefreshReg$:()=>{},$RefreshSig$:()=>v=>v,__vite_plugin_react_preamble_installed__:true})
   const fixture='/tests/fixtures/client-artwork-capture.tsx'
   return (await import(fixture)).mount(shot,language)
  },{shot:shot.id,language})
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode()))})
  const geometry=await page.evaluate(()=>{
   const root=document.querySelector('.artwork'),rect=root.getBoundingClientRect()
   const targets=[...root.querySelectorAll('.tf-sum,.r,.report-grid,.plot,.result-box,.ex-grid,.ex-grid button,.brain dl,.brain dd,.ticker,.chart-toolbar,.terminal-table nav')].map(el=>{const r=el.getBoundingClientRect();return {class:el.className.baseVal??el.className,x:r.x,y:r.y,width:r.width,height:r.height,overflow:el.scrollWidth>el.clientWidth+1}})
   const footer=root.querySelector('.mobile-cta')?.getBoundingClientRect(),bottom=footer?footer.top:innerHeight
   const metricSelectors=['.balance strong','.balance i','.result-box .profit','.result-box>p:first-of-type','.plot [data-drawdown-from] text']
   const keyMetrics=root.dataset.shot==='dl-report'?metricSelectors.map(selector=>{const el=root.querySelector(selector),r=el.getBoundingClientRect(),style=getComputedStyle(el),cx=(r.left+r.right)/2,cy=(r.top+r.bottom)/2,hit=document.elementFromPoint(cx,cy);return {selector,text:el.textContent,x:r.x,y:r.y,width:r.width,height:r.height,bottomLimit:bottom,fontSize:parseFloat(style.fontSize),visible:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=bottom&&style.visibility!=='hidden'&&style.display!=='none'&&!!hit&&(hit===el||el.contains(hit))}}):[]
   const isBrain=['about-brain','dl-live','about-live'].includes(root.dataset.shot)
   const contentSelectors=isBrain?['.brain h2','.brain .schedule',...Array.from({length:5},(_,i)=>`.brain dl>div:nth-child(${i+1})`),'.brain .thought-body','.brain h3',...(root.dataset.shot==='about-brain'?['.brain .entry:first-of-type header']:root.dataset.shot==='dl-live'?['.brain .entry:nth-of-type(1)','.brain .entry:nth-of-type(2)','.brain .entry:nth-of-type(3)']:['.brain .entry:first-of-type'])]:[]
   const sourceVisibleContent=contentSelectors.map(selector=>{const el=root.querySelector(selector),r=el.getBoundingClientRect(),brain=root.querySelector('.brain').getBoundingClientRect(),limit=Math.min(innerHeight,brain.bottom);return {selector,text:el.textContent,fontSize:parseFloat(getComputedStyle(el).fontSize),x:r.x,y:r.y,width:r.width,height:r.height,bottomLimit:limit,visible:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=limit}})
   return {width:rect.width,height:rect.height,documentOverflow:document.documentElement.scrollWidth>innerWidth+1,targets,text:root.innerText,keyMetrics,sourceVisibleContent}
  })
  if(geometry.documentOverflow||geometry.targets.some(t=>t.overflow))throw Error('Horizontal overflow: '+shot.id+'/'+language)
  if(shot.id==='dl-report'&&geometry.keyMetrics.some(m=>!m.visible||m.fontSize<13))throw Error('Mobile financial metric clipped or too small: '+language+' '+JSON.stringify(geometry.keyMetrics.filter(m=>!m.visible||m.fontSize<13)))
  if(geometry.sourceVisibleContent.some(m=>!m.visible))throw Error('Original visible brain content clipped: '+shot.id+'/'+language+' '+JSON.stringify(geometry.sourceVisibleContent.filter(m=>!m.visible)))
  if(language!=='ko'&&/[가-힣]/.test(geometry.text))throw Error('Untranslated artwork text: '+shot.id+'/'+language)
  if(shot.id==='dl-chat'||shot.id==='about-plan2'){
   if(geometry.targets.filter(t=>t.class==='r').length!==4)throw Error('Source four-row layout changed')
   for(const value of ['10','15%','5%','25','0.5%','0.1%'])if(!geometry.text.includes(value))throw Error('Missing source plan number '+value)
  }
  if(shot.id==='dl-report'||shot.id==='about-backtest2')for(const number of ['21,856','2085.6%','20,856','1,395','19,461','-45.0%','-58.4%','79'])if(!geometry.text.includes(number))throw Error('Missing original f1 metric '+number)
  const png=await page.screenshot({animations:'disabled',caret:'hide',scale:'device'})
  let frozenPlot=null
  if(shot.id==='about-live'){
   frozenPlot=await page.evaluate(async data=>{
    const original=document.querySelector('.source-price-plot>img'),captured=new Image();captured.src=data;await captured.decode()
    const roi={x:330,y:290,width:565,height:405},read=image=>{const c=document.createElement('canvas');c.width=roi.width;c.height=roi.height;const ctx=c.getContext('2d');ctx.drawImage(image,roi.x,roi.y,roi.width,roi.height,0,0,roi.width,roi.height);return ctx.getImageData(0,0,roi.width,roi.height).data}
    const a=read(original),b=read(captured);let different=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])different++
    return {roi,comparedBytes:a.length,differentBytes:different,source:'/client-shots/about/about-live.webp',method:'unscaled source image CSS crop; fixed text labels outside checked ROI'}
   },'data:image/png;base64,'+png.toString('base64'))
   if(frozenPlot.differentBytes!==0)throw Error('Original plot pixels changed')
  }
  const filename=shot.id+'.'+language+'.png';fs.writeFileSync(path.join(output,filename),png,{flag:'wx'})
  const conversion=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-protocol_whitelist','pipe','-i','pipe:0','-frames:v','1','-c:v','libwebp','-lossless','1','-compression_level','6','-pix_fmt','bgra','-threads','1','-f','webp','pipe:1'],{input:png,maxBuffer:16*1024*1024})
  if(conversion.status!==0)throw Error('Lossless WebP conversion failed')
  const encoded=conversion.stdout
  const encoding=await page.evaluate(async({a,b})=>{
   const decode=async src=>{const image=new Image();image.src=src;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,image.width,image.height).data}
   const original=await decode(a),webp=await decode(b);let different=0;for(let i=0;i<original.length;i++)if(original[i]!==webp[i])different++
   return {codec:'libwebp-lossless',comparedBytes:original.length,differentBytes:different}
  },{a:'data:image/png;base64,'+png.toString('base64'),b:'data:image/webp;base64,'+encoded.toString('base64')})
  if(encoding.differentBytes!==0)throw Error('WebP did not preserve captured pixels')
  const encodedName=shot.id+'.'+language+'.webp';fs.writeFileSync(path.join(output,encodedName),encoded,{flag:'wx'})
  captures.push({...shot,language,filename,webp:encodedName,pngSHA:hash(png),webpSHA:hash(encoded),webpBytes:encoded.length,encoding,geometry,metrics:observation.metrics,equitySHA:hash(JSON.stringify(observation.equity)),benchmarkSHA:hash(JSON.stringify(observation.benchmark)),calculationSha:observation.calculationSha,frozenPlot})
  await context.close()
 }
 if(blocked.length||errors.length)throw Error('Blocked request or browser error observed')
}catch(error){errors.push({captureError:String(error)})}finally{await browser.close()}
const originalsUnchanged=Object.entries(original).every(([file,sha])=>hash(fs.readFileSync(path.join(root,'public/client-shots',file)))===sha)
const receipt={startedAt,endedAt:new Date().toISOString(),status:errors.length||blocked.length||!originalsUnchanged?'FAIL':'PASS',sourceSha:'9fbff821df62cad11d026022fc7628c7fcebc431',scope:'Source-artwork locale illustrations, not current app screenshots or real service',inputs,original,originalsUnchanged,captures,blocked,errors,apiRequests:0,accountMutations:0,originalPixelParity:false,liveData:false}
fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2),{flag:'wx'})
console.log(JSON.stringify({status:receipt.status,captures:captures.length,blocked:blocked.length,errors,originalsUnchanged,receipt:path.join(output,'receipt.json')}));process.exit(receipt.status==='PASS'?0:1)
