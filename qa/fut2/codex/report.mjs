import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const dir='qa/fut2/codex/';
const r=JSON.parse(fs.readFileSync(dir+'results.json')),e=JSON.parse(fs.readFileSync(dir+'extra.json'));
const f=x=>x.toFixed(1),pair=x=>`${f(x.ret)} / ${f(x.mdd)}`,range=x=>x.map(f).join('~');
const table=(heads,rows)=>['| '+heads.join(' | ')+' |','| '+heads.map(()=>'---').join(' | ')+' |',...rows.map(a=>'| '+a.join(' | ')+' |')].join('\n');
const s=id=>r.strategies.find(x=>x.id===id);
const verdicts=[
 ['f1','KEEP WITH LOWER LEVERAGE','2→1배: 563.6 / −31.3; 비용 스트레스 440.7. 이웃 MDD −70.5% 때문에 감축.'],
 ['f2','KEEP WITH LOWER LEVERAGE','2→1배: 650.2 / −30.3; 비용 스트레스 536.4. 이웃의 후반 손실·MDD −70.7% 때문에 감축.'],
 ['f3','KEEP','1배 유지. 전체·후반·이웃·비용 검사에서 가장 일관된 축.'],
 ['f4','KEEP WITH LOWER LEVERAGE','2→1배: 204.7 / −23.9; 비용 스트레스 158.5. trail 15→12에서 2배 MDD −61.1%.'],
 ['f5','KEEP','1배·현재 정의 유지. 모든 재시작 통과; look·exitN 민감도는 큼.'],
 ['f6','KEEP','1배 유지. 후반 81.6%; slow=35 이웃은 후반 −9.2%, 증액 근거는 약함.'],
 ['f7','KEEP','1배 유지. 위상 최저 163.9%도 양수지만 548.9%를 대표 성과로 삼기 어려움.'],
 ['f8','KEEP','1배 유지. 이웃·비용 검사가 강함. f3와 같은 AVAX이므로 독립 분산으로 세지 않음.'],
 ['f9','KEEP','1배 유지. 위상 수익 224.4~272.6%; 비용×위상 동시 검사에서는 한 위상 현물 미달.'],
 ['f10','REPLACE','BTC 돌파 n55·exitN6·trail15·reg200·2배: 276.1 / −33.0. 대체 연구안으로 한정.']
];
const chunks=[];
chunks.push('**10개 계산은 재현됐지만, “두 구간 모두 현물 우위인 견고한 최종 10개”는 아닙니다. 판정은 KEEP 6개, 레버리지 감축 3개, 교체 1개입니다.**');
chunks.push('아래 수치는 **수익률 / 종가 MDD, %**입니다. 독립 계산기는 제품 엔진·통계 함수를 호출하지 않았고, 별도 대조에서 10개 일별 자산곡선과 미청산분 포함 펀딩이 일치했습니다.');
chunks.push(table(['전략','Claude 전체','독립 전체','앞 구간¹','뒤 구간¹'],r.strategies.map(x=>[x.id,pair(x.claude),pair(x.full),pair(x.train),pair(x.test)])));
chunks.push('¹ 전체 2023-04-12~2026-09-28, 앞 구간 ~2024-12-31, 뒤 구간 2025-01-01~. 한 번 실행한 원장을 나누고 뒤 구간의 기준잔고는 **12월 31일 종가**로 잡았습니다. 예열 때문에 f2·f8은 4월 13일, f3·f4·f10은 7월 22일부터 계산하며 그 전은 현금입니다. Claude f9의 정수 표기는 반올림 차이입니다.');
chunks.push('Claude 검색 수치도 **같은 정의라면 전부 재현**됩니다. 다만 검색은 뒤 구간을 1월 1일 **종가**부터 세어 당일 손익을 누락합니다. f1은 183.1→186.9%, f5는 79.7→81.7%, f6는 **99.3 / −31.8→81.6 / −33.9**로 바뀝니다. AI 검색의 앞·뒤 값은 위상별 최저치이며, 위 표는 최종안인 ph=0입니다.');
chunks.push('**주장과 달리 앞 구간에서 f5·f7·f9·f10은 현물을 못 이깁니다.**');
chunks.push(table(['전략','앞 구간 전략 수익','앞 구간 현물 수익'],['f5','f7','f9','f10'].map(id=>[id,f(s(id).train.ret),f(s(id).spotTrain.ret)])));
chunks.push('검색 코드에는 앞 구간의 현물 초과 조건이 없습니다. 후반 성과를 통과 조건과 순위에 모두 사용했으므로 미사용 표본 검증도 아닙니다. 두 검색은 합계 **42,096개** 조합을 평가했습니다.');
chunks.push('**위상·재시작:** ph=0·1·2를 모두 실행했습니다.');
chunks.push(table(['전략','전체 ph0 R/MDD','전체 ph1 R/MDD','전체 ph2 R/MDD'],r.phases.map(x=>[x.id,...x.full.map(pair)])));
chunks.push('종료일 T=2026-09-28 고정, 시작일은 T−365 또는 T−730에서 0~7일 뒤로 이동했습니다. 각각 3위상×8시작일=24회입니다. Claude 검색이 사용한 앞당기는 방향도 0~7일 전부 추가했습니다.');
chunks.push(table(['전략·기간','0~7일 뒤 수익 범위','MDD 범위','0~7일 앞 수익 범위','각 방향 양수·현물 초과'],r.phases.flatMap(x=>x.summaries.map(q=>[`${x.id}·${q.horizon}일`,range(q.later.ret),range(q.later.mdd),range(q.earlier.ret),'24/24']))));
chunks.push('재시작으로 수익 부호가 뒤집히던 문제는 이번 세 전략에서 재현되지 않았습니다. 그러나 **f7의 548.9%는 유리한 위상**입니다. 위상 중앙값은 194.7%, 최저는 163.9%입니다.');
chunks.push('**인접 파라미터:** 한 번에 숫자 하나를 변경했습니다. 큰 간격은 every·top·lev ±1, fast ±2, slow ±15, look ±10, n ±5, exitN·sl·trail ±3, reg ±30, gate ±0.12입니다. 미세 검사는 정수 ±1·gate ±0.01입니다. 유효 범위 밖은 제외했고, 레버리지와 top의 양방향도 포함했습니다.');
chunks.push(table(['전략','큰 간격 양수','큰 간격 현물 초과','그중 뒤 구간 양수','미세 간격 현물 초과'],r.strategies.map(x=>{const b=r.neighbors.find(y=>y.id===x.id&&y.scheme==='broad'),a=r.neighbors.find(y=>y.id===x.id&&y.scheme==='fine');return [x.id,`${b.summary.positive}/${b.summary.n}`,`${b.summary.beat}/${b.summary.n}`,`${b.testPositive}/${b.summary.n}`,`${a.summary.beat}/${a.summary.n}`];})));
chunks.push('위 표는 ph=0입니다. 모든 위상에서도 현물을 이기는 큰 간격 이웃은 f5 **9/13**, f7 **7/8**, f9 **8/9**입니다. gate는 종목 수에 따라 계단식으로 작동하므로 값이 달라도 같은 거래가 나오는 이웃을 독립 증거로 세면 안 됩니다. 기존 `neighbors-final.json`은 여전히 **선물 종가 보유**를 비교대상으로 쓰고 레버리지를 성공 개수에서 제외합니다. 이번 표는 제공된 **현물 종가**를 사용했습니다.');
chunks.push('**비용 스트레스:** 수수료 0.055→0.165%, 슬리피지 0.05→0.15%, 부호를 유지한 펀딩 합계 ×2를 동시에 적용했습니다. 현물은 4월 12일 최초 동일비중 매수 후 보유입니다.');
chunks.push(table(['전략','스트레스 R/MDD','현물 수익','현물 초과'],r.strategies.map(x=>[x.id,pair(x.stress),f(x.spot.ret),x.stress.ret>x.spot.ret?'통과':'실패'])));
chunks.push('기본 위상에서는 **f10만 실패**합니다. 위상까지 함께 바꾸면 f7 스트레스 수익은 **69.8~319.8%**로 1/3만 현물 109.8%를 넘고, f9는 **107.0~143.2%**로 2/3만 넘습니다. f5는 3/3 통과합니다. 실제 계산 시작일에 현물을 맞춰도 f10 실패 판정은 같습니다(현물 180.5%).');
chunks.push('**레버리지:** 역행은 보유 중 **당일 시가→불리한 가격**이며, 손절 체결 뒤의 고저가는 제외한 모형값입니다. 진입가 기준 최대 불리 변동도 별도로 적었습니다. 청산 여유는 그 가격에서 청산가까지 필요한 추가 역행률입니다.');
chunks.push(table(['전략','최대 당일 역행·날짜','그때 청산 여유','진입가 대비 최대 불리 변동','전체 최소 청산 여유'],['f1','f2','f4','f10'].map(id=>{const a=e.leverage.find(x=>x.id===id).dailyWorst,b=s(id).risk;return [id,`${f(a.dailyAdverse)}% · ${a.date}`,`${f(a.gapPctPrice)}%`,`${f(b.worst.adverse)}%`,`${f(b.closest.gapPctPrice)}%`];})));
chunks.push('네 전략 모두 모형상 청산 0회입니다. f1·f2·f4의 2배는 이 가격 이력에서 청산 여유가 있었지만, 주변 설정의 낙폭까지 고려하면 **1배가 더 방어 가능합니다**. 이는 청산 임박 판정이 아니라 손실 규모를 줄이자는 판단입니다. f10의 3배는 비용을 높이면 현물 초과가 사라져 유지 근거가 약합니다.');
chunks.push('엔진 수정에도 예외가 남습니다. **전날 예약한 시가 청산은 갭 청산 검사보다 먼저 실행**됩니다. 합성 반례에서 청산가 51.0305보다 낮은 시가 51을 일반 반전 청산으로 처리해 원금의 0.83%를 회수하고 청산 횟수는 0으로 셉니다. 현재 10개 원장에는 해당 사례가 없습니다.');
chunks.push(table(['전략','판정','유지·변경 근거 및 변경 후 R/MDD'],verdicts));
chunks.push('f10 대체안은 뒤 구간 **41.2 / −27.8**, 비용 스트레스 **187.1 / −35.1**, 최근 365·730일 재시작 수익 **46.0·140.7%**입니다. 전체 현물 대비 스트레스 여유는 10.1%p, 실제 시작일 기준 6.7%p뿐입니다. 주변 10개는 모두 양수지만 현물 초과는 기본 7/10·스트레스 4/10입니다. **전체 자료를 본 뒤 고른 개선 후보이며, 견고한 열 번째 전략이 확보됐다는 뜻은 아닙니다.**');
chunks.push('독립 계산·전체 파라미터별 표·원장은 [REPORT.md](<C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/qa/fut2/codex/REPORT.md>)에 있습니다. 일별 원장 대조 10개, 검색 구간 대조 10개, 합성 경계 검사 5개, 미래 데이터 변조 10개, 8종목×1,367일 OHLC 검사를 통과했습니다.');
chunks.push('작성 범위는 `qa/fut2/codex/`뿐입니다. 입력 해시는 계산 전후 동일하며 JSON·공백 검사와 `git diff --check`도 통과했습니다.');
chunks.push('창업자에게: **f3·f8이 이번 검사에서 가장 단단하고, 세 AI 규칙도 최근 시작일을 바꿨다고 손실 전략으로 뒤집히지는 않습니다.** 다만 f7의 큰 수익에는 일정 운이 섞여 있고, f5는 파라미터 민감도가 크며, f10은 비용에 취약합니다. AI 세 전략은 실제 모델 호출이 아니라 가격 순위·시장 폭을 계산하는 결정론적 규칙입니다. 두 구간을 모두 보고 선별했으므로 다음 구간 성과는 아직 모릅니다. 일봉만으로는 손절 전후의 실제 장중 경로, mark price 청산, 펀딩 정산시각별 노출, 급변 시 체결가·호가·수용 자금 규모를 확정할 수 없습니다. MDD는 종가 기준이고 마지막 미청산분 종료 비용도 미차감입니다. 이번에는 제공 파일의 산술·구조를 검증했으며 거래소 원본 진위 대조는 수행하지 않았습니다.');
const final=chunks.join('\n\n')+'\n';
fs.writeFileSync(dir+'FINAL.md',final);
const detail=[];
detail.push(final);
detail.push('**Claude 검색 수치와 동일 정의 대조**\n\nClaude의 tr은 앞 구간 수익만 제공하며 앞 구간 MDD는 제공하지 않는다. agent/mix 값은 위상별 최저 수익·최악 MDD로, 같은 위상에서 나온 한 쌍이 아닐 수 있다.');
detail.push(table(['ID','Claude 앞 수익','독립 앞 수익','Claude 뒤 R/MDD','독립 뒤 R/MDD'],e.searchBoundaryAudit.map(x=>[x.id,f(x.claude.train),f(x.independentSameDefinition.train),`${f(x.claude.test)} / ${f(x.claude.mdd)}`,`${f(x.independentSameDefinition.test)} / ${f(x.independentSameDefinition.mdd)}`])));
detail.push('**숫자 파라미터별 큰 간격 결과, ph=0**');
detail.push(table(['ID','파라미터','검사 값','양수','현물 초과','뒤 구간 양수'],e.parameterCounts.toSorted((a,b)=>+a.id.slice(1)-+b.id.slice(1)).map(x=>[x.id,x.parameter,x.values.join(', '),`${x.positive}/${x.n}`,`${x.beat}/${x.n}`,`${x.testPositive}/${x.n}`])));
detail.push('**장중 노출의 두 해석**\n\n위 요약은 손절 체결가와 손절하지 않은 날의 불리한 극값으로 계산했다. 아래는 손절 당일에도 일봉 전체 고저가를 쓰는 보수적 외곽선이며, 손절 이후의 가격을 포함할 수 있으므로 실제 보유 중 손실이라고 단정할 수 없다. 예정된 종가 신호 청산은 다음 날 시가에 먼저 종료하므로 그날 이후 극값을 포함하지 않는다.');
detail.push(table(['ID','모형 진입가 대비 최악·날짜','그때 청산 여유','일봉 외곽 최악·날짜','그때 청산 여유','일봉 외곽 최소 청산 여유'],['f1','f2','f4','f10'].map(id=>{const x=s(id).risk;return [id,`${f(x.worst.adverse)} · ${x.worst.date}`,f(x.worst.gapPctPrice),`${f(x.envelopeWorst.adverse)} · ${x.envelopeWorst.date}`,f(x.envelopeWorst.gapPctPrice),f(x.envelopeClosest.gapPctPrice)];})));
detail.push('**모형 민감도**\n\nf5 보유 중에도 일정대로 국면을 갱신하면 전체 수익 480.1→319.9%, MDD −45.4%다. 국면 동결은 여전히 전략 정의의 일부다. 펀딩 전액을 시가에 먼저 부과하는 대안과 시가평가 명목금액 기반 단순 유지증거금 대안도 results.json에 기록했다. 둘 다 거래소 정산시각·실제 mark price를 재구성한 검증은 아니다. 원래 엔진의 청산식은 진입 명목금액×0.5% 유지증거금 가정이다.');
detail.push('갭 반례는 extra.mjs의 queuedGapCounterexample로 재현한다. MA(1,2) 2배, i101의 상향 교차→i102 시가 101 롱 진입(체결 101.0505), i102 종가90 하향 교차로 다음날 반전 예약, i103 시가51. 현재 제품 엔진과 독립 엔진 모두 일반 flip 청산·회수액0.008327543133(초기원금1)·청산0회다. 수정 대안은 전날부터 보유한 포지션의 시가 강제청산 조건을 예약 청산보다 먼저 검사하는 것이다. 제품 파일은 수정하지 않았다.');
detail.push('**대체안 선택과 한계**\n\nf10의 exitN 6·7·8·10과 레버리지 1·2·3 조합 12개를 추가 비교했다(extra.json: replacementExploration). 2배, exitN6은 원본에서 작은 변경으로 낙폭을 줄이고 정해진 비용 스트레스를 통과하는 후보다. exitN7의 2배는 스트레스 수익 168.8%로 현물에 미달한다. 이 예민함 때문에 교체안을 새로 검증된 최종안으로 올려서는 안 된다. 앞 구간에서도 교체안 166.4%는 현물 210.0% 미만이다.');
detail.push('**재현·파일 역할**\n\n`rtk proxy node qa/fut2/codex/setup.mjs` → `verify.mjs` → `extra.mjs` → `report.mjs`. 각각 같은 경로 접두사를 사용한다. setup은 round 1 독립 구현을 복사해 달력 위상·시가 갭·미청산 펀딩 표시·노출 기록을 갱신한다. independent.mjs는 데이터 파일만 평가하며 제품 엔진을 가져오지 않는다. verify의 별도 VM만 제품 엔진을 대조용으로 실행한다. results.json은 기본·미세/큰 이웃·위상·비용·해시, extra.json은 파라미터별 개수·교체안·교차 스트레스·데이터 검사다. trace-f*.json은 10개 원본의 일별 자산곡선·거래·장중 노출이다. FINAL.md는 제출 답변 원문이다. 요청에 따라 qa/fut2/codex 밖의 코드·문서·우체통은 수정하지 않았다.');
for(const [path,hash]of Object.entries(r.hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex'),hash,`input changed: ${path}`);
detail.push('입력 데이터·엔진·후보 파일 SHA256은 계산 전후 동일하다. 브라우저 제품 UI·실거래 API·외부 시장 원본은 이번 검증 범위 밖이다.');
fs.writeFileSync(dir+'REPORT.md',detail.join('\n\n')+'\n');
fs.writeFileSync(dir+'verdicts.json',JSON.stringify(verdicts.map(([id,verdict,reason])=>({id,verdict,reason,config:id==='f10'?e.replacement.c:{...s(id).c,...(['f1','f2','f4'].includes(id)?{lev:1}:{})}})),null,2));
console.log('FINAL.md and REPORT.md written; inputs unchanged.');
