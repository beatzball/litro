import type { RunStats } from '../types.js';

export function computeStats(values: number[], precision = 0): RunStats {
  if (values.length === 0 || values.some(v => !Number.isFinite(v))) {
    throw new Error('Statistics require at least one finite sample');
  }
  const round = (value: number) => Number(value.toFixed(precision));
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const mean = sorted.reduce((sum, v) => sum + v, 0) / n;

  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  const p95Index = Math.ceil(n * 0.95) - 1;
  const p95 = sorted[Math.min(p95Index, n - 1)];

  const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);

  return {
    runs: values,
    mean: round(mean),
    median: round(median),
    p95: round(p95),
    stddev: round(stddev),
    min: round(sorted[0]),
    max: round(sorted[n - 1]),
  };
}
