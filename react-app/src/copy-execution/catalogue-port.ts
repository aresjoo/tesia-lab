import type { CatalogueCopySetup } from '../client-catalogue-copy-setup'
import type { CopyPresentation } from './presentation'
import type { createCandidateCopyController } from './controller'
export type CopyController = ReturnType<typeof createCandidateCopyController>
export type CatalogueCopyExecutionPort = Readonly<{
  scope:string
  controller:CopyController
  moneyUnit:'USDT'
  prepareSetup:(sourceId:string, signal:AbortSignal)=>Promise<CatalogueCopySetup|null>
  copyForSource:(sourceId:string)=>string|null
  sourceForCopy:(subscriptionId:string)=>string|null
}>
export const copyStateIsActual=(state:CopyPresentation['selectedCopy'])=>Boolean(state&&state.execution.origin==='exchange'&&state.execution.actualExecutionVerified)
