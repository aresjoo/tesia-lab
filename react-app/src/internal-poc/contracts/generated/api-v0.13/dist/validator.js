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
const nativeSchemas = { "https://contracts.tesia.ai/api/v0.13.0/consultation.schema.json": { "$schema": "https://json-schema.org/draft/2020-12/schema", "$id": "https://contracts.tesia.ai/api/v0.13.0/consultation.schema.json", "title": "TETH consultation candidate \u2014 no strategy or order authority", "$defs": { "Id": { "type": "string", "minLength": 16, "maxLength": 128, "pattern": "^[A-Za-z0-9_-]+$(?![\\s\\S])" }, "Sequence": { "type": "integer", "minimum": 0, "maximum": 9007199254740991 }, "Limit": { "type": "integer", "minimum": 1, "maximum": 100, "default": 100 }, "Timestamp": { "description": "UTC calendar timestamp, year 0001..9999, hour 00..23, second 00..59; all timestamps validated before intra-response relations.", "type": "string", "format": "date-time", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]{1,6})?Z$(?![\\s\\S])" }, "Text": { "type": "string", "minLength": 1, "maxLength": 16000, "pattern": "^(?![\\s\\S]*[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f-\\u009f\\u202a-\\u202e\\u2066-\\u2069])[\\s\\S]*[^\\u0009-\\u000d\\u0020\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff][\\s\\S]*$(?![\\s\\S])" }, "Cursor": { "type": "string", "minLength": 16, "maxLength": 512, "pattern": "^[A-Za-z0-9_-]+$(?![\\s\\S])" }, "State": { "enum": ["QUEUED", "DISPATCHING", "COMPLETED", "FAILED", "CANCELLED", "AMBIGUOUS"] }, "TerminalState": { "enum": ["COMPLETED", "FAILED", "CANCELLED", "AMBIGUOUS"] }, "FailureCode": { "enum": ["PROVIDER_REJECTED", "PROVIDER_UNAVAILABLE", "TIMEOUT", "OUTPUT_REJECTED", "CANCELLED", "DISPATCH_UNCONFIRMED", "INTERNAL_ERROR"] }, "Usage": { "type": "object", "additionalProperties": false, "properties": { "status": { "enum": ["UNKNOWN", "REPORTED"] }, "inputTokens": { "anyOf": [{ "type": "integer", "minimum": 0, "maximum": 1000000000 }, { "type": "null" }] }, "outputTokens": { "anyOf": [{ "type": "integer", "minimum": 0, "maximum": 1000000000 }, { "type": "null" }] } }, "required": ["status", "inputTokens", "outputTokens"] }, "Capabilities": { "type": "object", "additionalProperties": false, "properties": { "available": { "type": "boolean" }, "reason": { "anyOf": [{ "enum": ["DISABLED", "NOT_CONFIGURED", "NOT_READY"] }, { "type": "null" }] }, "maxTextChars": { "const": 16000 }, "maxPageItems": { "const": 100 }, "researchEvents": { "const": "OBSERVATIONS_ONLY" }, "executionAuthority": { "const": false } }, "required": ["available", "reason", "maxTextChars", "maxPageItems", "researchEvents", "executionAuthority"] }, "CapabilitiesRequest": { "type": "object", "additionalProperties": false, "properties": {}, "required": [] }, "CreateRequest": { "type": "object", "additionalProperties": false, "properties": { "conversationId": { "anyOf": [{ "$ref": "#/$defs/Id" }, { "type": "null" }] }, "clientMessageId": { "$ref": "#/$defs/Id" }, "text": { "$ref": "#/$defs/Text" } }, "required": ["conversationId", "clientMessageId", "text"] }, "TurnRequest": { "type": "object", "additionalProperties": false, "properties": { "turnId": { "$ref": "#/$defs/Id" } }, "required": ["turnId"] }, "EventsRequest": { "type": "object", "additionalProperties": false, "properties": { "turnId": { "$ref": "#/$defs/Id" }, "after": { "$ref": "#/$defs/Sequence" }, "limit": { "$ref": "#/$defs/Limit" } }, "required": ["turnId", "after"] }, "HistoryRequest": { "type": "object", "additionalProperties": false, "properties": { "conversationId": { "$ref": "#/$defs/Id" }, "limit": { "$ref": "#/$defs/Limit" }, "cursor": { "$ref": "#/$defs/Cursor" } }, "required": ["conversationId"] }, "CancelRequest": { "type": "object", "additionalProperties": false, "properties": { "turnId": { "$ref": "#/$defs/Id" } }, "required": ["turnId"] }, "Turn": { "type": "object", "additionalProperties": false, "properties": { "turnId": { "$ref": "#/$defs/Id" }, "conversationId": { "$ref": "#/$defs/Id" }, "clientMessageId": { "$ref": "#/$defs/Id" }, "state": { "$ref": "#/$defs/State" }, "createdAt": { "$ref": "#/$defs/Timestamp" }, "updatedAt": { "$ref": "#/$defs/Timestamp" }, "userText": { "$ref": "#/$defs/Text" }, "answerText": { "type": "string", "minLength": 0, "maxLength": 64000, "pattern": "^(?![\\s\\S]*[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f-\\u009f\\u202a-\\u202e\\u2066-\\u2069])[\\s\\S]*$(?![\\s\\S])" }, "lastSequence": { "$ref": "#/$defs/Sequence" }, "terminalSequence": { "anyOf": [{ "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, { "type": "null" }] }, "cancelRequested": { "description": "Observed explicit user cancel request. Must be true when state is CANCELLED; does not prove remote task termination.", "type": "boolean" }, "usage": { "$ref": "#/$defs/Usage" }, "failureCode": { "anyOf": [{ "$ref": "#/$defs/FailureCode" }, { "type": "null" }] } }, "required": ["turnId", "conversationId", "clientMessageId", "state", "createdAt", "updatedAt", "userText", "answerText", "lastSequence", "terminalSequence", "cancelRequested", "usage", "failureCode"] }, "AnswerDelta": { "type": "object", "additionalProperties": false, "properties": { "type": { "const": "answer_delta" }, "text": { "type": "string", "minLength": 1, "maxLength": 4096, "pattern": "^(?![\\s\\S]*[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f-\\u009f\\u202a-\\u202e\\u2066-\\u2069])[\\s\\S]*$(?![\\s\\S])" } }, "required": ["type", "text"] }, "ToolObservation": { "type": "object", "additionalProperties": false, "properties": { "type": { "const": "tool_observation" }, "toolCallId": { "$ref": "#/$defs/Id" }, "tool": { "enum": ["web_search", "web_fetch", "market_data"] }, "state": { "enum": ["STARTED", "COMPLETED", "FAILED"] }, "failureCode": { "anyOf": [{ "$ref": "#/$defs/FailureCode" }, { "type": "null" }] } }, "required": ["type", "toolCallId", "tool", "state", "failureCode"] }, "SourceObservation": { "type": "object", "additionalProperties": false, "properties": { "type": { "const": "source_observation" }, "sourceId": { "$ref": "#/$defs/Id" }, "title": { "type": "string", "minLength": 1, "maxLength": 256, "pattern": "^(?![\\s\\S]*[\\u0000-\\u001f\\u007f-\\u009f\\u202a-\\u202e\\u2066-\\u2069])[\\s\\S]*$(?![\\s\\S])" }, "href": { "type": "string", "minLength": 12, "maxLength": 2048, "pattern": "^https://[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?(?::443)?(?:/(?:[A-Za-z0-9._~!$&'()*+,;=:@/-]|%[0-9A-Fa-f]{2})*)?(?:\\?(?:[A-Za-z0-9._~!$&'()*+,;=:@/?-]|%[0-9A-Fa-f]{2})*)?$(?![\\s\\S])" } }, "required": ["type", "sourceId", "title", "href"] }, "UsageObservation": { "type": "object", "additionalProperties": false, "properties": { "type": { "const": "usage" }, "usage": { "$ref": "#/$defs/Usage" } }, "required": ["type", "usage"] }, "Terminal": { "type": "object", "additionalProperties": false, "properties": { "type": { "const": "terminal" }, "state": { "$ref": "#/$defs/TerminalState" }, "usage": { "$ref": "#/$defs/Usage" }, "failureCode": { "anyOf": [{ "$ref": "#/$defs/FailureCode" }, { "type": "null" }] } }, "required": ["type", "state", "usage", "failureCode"] }, "Event": { "type": "object", "additionalProperties": false, "properties": { "turnId": { "$ref": "#/$defs/Id" }, "sequence": { "type": "integer", "minimum": 1, "maximum": 9007199254740991 }, "observedAt": { "$ref": "#/$defs/Timestamp" }, "payload": { "oneOf": [{ "$ref": "#/$defs/AnswerDelta" }, { "$ref": "#/$defs/ToolObservation" }, { "$ref": "#/$defs/SourceObservation" }, { "$ref": "#/$defs/UsageObservation" }, { "$ref": "#/$defs/Terminal" }] } }, "required": ["turnId", "sequence", "observedAt", "payload"] }, "Events": { "type": "object", "additionalProperties": false, "properties": { "turnId": { "$ref": "#/$defs/Id" }, "after": { "$ref": "#/$defs/Sequence" }, "nextSequence": { "$ref": "#/$defs/Sequence" }, "events": { "type": "array", "items": { "$ref": "#/$defs/Event" }, "maxItems": 100 }, "hasMore": { "type": "boolean" }, "terminal": { "type": "boolean" }, "limit": { "$ref": "#/$defs/Limit" } }, "required": ["turnId", "after", "nextSequence", "events", "hasMore", "terminal", "limit"] }, "History": { "type": "object", "additionalProperties": false, "properties": { "conversationId": { "$ref": "#/$defs/Id" }, "snapshotId": { "$ref": "#/$defs/Id" }, "offset": { "$ref": "#/$defs/Sequence" }, "limit": { "$ref": "#/$defs/Limit" }, "totalCount": { "$ref": "#/$defs/Sequence" }, "turns": { "type": "array", "items": { "$ref": "#/$defs/Turn" }, "maxItems": 100 }, "nextCursor": { "anyOf": [{ "$ref": "#/$defs/Cursor" }, { "type": "null" }] } }, "required": ["conversationId", "snapshotId", "offset", "limit", "totalCount", "turns", "nextCursor"] }, "Cancel": { "type": "object", "additionalProperties": false, "properties": { "turn": { "$ref": "#/$defs/Turn" }, "accepted": { "type": "boolean" } }, "required": ["turn", "accepted"] }, "ErrorCode": { "enum": ["BAD_REQUEST", "AUTHENTICATION_REQUIRED", "FORBIDDEN", "CSRF_INVALID", "ORIGIN_INVALID", "NOT_FOUND", "IDEMPOTENCY_KEY_REUSED", "CLIENT_MESSAGE_ID_REUSED", "TURN_IN_PROGRESS", "CURSOR_INVALID", "BUDGET_EXCEEDED", "RATE_LIMITED", "PROVIDER_UNAVAILABLE", "INTERNAL_ERROR"] }, "ErrorEnvelope": { "type": "object", "additionalProperties": false, "properties": { "apiContractVersion": { "const": "0.13.0" }, "error": { "type": "object", "additionalProperties": false, "properties": { "code": { "$ref": "#/$defs/ErrorCode" }, "message": { "const": "Consultation request failed." } }, "required": ["code", "message"] } }, "required": ["apiContractVersion", "error"] }, "CapabilitiesEnvelope": { "type": "object", "additionalProperties": false, "properties": { "apiContractVersion": { "const": "0.13.0" }, "data": { "$ref": "#/$defs/Capabilities" } }, "required": ["apiContractVersion", "data"] }, "TurnEnvelope": { "type": "object", "additionalProperties": false, "properties": { "apiContractVersion": { "const": "0.13.0" }, "data": { "$ref": "#/$defs/Turn" } }, "required": ["apiContractVersion", "data"] }, "EventsEnvelope": { "type": "object", "additionalProperties": false, "properties": { "apiContractVersion": { "const": "0.13.0" }, "data": { "$ref": "#/$defs/Events" } }, "required": ["apiContractVersion", "data"] }, "HistoryEnvelope": { "type": "object", "additionalProperties": false, "properties": { "apiContractVersion": { "const": "0.13.0" }, "data": { "$ref": "#/$defs/History" } }, "required": ["apiContractVersion", "data"] }, "CancelEnvelope": { "type": "object", "additionalProperties": false, "properties": { "apiContractVersion": { "const": "0.13.0" }, "data": { "$ref": "#/$defs/Cancel" } }, "required": ["apiContractVersion", "data"] } } } };
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
// Closed wire facts only; does not attest session, storage, source or cost.
const base = "https://contracts.tesia.ai/api/v0.13.0/consultation.schema.json";
const schemaPrefix = 'consultation.schema.json#/$defs/';
const terminalStates = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'AMBIGUOUS']);
export function strictParseApiV13(payload, request = false) {
    const max = request ? 65536 : 262144;
    if (typeof payload !== 'string' || payload.length > max || new TextEncoder().encode(payload).length > max)
        throw Error('BAD_REQUEST');
    return strictParseReportingV01(payload);
}
function requireWire(condition) { if (!condition)
    throw Error('BINDING_CONFLICT'); }
