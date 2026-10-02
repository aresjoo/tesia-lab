import type { CatalogueCopyCalculation, CatalogueCopyPoint } from './client-catalogue-copy'
export const copyCalculationSourceSha: string
export function runSourceCatalogueCopy(copy: object, source: object, prices: (asset: string) => readonly number[], share: number): CatalogueCopyCalculation & { at: (index: number) => CatalogueCopyPoint }
