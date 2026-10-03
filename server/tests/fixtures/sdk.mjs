import { writeFileSync } from 'node:fs';
/** Synthetic SDK fixture: no credential and no network. Not provider evidence. */
export const calls = [];
export default class AnthropicFixture {
  constructor() {
    this.beta = { messages: { stream(params) {
      calls.push(structuredClone(params));
      if (process.env.TETH_FIXTURE_RECEIPT) writeFileSync(process.env.TETH_FIXTURE_RECEIPT, JSON.stringify(params));
      const handlers = new Map();
      let aborted = false;
      let scenario;
      try { scenario = JSON.parse(params.messages.at(-1).content); } catch { scenario = {}; }
      return {
        on(name, callback) { handlers.set(name, callback); return this; },
        abort() { aborted = true; },
        async finalMessage() {
          if (scenario.fail) throw new Error('fixture provider failure');
          handlers.get('streamEvent')?.({ type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'PRIVATE_THINKING_SENTINEL' } });
          handlers.get('streamEvent')?.({ type: 'content_block_start', index: 0, content_block: { type: 'server_tool_use', name: 'web_search', input: { query: 'fixture observed query' } } });
          handlers.get('streamEvent')?.({ type: 'content_block_stop', index: 0 });
          for (const text of scenario.chunks || ['자료 기준 거래 수가 7회입니다. 표본의 한계가 있습니다.']) {
            handlers.get('text')?.(text);
            if (aborted) throw new Error('fixture aborted');
          }
          const final = { stop_reason: scenario.stop || 'end_turn', usage: { input_tokens: 10, output_tokens: 20 }, content: [{ type: 'text', text: 'fixture response' }] };
          return final;
        },
      };
    } } };
  }
}
