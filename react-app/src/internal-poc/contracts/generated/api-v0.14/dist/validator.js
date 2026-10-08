const record = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const plainRecord = (v) => { if (!record(v))
    return false; const prototype = Object.getPrototypeOf(v); return prototype === Object.prototype || prototype === null; };
const own = (v, k) => Object.prototype.hasOwnProperty.call(v, k);
const unicodeScalarNfc = (v) => { if (v !== v.normalize("NFC"))
    return false; for (let i = 0; i < v.length; i++) {
    const unit = v.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
        if (i + 1 >= v.length) {
            return false;
        }
        const next = v.charCodeAt(++i);
        if (next < 0xdc00 || next > 0xdfff)
            return false;
    }
    else if (unit >= 0xdc00 && unit <= 0xdfff)
        return false;
} return true; };
const codePointCompare = (a, b) => { const left = Array.from(a), right = Array.from(b), length = Math.min(left.length, right.length); for (let i = 0; i < length; i++) {
    const delta = left[i].codePointAt(0) - right[i].codePointAt(0);
    if (delta !== 0)
        return delta;
} return left.length - right.length; };
const stable = (v, d = 0, state = { nodes: 0, ancestors: new Set() }) => { if (d > 32)
    throw new Error("REPORTING_DOCUMENT_TOO_DEEP"); if (++state.nodes > 20000)
    throw new Error("REPORTING_DOCUMENT_TOO_COMPLEX"); if (v === null)
    return "null"; if (typeof v === "string") {
    if (!unicodeScalarNfc(v))
        throw new Error("REPORTING_NON_NFC_STRING");
    return JSON.stringify(v);
} if (typeof v === "boolean")
    return JSON.stringify(v); if (typeof v === "number") {
    if (!Number.isFinite(v))
        throw new Error("REPORTING_NONFINITE_NUMBER");
    if (!Number.isInteger(v))
        throw new Error("REPORTING_FLOAT_FORBIDDEN");
    if (!Number.isSafeInteger(v))
        throw new Error("REPORTING_CANONICAL_TYPE_INVALID");
    return JSON.stringify(v);
} if (typeof v !== "object" || state.ancestors.has(v))
    throw new Error("REPORTING_CANONICAL_TYPE_INVALID"); state.ancestors.add(v); try {
    if (Array.isArray(v)) {
        if (Object.keys(v).length !== v.length || !Array.from({ length: v.length }, (_, index) => Object.prototype.hasOwnProperty.call(v, index)).every(Boolean))
            throw new Error("REPORTING_CANONICAL_TYPE_INVALID");
        return `[${v.map(x => stable(x, d + 1, state)).join(",")}]`;
    }
    if (plainRecord(v)) {
        const objectKeys = Object.keys(v);
        if (!objectKeys.every(unicodeScalarNfc))
            throw new Error("REPORTING_NON_NFC_STRING");
        return `{${objectKeys.sort(codePointCompare).map(k => `${JSON.stringify(k)}:${stable(v[k], d + 1, state)}`).join(",")}}`;
    }
    throw new Error("REPORTING_CANONICAL_TYPE_INVALID");
}
finally {
    state.ancestors.delete(v);
} };
const boundedStable = (v) => { const canonical = stable(v), bytes = new TextEncoder().encode(canonical); if (bytes.length > 1048576)
    throw new Error("REPORTING_DOCUMENT_TOO_LARGE"); return { canonical, bytes }; };
const digest = async (domain, v) => { const canonicalBytes = boundedStable(v).bytes, prefix = new TextEncoder().encode(`${domain}\0`), bytes = new Uint8Array(prefix.length + canonicalBytes.length); bytes.set(prefix); bytes.set(canonicalBytes, prefix.length); const hash = await crypto.subtle.digest("SHA-256", bytes); return Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, "0")).join(""); };
const withoutHash = (v) => { boundedStable(v); if (!plainRecord(v))
    throw new Error("REPORTING_CANONICAL_TYPE_INVALID"); return Object.fromEntries(Object.entries(v).filter(([k]) => k !== "contentHash")); };
