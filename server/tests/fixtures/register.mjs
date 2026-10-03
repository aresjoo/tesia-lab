import { registerHooks } from 'node:module';
const fixture = new URL('./sdk.mjs', import.meta.url).href;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@anthropic-ai/sdk') return { url: fixture, shortCircuit: true };
  return next(specifier, context);
} });
// Any unexpected outbound request fails; loopback is only for actual local route QA.
const nativeFetch = globalThis.fetch;
globalThis.fetch = (url, options) => {
  if (!['127.0.0.1', 'localhost'].includes(new URL(String(url)).hostname)) throw new Error('EXTERNAL_NETWORK_FORBIDDEN');
  return nativeFetch(url, options);
};
