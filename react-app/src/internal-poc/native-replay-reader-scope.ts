import { NativeServiceTransport } from './native-service-api'
import { createNativeReplayChartReader, type NativeReplayChartReader, type NativeReplayReaderInput } from './native-replay-chart-reader'

export type NativeReplayRequest = Pick<NativeReplayReaderInput, 'job' | 'report' | 'trades' | 'segment'> & {
  expectedManifestContentHash: string
}
export type NativeReplayReaderFactory = (request: NativeReplayRequest) => NativeReplayChartReader

/** App-owned visual reads, never its shared job/result transport. Creating the
 * scope is inert (also under StrictMode); only an explicit read sends a GET.
 */
export function createNativeReplayReaderScope() {
  let owner = new AbortController()
  return {
    create(request: NativeReplayRequest, isCurrent: () => boolean): NativeReplayChartReader {
      return createNativeReplayChartReader({ ...request, transport: new NativeServiceTransport(), ownerSignal: owner.signal, isCurrent })
    },
    invalidate() {
      owner.abort()
      owner = new AbortController()
    },
  }
}
