import { writeFileSync } from 'node:fs';

/** Strict synthetic SDK: no credential use and no network. Not provider evidence. */
export const constructorOptions = [];
export const dispatches = [];

const attempts = new Map();

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function record() {
  if (!process.env.TETH_RETRY_GUARD_RECEIPT) return;
  writeFileSync(process.env.TETH_RETRY_GUARD_RECEIPT, JSON.stringify({ constructorOptions, dispatches }));
}

export function resetRetryGuardFixture() {
  constructorOptions.length = 0;
  dispatches.length = 0;
  attempts.clear();
  record();
}

function scenarioFrom(params) {
  const raw = params.messages.find((message) => message.role === 'user' && typeof message.content === 'string' && message.content.startsWith('{'))?.content;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

function statusError(status) {
  const error = new Error(`synthetic provider status ${status}`);
  error.status = status;
  return error;
}

export default class AnthropicRetryGuardFixture {
  constructor(options = {}) {
    // Record only the tested non-secret option; never persist provider keys.
    constructorOptions.push({ maxRetries: options.maxRetries });
    record();
    this.beta = { messages: { stream: (params) => {
      const scenario = scenarioFrom(params);
      const key = scenario.caseId || 'default';
      const attempt = (attempts.get(key) || 0) + 1;
      attempts.set(key, attempt);
      dispatches.push({ attempt, params: clone(params) });
      record();

      const handlers = new Map();
      let aborted = false;
      return {
        on(name, callback) { handlers.set(name, callback); return this; },
        abort() { aborted = true; },
        async finalMessage() {
          if (scenario.failStatus && attempt === 1) {
            if (scenario.failStage === 'posttext') {
              handlers.get('text')?.('부분 응답은 보존됩니다.');
              handlers.get('streamEvent')?.({ type: 'message_delta', usage: { output_tokens: 4 } });
            } else if (scenario.failStage === 'posttoolstop') {
              handlers.get('streamEvent')?.({
                type: 'content_block_start',
                index: 0,
                content_block: { type: 'server_tool_use', name: 'web_search', input: { query: '관측된 부분 도구 요청' } },
              });
              handlers.get('streamEvent')?.({ type: 'content_block_stop', index: 0 });
            }
            throw statusError(scenario.failStatus);
          }

          const round = scenario.sequence ? params.messages.filter((message) => message.role === 'assistant').length : 0;
          const current = scenario.sequence?.[round] || {};
          if (current.toolUse) {
            handlers.get('streamEvent')?.({ type: 'content_block_start', index: 1, content_block: { type: 'tool_use', ...current.toolUse } });
            handlers.get('streamEvent')?.({ type: 'content_block_stop', index: 1 });
          }
          for (const text of current.chunks || ['재전송이 발생하면 보이는 대체 응답입니다.']) {
            handlers.get('text')?.(text);
            if (aborted) throw new Error('synthetic fixture aborted');
          }
          const content = current.toolUse
            ? [{ type: 'tool_use', ...current.toolUse }]
            : [{ type: 'text', text: (current.chunks || ['fixture response']).join('') }];
          return {
            model: scenario.model || 'fixture-model',
            stop_reason: current.stop || 'end_turn',
            usage: { input_tokens: 10, output_tokens: 20 },
            content,
          };
        },
      };
    } } };
  }
}