const reportingProjectionContentHash = (v) => digest("tesia.reporting.private-actual-backtest-projection.v0.1.0", withoutHash(v));
const reportingReceiptContentHash = (v) => digest("tesia.reporting.private-actual-projection-verification-receipt.v0.1.0", withoutHash(v));
const reportingEnvelopeContentHash = (v) => digest("tesia.reporting.private-actual-backtest-report-envelope.v0.1.0", withoutHash(v));
class StrictParser {
    s;
    i = 0;
    nodes = 0;
    constructor(s) {
        this.s = s;
    }
    parse() { if (this.s.charCodeAt(0) === 0xfeff)
        throw new Error("REPORTING_BOM_FORBIDDEN"); const v = this.value(0); this.ws(); if (this.i !== this.s.length)
        throw new Error("REPORTING_JSON_INVALID"); return v; }
    ws() { while (/[\x20\t\r\n]/.test(this.s[this.i] ?? ""))
        this.i++; }
    bump(d) { if (d > 32)
        throw new Error("REPORTING_DOCUMENT_TOO_DEEP"); if (++this.nodes > 20000)
        throw new Error("REPORTING_DOCUMENT_TOO_COMPLEX"); }
    value(d) { this.bump(d); this.ws(); const c = this.s[this.i]; if (c === "{")
        return this.object(d + 1); if (c === "[")
        return this.array(d + 1); if (c === '"')
        return this.string(); for (const [x, v] of [["true", true], ["false", false], ["null", null]])
        if (this.s.startsWith(x, this.i)) {
            this.i += x.length;
            return v;
        } return this.number(); }
    number() { const start = this.i; if (this.s[this.i] === "-")
        this.i++; const first = this.s[this.i]; if (first === "0")
        this.i++;
    else if (first !== undefined && first >= "1" && first <= "9") {
        this.i++;
        while ((this.s[this.i] ?? "") >= "0" && (this.s[this.i] ?? "") <= "9")
            this.i++;
    }
    else
        throw new Error("REPORTING_JSON_INVALID"); if (/[.eE]/.test(this.s[this.i] ?? ""))
        throw new Error("REPORTING_FLOAT_FORBIDDEN"); const value = Number(this.s.slice(start, this.i)); if (!Number.isSafeInteger(value))
        throw new Error("REPORTING_CANONICAL_TYPE_INVALID"); return value; }
    string() { const start = this.i++; let escaped = false; for (; this.i < this.s.length; this.i++) {
        const c = this.s[this.i];
        if (!escaped && c === '"') {
            this.i++;
            let v;
            try {
                v = JSON.parse(this.s.slice(start, this.i));
            }
            catch {
                throw new Error("REPORTING_JSON_INVALID");
            }
            if (!unicodeScalarNfc(v))
                throw new Error("REPORTING_NON_NFC_STRING");
            return v;
        }
        escaped = !escaped && c === '\\';
        if (c !== "\\")
            escaped = false;
    } throw new Error("REPORTING_JSON_INVALID"); }
    object(d) { this.i++; const out = Object.create(null); const seen = new Set(); this.ws(); if (this.s[this.i] === "}") {
        this.i++;
        return out;
    } for (;;) {
        this.ws();
        if (this.s[this.i] !== "\"")
            throw new Error("REPORTING_JSON_INVALID");
        const k = this.string();
        if (seen.has(k))
            throw new Error("REPORTING_DUPLICATE_KEY");
        seen.add(k);
        this.ws();
        if (this.s[this.i++] !== ":")
            throw new Error("REPORTING_JSON_INVALID");
        Object.defineProperty(out, k, { value: this.value(d), enumerable: true, writable: true, configurable: true });
        this.ws();
        const c = this.s[this.i++];
        if (c === "}")
            return out;
        if (c !== ",")
            throw new Error("REPORTING_JSON_INVALID");
    } }
    array(d) { this.i++; const out = []; this.ws(); if (this.s[this.i] === "]") {
        this.i++;
        return out;
    } for (;;) {
        out.push(this.value(d));
        this.ws();
        const c = this.s[this.i++];
        if (c === "]")
            return out;
        if (c !== ",")
            throw new Error("REPORTING_JSON_INVALID");
    } }
}
const strictParseReportingV01 = (payload) => { if (new TextEncoder().encode(payload).length > 1048576)
    throw new Error("REPORTING_DOCUMENT_TOO_LARGE"); return new StrictParser(payload).parse(); };