function usage(v) {
    requireWire(v.status === 'UNKNOWN' ? v.inputTokens === null && v.outputTokens === null : v.inputTokens !== null && v.outputTokens !== null);
}
function failure(state, code) {
    requireWire(state === 'COMPLETED' ? code === null : state === 'CANCELLED' ? code === 'CANCELLED' : state === 'AMBIGUOUS' ? code === 'DISPATCH_UNCONFIRMED' : code !== null && code !== 'CANCELLED' && code !== 'DISPATCH_UNCONFIRMED');
}
function timestamp(value) {
    // Canonical UTC lexical order preserves microseconds even near year9999.
    const match = /^(.*?)(?:\.([0-9]{1,6}))?Z$/.exec(value);
    return match[1] + '.' + (match[2] ?? '').padEnd(6, '0') + 'Z';
}
function turn(v) {
    requireWire(new TextEncoder().encode(stable(v)).length + 4096 <= 262144);
    usage(v.usage);
    requireWire(timestamp(v.createdAt) <= timestamp(v.updatedAt));
    if (v.answerText.length > 0)
        requireWire(v.lastSequence >= (terminalStates.has(v.state) ? 2 : 1));
    if (terminalStates.has(v.state)) {
        requireWire(v.terminalSequence === v.lastSequence && v.lastSequence > 0);
        failure(v.state, v.failureCode);
        if (v.state === 'CANCELLED')
            requireWire(v.cancelRequested);
        if (v.state === 'COMPLETED')
            requireWire(v.answerText.trim().length > 0);
    }
    else
        requireWire(v.terminalSequence === null && v.failureCode === null);
    if (v.state === 'QUEUED')
        requireWire(v.lastSequence === 0 && v.answerText === '');
}
function event(v) {
    const p = v.payload;
    if (p.type === 'usage' || p.type === 'terminal')
        usage(p.usage);
    if (p.type === 'terminal')
        failure(p.state, p.failureCode);
    if (p.type === 'tool_observation')
        requireWire((p.failureCode !== null) === (p.state === 'FAILED'));
}
function events(v) {
    requireWire(v.events.length <= v.limit);
    for (let i = 0; i < v.events.length; i++) {
        const row = v.events[i];
        event(row);
        requireWire(row.turnId === v.turnId && row.sequence === v.after + i + 1);
        requireWire(row.payload.type !== 'terminal' || i === v.events.length - 1);
    }
    requireWire(v.nextSequence === v.after + v.events.length);
    requireWire(!v.hasMore || v.events.length > 0);
    if (v.events.some((row) => row.payload.type === 'terminal'))
        requireWire(v.terminal && !v.hasMore);
    if (v.terminal)
        requireWire(!v.hasMore && (v.events.length ? v.events.at(-1).payload.type === 'terminal' : v.after > 0));
}
function history(v) {
    requireWire(v.offset <= v.totalCount && v.turns.length <= Math.min(v.limit, v.totalCount - v.offset));
    requireWire(v.turns.length > 0 || v.offset === 0 && v.totalCount === 0);
    requireWire((v.nextCursor !== null) === (v.offset + v.turns.length < v.totalCount));
    requireWire(new Set(v.turns.map((row) => row.turnId)).size === v.turns.length);
    requireWire(new Set(v.turns.map((row) => row.clientMessageId)).size === v.turns.length);
    let previous = null;
    for (const row of v.turns) {
        turn(row);
        requireWire(row.conversationId === v.conversationId);
        const key = [timestamp(row.createdAt), row.turnId];
        requireWire(previous === null || previous[0] < key[0] || previous[0] === key[0] && previous[1] < key[1]);
        previous = key;
    }
}
export function apiV13Issues(input, schemaRef) {
    try {
        if (typeof schemaRef !== 'string' || !schemaRef.startsWith(schemaPrefix))
            return ['BAD_REQUEST'];
        const kind = schemaRef.slice(schemaPrefix.length);
        if (!own(nativeSchemas[base].$defs, kind))
            return ['BAD_REQUEST'];
        const v = strictParseApiV13(stable(input), kind.endsWith('Request'));
        const [s, id] = nativeResolve(schemaRef, base);
        if (!nativeCheck(v, s, id))
            return ['BAD_REQUEST'];
        const body = kind.endsWith('Envelope') && kind !== 'ErrorEnvelope' ? v.data : v;
        switch (kind.replace(/Envelope$/, '')) {
            case 'Usage':
                usage(body);
                break;
            case 'Capabilities':
                requireWire(body.available === (body.reason === null));
                break;
            case 'Turn':
                turn(body);
                break;
            case 'Event':
                event(body);
                break;
            case 'Terminal':
            case 'ToolObservation':
            case 'UsageObservation':
                event({ payload: body });
                break;
            case 'Events':
                events(body);
                break;
            case 'History':
                history(body);
                break;
            case 'Cancel':
                turn(body.turn);
                requireWire(!body.accepted || body.turn.cancelRequested && !terminalStates.has(body.turn.state));
                requireWire(body.accepted || terminalStates.has(body.turn.state));
                break;
        }
        return [];
    }
    catch (error) {
        return [error instanceof Error && error.message === 'BINDING_CONFLICT' ? 'BINDING_CONFLICT' : 'BAD_REQUEST'];
    }
}
export function validateApiV13(input, schemaRef) { return apiV13Issues(input, schemaRef).length === 0; }
