import type { RunStats } from '../types.js';

export function computeStats(values: number[]): RunStats {
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
    mean: Math.round(mean),
    median: Math.round(median),
    p95: Math.round(p95),
    stddev: Math.round(stddev),
    min: Math.round(sorted[0]),
    max: Math.round(sorted[n - 1]),
  };
}
