// Generated candidate: injected transport only, never source-custody authority.
import {apiV11Issues, inspectChronologicalFillPage, snapshotApiV11, strictParseApiV11} from './validator.js';
import type {ApiV11WireIssue} from './validator.js';
import type {ApiV11ErrorCode, ApiV11ErrorEnvelope, ChronologicalFillRequest, ChronologicalFillPageEnvelope, DeepReadonly} from './types.js';

const operation = {"apiContractVersion":"0.11.0","releaseStatus":"CANDIDATE_NOT_PUBLISHED","operationId":"getChronologicalFillMarkersV11","method":"GET","path":"/api/v11/backtests/{backtestId}/chronological-fill-markers","queryKeys":["cursor","limit","manifestContentHash","segment"],"requiredQueryKeys":["manifestContentHash","segment"],"defaultLimit":100,"maxLimit":100,"maxRequestTargetBytes":2048,"maxDtoBytes":8192,"maxResponseBytes":262144,"successStatus":200,"etag":"exact quoted data.pageContentHash; not custody proof","automaticRetry":false,"automaticPagination":false,"producerImplemented":false,"unsupported":["HEAD","Range","If-None-Match","304"]} as const;
const statusByCode: Readonly<Record<ApiV11ErrorCode, number>> = {"BAD_REQUEST":400,"CURSOR_INVALID":400,"AUTHENTICATION_REQUIRED":401,"FORBIDDEN":403,"NOT_FOUND":404,"NOT_READY":409,"SNAPSHOT_CHANGED":409,"BINDING_CONFLICT":409,"SOURCE_VERIFICATION_FAILED":409,"INTERNAL_ERROR":500,"RESPONSE_TOO_LARGE":500};
const schema = 'chronological-fill-page.schema.json#/$defs/';
export interface ChronologicalFillTransport {
  // Pass observable entries unchanged, including Fetch-combined values.
  // Never split, select the last value, or discard conflicting protocol headers.
  request(value: Readonly<{
    method: 'GET'; path: string; headers: Readonly<Record<string, string>>;
    credentials: 'include'; redirect: 'manual'; cache: 'no-store';
  }>): Promise<{status: number; headers: ReadonlyArray<readonly [string, string]>; body: string}>;
}
export interface ChronologicalFillResult {
  readonly status: 200;
  readonly headers: Readonly<{ETag: string; 'Content-Type': string; 'Cache-Control': 'no-store'}>;
  readonly request: DeepReadonly<ChronologicalFillRequest>;
  readonly body: DeepReadonly<ChronologicalFillPageEnvelope>;
}
export class ApiV11Error extends Error {
  readonly issues: ReadonlyArray<ApiV11WireIssue>;
  constructor(readonly code: ApiV11ErrorCode | 'INVALID_REQUEST' | 'TRANSPORT_FAILED' | 'INVALID_RESPONSE', readonly status = 0, issues: ReadonlyArray<ApiV11WireIssue> = []) {
    super(code); this.name = 'ApiV11Error'; this.issues = Object.freeze([...issues]);
  }
}
function captureHeaders(input: unknown): Map<string, string> {
  if (!Array.isArray(input)) throw Error();
  const headers = new Map<string, string>();
  const critical = new Set(['content-type', 'cache-control', 'etag', 'www-authenticate']);
  for (const pair of input) {
    if (!Array.isArray(pair) || pair.length !== 2) throw Error();
    const [name, value] = pair;
    if (typeof name !== 'string' || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || typeof value !== 'string' || /[\r\n]/.test(name + value)) throw Error();
    const key = name.toLowerCase();
    if (!critical.has(key)) continue;
    if (headers.has(key)) throw Error();
    headers.set(key, value);
  }
  return headers;
}
export class TesiaChronologicalFillV11Client {
  constructor(private readonly transport: ChronologicalFillTransport) {}
  async getChronologicalFillMarkersV11(request: ChronologicalFillRequest): Promise<ChronologicalFillResult> {
    let values: ChronologicalFillRequest;
    let path: string;
    try {
      // Capture synchronously before the first await, including concurrent calls.
      values = snapshotApiV11(request, true) as ChronologicalFillRequest;
      if ((await apiV11Issues(values, schema + 'Request')).length || encodeURIComponent(values.backtestId) !== values.backtestId) throw Error();
      const query = new URLSearchParams();
      for (const key of operation.queryKeys) {
        const value = values[key as keyof ChronologicalFillRequest];
        if (value !== undefined) query.set(key, String(value));
      }
      path = operation.path.replace('{backtestId}', values.backtestId) + '?' + query.toString();
      if (new TextEncoder().encode(path).length > operation.maxRequestTargetBytes) throw Error();
      Object.freeze(values);
    } catch { throw new ApiV11Error('INVALID_REQUEST'); }
    let response: Awaited<ReturnType<ChronologicalFillTransport['request']>>;
    try {
      response = await this.transport.request(Object.freeze({method: 'GET', path,
        headers: Object.freeze({Accept: 'application/json'}), credentials: 'include', redirect: 'manual', cache: 'no-store'}));
    } catch { throw new ApiV11Error('TRANSPORT_FAILED'); }
    let status: number, headers: Map<string, string>, body: unknown;
    try {
      status = response.status;
      if (!Number.isInteger(status) || status < 100 || status > 599 || (status >= 300 && status < 400)) throw Error();
      headers = captureHeaders(response.headers);
      if (headers.get('cache-control') !== 'no-store' || !/^application\/json(?:;\s*charset=utf-8)?$/i.test(headers.get('content-type') ?? '')) throw Error();
      if (status === 401 && headers.has('www-authenticate')) throw Error();
      body = strictParseApiV11(response.body);
    } catch { throw new ApiV11Error('INVALID_RESPONSE'); }
    if (status !== operation.successStatus) {
      if (headers.has('etag') || (await apiV11Issues(body, schema + 'ErrorEnvelope')).length) throw new ApiV11Error('INVALID_RESPONSE', status);
      const error = (body as ApiV11ErrorEnvelope).error;
      if (statusByCode[error.code] !== status) throw new ApiV11Error('INVALID_RESPONSE', status);
      throw new ApiV11Error(error.code, status);
    }
    const inspected = await inspectChronologicalFillPage(body);
    if (inspected.snapshot === null) throw new ApiV11Error('INVALID_RESPONSE', status, inspected.issues);
    const snapshot = inspected.snapshot, data = snapshot.data, etag = headers.get('etag');
    if (etag !== '"' + data.pageContentHash + '"') throw new ApiV11Error('INVALID_RESPONSE', status);
    if (data.binding.backtestId !== values.backtestId || data.binding.segment !== values.segment ||
        data.manifestContentHash !== values.manifestContentHash || data.limit !== (values.limit ?? operation.defaultLimit) ||
        (values.cursor === undefined ? data.offset !== 0 : data.offset === 0) ||
        (values.cursor !== undefined && data.nextCursor === values.cursor)) {
      throw new ApiV11Error('INVALID_RESPONSE', status, ['BINDING_CONFLICT']);
    }
    // No page-chain or source-ownership assertion: the reader/server owns those.
    return Object.freeze({status: 200, headers: Object.freeze({ETag: etag, 'Content-Type': headers.get('content-type')!, 'Cache-Control': 'no-store'}), request: values, body: snapshot});
  }
}
