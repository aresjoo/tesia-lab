import type { CatalogueCopySetup } from '../client-catalogue-copy-setup'
import type { CopyPresentation, SourceSelection, IssuedSourceBinding } from './presentation'
import type { createCandidateCopyController } from './controller'
export type CopyController = ReturnType<typeof createCandidateCopyController>
export type CatalogueCopySource = SourceSelection & { minimumDescriptor?: Readonly<{ policyVersionId: string; descriptorPolicyHash: string }> }
export type CatalogueCopyExecutionPort = Readonly<{
  scope:string
  controller:CopyController
  moneyUnit:'USDT'
  bindingForSource?:(selection:SourceSelection)=>IssuedSourceBinding|null
  prepareSetup:(sourceId:string, signal:AbortSignal, selection?:CatalogueCopySource)=>Promise<CatalogueCopySetup|null>
  copyForSource:(sourceId:string, sourceSha?:string)=>string|null
  sourceForCopy:(subscriptionId:string)=>string|null
}>
export const copyStateIsActual=(state:CopyPresentation['selectedCopy'])=>Boolean(state&&state.execution.origin==='exchange'&&state.execution.actualExecutionVerified)
