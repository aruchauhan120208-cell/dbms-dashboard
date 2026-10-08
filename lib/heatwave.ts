/**
 * lib/heatwave.ts — heatwave definition shared by the pipeline, API and UI.
 *
 * Threshold derived from the dataset itself: the CSV's own HEATWAVE flag flips
 * exactly between 316.3274 K (last flag=0) and 316.32788 K (first flag=1).
 */
export const THRESHOLD_K = Number(process.env.HEATWAVE_THRESHOLD_K ?? 316.32788);
export const THRESHOLD_C = round2(THRESHOLD_K - 273.15);

export function kToC(k: number | null | undefined): number | null {
  if (k === null || k === undefined || Number.isNaN(k)) return null;
  return round2(k - 273.15);
}

export function isHeatwave(tempK: number | null | undefined): boolean {
  if (tempK === null || tempK === undefined || Number.isNaN(tempK)) return false;
  return tempK >= THRESHOLD_K;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