// Literal schema interpreter. No server context, source custody or issuer API.
const nativeSchemas = { "https://contracts.tesia.ai/api/v0.14.0/consultation-session.schema.json": { "$schema": "https://json-schema.org/draft/2020-12/schema", "$id": "https://contracts.tesia.ai/api/v0.14.0/consultation-session.schema.json", "title": "TETH consultation session candidate \u2014 no strategy/order authority", "$defs": { "Id": { "type": "string", "minLength": 16, "maxLength": 128, "pattern": "^[A-Za-z0-9_-]+$(?![\\s\\S])" }, "SessionId": { "type": "string", "description": "Non-secret public session handle, generated independently of HttpOnly bearer/handoff/CSRF secrets; never an authentication capability.", "pattern": "^session_[A-Za-z0-9_-]{12,80}$(?![\\s\\S])" }, "Revision": { "type": "string", "pattern": "^(?:0|[1-9][0-9]{0,18}|1[0-7][0-9]{18}|18[0-3][0-9]{17}|184[0-3][0-9]{16}|1844[0-5][0-9]{15}|18446[0-6][0-9]{14}|184467[0-3][0-9]{13}|1844674[0-3][0-9]{12}|184467440[0-6][0-9]{10}|1844674407[0-2][0-9]{9}|18446744073[0-6][0-9]{8}|1844674407370[0-8][0-9]{6}|18446744073709[0-4][0-9]{5}|184467440737095[0-4][0-9]{4}|18446744073709550[0-9]{3}|18446744073709551[0-5][0-9]{2}|1844674407370955160[0-9]|1844674407370955161[0-5])$(?![\\s\\S])" }, "Counter": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "Timestamp": { "type": "string", "format": "date-time", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]{1,6})?Z$(?![\\s\\S])" }, "Cursor": { "type": "string", "minLength": 16, "maxLength": 512, "pattern": "^[A-Za-z0-9_-]+$(?![\\s\\S])" }, "Limit": { "type": "integer", "minimum": 1, "maximum": 50, "default": 50 }, "State": { "description": "Native public state. A handoff-paused turn remains QUEUED and promises no dispatch/progress; HELD is cost-only, not a turn state.", "enum": ["QUEUED", "DISPATCHING", "COMPLETED", "FAILED", "CANCELLED", "AMBIGUOUS"] }, "ClaimBody": { "type": "object", "additionalProperties": false, "properties": { "expectedSessionRevision": { "$ref": "#/$defs/Revision", "description": "Current AUTHENTICATED target session revision before claim, not the anonymous source revision; source handoff CAS is separately fenced." } }, "required": ["expectedSessionRevision"] }, "ClaimRequest": { "type": "object", "additionalProperties": false, "properties": { "anonymousSessionId": { "$ref": "#/$defs/SessionId" }, "expectedSessionRevision": { "$ref": "#/$defs/Revision", "description": "Current AUTHENTICATED target session revision before claim; never source handoff CAS revision." } }, "required": ["anonymousSessionId", "expectedSessionRevision"] }, "LegacyResourceCounts": { "type": "object", "additionalProperties": false, "properties": { "conversations": { "$ref": "#/$defs/Counter" }, "messages": { "$ref": "#/$defs/Counter" }, "drafts": { "$ref": "#/$defs/Counter" }, "patches": { "$ref": "#/$defs/Counter" }, "validations": { "$ref": "#/$defs/Counter" }, "idempotencyRecords": { "$ref": "#/$defs/Counter" } }, "required": ["conversations", "messages", "drafts", "patches", "validations", "idempotencyRecords"] }, "ConsultationResourceCounts": { "description": "Exact actual logical graph counts at commit; conversations and turns must be positive for claim, public events/idempotency records may be zero. No cross-count ratios attest graph truth.", "type": "object", "additionalProperties": false, "properties": { "conversations": { "$ref": "#/$defs/Counter" }, "turns": { "$ref": "#/$defs/Counter" }, "events": { "$ref": "#/$defs/Counter" }, "idempotencyRecords": { "$ref": "#/$defs/Counter" } }, "required": ["conversations", "turns", "events", "idempotencyRecords"] }, "Claim": { "type": "object", "additionalProperties": false, "properties": { "anonymousSessionId": { "$ref": "#/$defs/SessionId" }, "sessionId": { "$ref": "#/$defs/SessionId" }, "state": { "const": "AUTHENTICATED" }, "revision": { "$ref": "#/$defs/Revision", "description": "AUTHENTICATED target session revision after successful commit, strictly greater than expectedSessionRevision; joint request/response check is a producer acceptance gate." }, "mode": { "enum": ["CONSULTATION_ONLY", "COMBINED"] }, "grantScope": { "const": "CONSULTATION_V13", "description": "Consultation logical read grant only; COMBINED legacy graph retains API1 meaning and requires separate StrategyVersion approval, never order authority." }, "claimedLegacyResourceCounts": { "$ref": "#/$defs/LegacyResourceCounts" }, "claimedConsultationResourceCounts": { "$ref": "#/$defs/ConsultationResourceCounts" }, "oldSessionRevoked": { "const": true } }, "required": ["anonymousSessionId", "sessionId", "state", "revision", "mode", "grantScope", "claimedLegacyResourceCounts", "claimedConsultationResourceCounts", "oldSessionRevoked"] }, "ConversationSummary": { "type": "object", "additionalProperties": false, "properties": { "conversationId": { "$ref": "#/$defs/Id" }, "createdAt": { "$ref": "#/$defs/Timestamp" }, "updatedAt": { "$ref": "#/$defs/Timestamp" }, "turnCount": { "$ref": "#/$defs/Counter" }, "lastTurnId": { "anyOf": [{ "$ref": "#/$defs/Id" }, { "type": "null" }] }, "lastTurnState": { "anyOf": [{ "$ref": "#/$defs/State" }, { "type": "null" }] } }, "required": ["conversationId", "createdAt", "updatedAt", "turnCount", "lastTurnId", "lastTurnState"] }, "ConversationListRequest": { "type": "object", "additionalProperties": false, "properties": { "cursor": { "$ref": "#/$defs/Cursor" }, "limit": { "$ref": "#/$defs/Limit" } }, "required": [] }, "ConversationList": { "type": "object", "additionalProperties": false, "properties": { "snapshotId": { "$ref": "#/$defs/Id" }, "offset": { "$ref": "#/$defs/Counter" }, "limit": { "$ref": "#/$defs/Limit" }, "totalCount": { "$ref": "#/$defs/Counter" }, "conversations": { "type": "array", "maxItems": 50, "items": { "$ref": "#/$defs/ConversationSummary" } }, "nextCursor": { "anyOf": [{ "$ref": "#/$defs/Cursor" }, { "type": "null" }] } }, "required": ["snapshotId", "offset", "limit", "totalCount", "conversations", "nextCursor"] }, "ErrorCode": { "enum": ["BAD_REQUEST", "AUTHENTICATION_REQUIRED", "FORBIDDEN", "CSRF_INVALID", "ORIGIN_INVALID", "NOT_FOUND", "IDEMPOTENCY_KEY_REUSED", "SESSION_REVISION_CONFLICT", "HANDOFF_INVALID", "CLAIM_CONFLICT", "CURSOR_INVALID", "RATE_LIMITED", "INTERNAL_ERROR"] }, "Error": { "type": "object", "additionalProperties": false, "properties": { "code": { "$ref": "#/$defs/ErrorCode" }, "message": { "type": "string", "const": "Consultation session request failed." } }, "required": ["code", "message"] }, "ClaimEnvelope": { "type": "object", "additionalProperties": false, "properties": { "apiContractVersion": { "const": "0.14.0" }, "data": { "$ref": "#/$defs/Claim" } }, "required": ["apiContractVersion", "data"] }, "ConversationListEnvelope": { "type": "object", "additionalProperties": false, "properties": { "apiContractVersion": { "const": "0.14.0" }, "data": { "$ref": "#/$defs/ConversationList" } }, "required": ["apiContractVersion", "data"] }, "ErrorEnvelope": { "type": "object", "additionalProperties": false, "properties": { "apiContractVersion": { "const": "0.14.0" }, "error": { "$ref": "#/$defs/Error" } }, "required": ["apiContractVersion", "error"] } } } };
function nativeResolve(ref, base) {
    const url = new URL(ref, base), id = url.origin + url.pathname;
    let value = nativeSchemas[id];
    if (!value)
        throw Error('BAD_REQUEST');
    for (const part of url.hash.slice(2).split('/'))
        if (part)
            value = value[part.replace(/~1/g, '/').replace(/~0/g, '~')];
    return [value, id];
}
function nativeTimestamp(value) {
    const m = /^([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2})(?:\.([0-9]+))?(Z|[+-][0-9]{2}:[0-9]{2})$/.exec(value);
    if (!m || m[1].startsWith('0000'))
        return false;
    const local = Date.parse(m[1] + 'Z');
    if (!Number.isFinite(local) || new Date(local).toISOString().slice(0, 19) !== m[1])
        return false;
    return Number.isFinite(Date.parse(value));
}
function nativeCheck(value, s, base) {
    if (s === true)
        return true;
    if (s === false)
        return false;
    if (s.$ref) {
        const [t, id] = nativeResolve(s.$ref, base);
        if (!nativeCheck(value, t, id))
            return false;
    }
    if ('const' in s && stable(value) !== stable(s.const))
        return false;
    if (s.enum && !s.enum.some((x) => stable(value) === stable(x)))
        return false;
    if (s.allOf && !s.allOf.every((x) => nativeCheck(value, x, base)))
        return false;
    if (s.anyOf && !s.anyOf.some((x) => nativeCheck(value, x, base)))
        return false;
    if (s.oneOf && s.oneOf.filter((x) => nativeCheck(value, x, base)).length !== 1)
        return false;
    if (s.not && nativeCheck(value, s.not, base))
        return false;
    if (s.if) {
        if (nativeCheck(value, s.if, base)) {
            if (s.then && !nativeCheck(value, s.then, base))
                return false;
        }
        else if (s.else && !nativeCheck(value, s.else, base))
            return false;
    }
    if (s.type) {
        const types = Array.isArray(s.type) ? s.type : [s.type];
        if (!types.some((t) => t === 'null' ? value === null : t === 'array' ? Array.isArray(value) : t === 'object' ? plainRecord(value) : t === 'integer' ? typeof value === 'number' && Number.isSafeInteger(value) : t === 'number' ? typeof value === 'number' && Number.isFinite(value) : typeof value === t))
            return false;
    }
    if (typeof value === 'string') {
        if (s.pattern && !new RegExp(s.pattern).test(value))
            return false;
        if (s.minLength !== undefined && [...value].length < s.minLength || s.maxLength !== undefined && [...value].length > s.maxLength)
            return false;
        if (s.format === 'date-time' && !nativeTimestamp(value))
            return false;
    }
    if (typeof value === 'number' && (s.minimum !== undefined && value < s.minimum || s.maximum !== undefined && value > s.maximum))
        return false;
    if (Array.isArray(value)) {
        if (s.minItems !== undefined && value.length < s.minItems || s.maxItems !== undefined && value.length > s.maxItems)
            return false;
        if (s.uniqueItems && new Set(value.map(x => stable(x))).size !== value.length)
            return false;
        for (let i = 0; i < value.length; i++) {
            const child = s.prefixItems?.[i] ?? s.items;
            if (child !== undefined && !nativeCheck(value[i], child, base))
                return false;
        }
    }
    if (plainRecord(value)) {
        if (s.required && !s.required.every((k) => own(value, k)))
            return false;
        for (const key of Object.keys(value)) {
            if (s.properties && own(s.properties, key)) {
                if (!nativeCheck(value[key], s.properties[key], base))
                    return false;
            }
            else if (s.additionalProperties === false)
                return false;
        }
    }
    return true;
}
// Closed wire only: never attests current owner, handoff CAS, grants or cost.
const base = "https://contracts.tesia.ai/api/v0.14.0/consultation-session.schema.json";
const schemaPrefix = 'consultation-session.schema.json#/$defs/';
export function strictParseApiV14(payload, request = false) {
    const max = request ? 65536 : 262144;
    if (typeof payload !== 'string' || payload.length > max || new TextEncoder().encode(payload).length > max)
        throw Error('BAD_REQUEST');
    return strictParseReportingV01(payload);
}
function requireWire(condition) { if (!condition)
    throw Error('BINDING_CONFLICT'); }
function timestamp(value) {
    const match = /^(.*?)(?:\.([0-9]{1,6}))?Z$/.exec(value);
    return match[1] + '.' + (match[2] ?? '').padEnd(6, '0') + 'Z';
}
function claim(v) {
    const l = v.claimedLegacyResourceCounts, c = v.claimedConsultationResourceCounts;
    requireWire(v.anonymousSessionId !== v.sessionId);
    requireWire(c.conversations > 0 && c.turns > 0);
    requireWire(v.mode === 'CONSULTATION_ONLY' ? Object.values(l).every(x => x === 0) : l.drafts > 0);
}
function summary(v) {
    requireWire(timestamp(v.createdAt) <= timestamp(v.updatedAt));
    requireWire(v.turnCount === 0 ? v.lastTurnId === null && v.lastTurnState === null : v.lastTurnId !== null && v.lastTurnState !== null);
}
function list(v) {
    const rows = v.conversations;
    requireWire(v.offset <= v.totalCount && rows.length <= Math.min(v.limit, v.totalCount - v.offset));
    requireWire(rows.length > 0 || v.offset === 0 && v.totalCount === 0);
    requireWire((v.nextCursor !== null) === (v.offset + rows.length < v.totalCount));
    requireWire(new Set(rows.map((row) => row.conversationId)).size === rows.length);
    let previous = null;
    for (const row of rows) {
        summary(row);
        const key = [timestamp(row.updatedAt), row.conversationId];
        requireWire(previous === null || previous[0] > key[0] || previous[0] === key[0] && previous[1] < key[1]);
        previous = key;
    }
}
export function apiV14Issues(input, schemaRef) {
    try {
        if (typeof schemaRef !== 'string' || !schemaRef.startsWith(schemaPrefix))
            return ['BAD_REQUEST'];
        const kind = schemaRef.slice(schemaPrefix.length);
        if (!own(nativeSchemas[base].$defs, kind))
            return ['BAD_REQUEST'];
        const v = strictParseApiV14(stable(input), kind.endsWith('Request') || kind.endsWith('Body'));
        const [s, id] = nativeResolve(schemaRef, base);
        if (!nativeCheck(v, s, id))
            return ['BAD_REQUEST'];
        const body = kind.endsWith('Envelope') && kind !== 'ErrorEnvelope' ? v.data : v;
        switch (kind.replace(/Envelope$/, '')) {
            case 'Claim':
                claim(body);
                break;
            case 'ConversationSummary':
                summary(body);
                break;
            case 'ConversationList':
                list(body);
                break;
        }
        return [];
    }
    catch (error) {
        return [error instanceof Error && error.message === 'BINDING_CONFLICT' ? 'BINDING_CONFLICT' : 'BAD_REQUEST'];
    }
}
export function validateApiV14(input, schemaRef) { return apiV14Issues(input, schemaRef).length === 0; }
