/** Immutable model-facing read-only market tool policy, separately fingerprinted. */
function freeze(value){ if(value&&typeof value==='object'){ Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
const definition = {
  name: "market_data",
  description: "시장 OHLCV 캔들 데이터를 실시간 조회한다. 시스템 컨텍스트에 이미 제공된 스냅샷 범위를 벗어난 데이터가 판단에 필요할 때만 사용: 비교 자산(예: ETHUSDT, ^IXIC), 다른 타임프레임, end_time 으로 지정한 특정 과거 구간. 이미 제공된 범위의 재청구는 낭비다. 반환된 수치만 근거로 쓰고 직접 계산해 채우지 마라.",
  input_schema: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "바이낸스 표기 코인 페어(BTCUSDT, ETHUSDT 등) 또는 야후 티커(TSLA, ^IXIC, DX-Y.NYB 등)" },
      interval: { type: "string", enum: ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"] },
      count: { type: "integer", minimum: 10, maximum: 300, description: "봉 개수, 기본 90" },
      end_time: { type: "string", description: "선택. ISO 날짜(YYYY-MM-DD) — 이 시점까지의 과거 구간을 조회 (코인만 지원)" },
      purpose: { type: "string", description: "조회 목적의 짧은 설명. 사용자 진행 사실로 표시하지 않는다" },
    },
    required: ["symbol", "interval"],
    additionalProperties: false,
  },
};
export const MARKET_TOOL=freeze(definition);
export const MARKET_TOOL_POLICY=Object.freeze({id:'investment-market-data-1',sha256:'5b56416d7e059e9042ff90a09841e754aa1571e5470a3418b81a2ccf8b2823db',definition:MARKET_TOOL});

/** Receipt for the exact tools sent in this SDK request, not capabilities merely available. */
export async function toolRequestReceipt(tools, requestedSpeed = 'standard') {
  const actual=tools?.length ? tools : null;
  const bytes=actual ? await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(actual))) : null;
  return Object.freeze({
    toolsSha256:bytes ? Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('') : null,
    marketToolPolicySha256:actual?.some(t=>t.name==='market_data') ? MARKET_TOOL_POLICY.sha256 : null,
    requestedSpeed,
  });
}
