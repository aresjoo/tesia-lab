/** Offline capture of the reviewed client engine, never part of a service build.
 * Usage: node scripts/capture-client-research.mjs <client git repo> <commit>
 * Prints an apply_patch patch. Review the diff before applying it.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const [repo, commit] = process.argv.slice(2)
if (!repo || !/^[a-f0-9]{40}$/.test(commit ?? '')) throw new Error('An explicit source repository and full reviewed commit are required')
const html = execFileSync('git', ['-C', repo, 'show', `${commit}:index.html`], { encoding: 'utf8', maxBuffer: 12e6 })
// The React adapter's dates and chart windows describe this reviewed partition.
// Refuse a new partition until its consumers and golden tests are reviewed too.
const boundaries = [...html.matchAll(/\bvar\s+DEV_END\s*=\s*(\d+)\s*,\s*HOLD_START\s*=\s*(\d+)\s*,\s*FULL_END\s*=\s*(\d+)\s*;/g)]
if (boundaries.length !== 1 || boundaries[0].slice(1).join(',') !== '909,910,1334') throw new Error('Research data boundaries changed; review the adapter before capture')
const slice = (start, end) => {
  const from = html.indexOf(start), to = html.indexOf(end, from)
  if (from < 0 || to <= from) throw new Error(`Missing capture boundary: ${start}`)
  return html.slice(from, to)
}
const context = vm.createContext({ S: {} })
vm.runInContext(slice('function mulberry32(a)', '/* ═══════════ backtest flow'), context, { timeout: 1000 })
vm.runInContext(boundaries[0][0] + '\n' + slice('function cloneParams(p,extra)', '/* ── Research Plan ── */'), context, { timeout: 1000 })
const result = vm.runInContext(`(() => {
  if (PRICE.length !== FULL_END + 1 || HOLD_START !== DEV_END + 1) throw new Error('Research data length or partition changed');
  const params = {sl:-3,tp:8,rsiTh:40,trendFilter:false,startI:61,endI:909};
  const versions = [runBacktest(params), runBacktest({...params,trendFilter:true})];
  const v = versions[1];
  const fields = ['ret','mdd','winRate','n','pf','byYear','cagr','trades','eq'];
  const indices = new Set([0, PRICE.length - 1]);
  for(let i=0;i<PRICE.length;i+=7) indices.add(i);
  versions.forEach(r=>r.trades.forEach(t=>{indices.add(t.entry);indices.add(t.exit)}));
  const stress = stressOf(v).map(x=>({name:x.name,grade:stressGrade(x)[0],ret:(x.r||x.fake).ret,mdd:x.r?x.r.mdd:null}));
  const h = holdoutOf(v);
  // Capture the report before optional what-if runs increment RUNSTATS.
  // These source checks describe the fixed demo, not a production audit.
  const sensitivity = sensitivityOf(v);
  const report = {verdict:verdictV2(v),opinions:teamOpinions(v,h),sanity:sanityOf(v),initialSanity:sanityOf(versions[0]),
    sensitivity,cliff:sensCliff(sensitivity),
    bestYear:v.bestYear,bestYearPnl:v.bestYearPnl,worstYear:v.worstYear,worstYearPnl:v.worstYearPnl,
    backtestCount:RUNSTATS.total};
  return {prices:[...indices].sort((a,b)=>a-b).map(i=>[i,Number(PRICE[i].toFixed(2))]),priceCount:PRICE.length,
    versions:versions.map(r=>Object.fromEntries(fields.map(k=>[k,r[k]]))),stress,
    holdout:{ret:h.ret,mdd:h.mdd,n:h.n,cagr:h.cagr},report,
    whatif:[['fee2',{feeRate:.004}],['delay',{entryDelay:1}],['sl2',{sl:-2}]].map(([k,p])=>{const r=runBacktest({...v.params,...p});return [k,r.ret,r.mdd,r.n]})};
})()`, context, { timeout: 2000 })
const path = 'src/client-research-fixtures.ts'
const original = readFileSync(path, 'utf8').split('\n')
const index = original.findIndex(line => line.startsWith('export const CLIENT_RESEARCH_FIXTURE = '))
if (index < 0) throw new Error('Missing target fixture declaration')
const fixture = { source: `aresjoo/tesia-lab@${commit}`, ...result }
console.log(`*** Begin Patch\n*** Update File: ${path}\n@@\n-${original[1]}\n+// Captured offline from ${commit}; no synthetic engine ships in this adapter.\n@@\n-${original[index]}\n+export const CLIENT_RESEARCH_FIXTURE = ${JSON.stringify(fixture)} as const\n*** End Patch`)
