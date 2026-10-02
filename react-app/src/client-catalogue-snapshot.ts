/** Lazy module boundary: static JSON attributes work in both Node fixtures and
 * Vite module workers. Do not dynamically import transformed JSON with native
 * `type: json`: its development response is JavaScript, not JSON MIME. */
import spot from './client-catalogue-spot-data.json' with { type: 'json' }
import futures from './client-catalogue-futures-data.json' with { type: 'json' }
export { spot, futures }
