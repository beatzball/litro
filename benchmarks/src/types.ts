export interface FrameworkResult {
  name: string;
  /** Version of the headline package — the one the framework is named after. */
  version: string;
  /**
   * Every package version that shapes this app's numbers, resolved from the
   * app's own node_modules at run time. The headline `version` alone hides the
   * rest of the stack: a Litro result says nothing about Lit or @lit-labs/ssr,
   * and a Next result says nothing about React. The published figures carry a
   * date, so the file has to say what was actually measured.
   *
   * A package that is not installed in the app is left out rather than
   * recorded as "unknown".
   */
  versions: Record<string, string>;
  buildTime: RunStats;
  outputSize: number;
  bundleSize: BundleSizeBreakdown;
  /** Static file serving through the same preview server for every app. */
  httpPerf: Record<string, AutocannonResult>;
  rendering: 'ssg';
  /** Streaming measures per-request SSR in the docs app only. */
  streaming: null;
  pageWeight: Record<string, PageWeightResult>;
  lighthouse?: Record<string, LighthouseResult>;
}

export interface BenchmarkResults {
  meta: {
    timestamp: string;
    nodeVersion: string;
    platform: string;
    osVersion: string;
    pnpmVersion: string;
    context: string;
    loadAverageEnd?: [number, number, number];
    settings: {
      buildRuns: number;
      lighthouseRuns: number;
      streamingRuns: number;
      httpConnections: number;
      httpDurationSeconds: number;
      crossFramework: boolean;
      hn: boolean;
      buildCache: 'cold';
      comparisonServing: 'static files via serve';
      lighthousePreset: 'default mobile simulated throttling';
      httpRunsPerRoute: number;
    };
    arch: string;
    cpuModel: string;
    cpuCount: number;
    memoryGB: number;
    /**
     * System load average at the moment the run started, as [1m, 5m, 15m].
     *
     * Published figures carry a date, so they have to carry the condition they
     * were taken under too. A build time measured while something else was
     * using the machine is not comparable with one measured on an idle one,
     * and nothing else in this file would say which it was.
     */
    loadAverage: [number, number, number];
    commitSha: string;
    commitMessage: string;
  };
  buildTime: {
    ssg: RunStats;
    ssr: RunStats;
  };
  bundleSize: {
    ssg: BundleSizeBreakdown;
    ssr: BundleSizeBreakdown;
  };
  httpPerf: {
    ssg: Record<string, AutocannonResult>;
    ssr: Record<string, AutocannonResult>;
  };
  pageWeight: {
    ssg: Record<string, PageWeightResult>;
    ssr: Record<string, PageWeightResult>;
  };
  lighthouse: {
    ssg: Record<string, LighthouseResult>;
  };
  streaming: {
    ssr: Record<string, StreamingResult>;
  };
  crossFramework?: FrameworkResult[];
  hnBenchmark?: FrameworkResult[];
}

export interface RunStats {
  runs: number[];
  mean: number;
  median: number;
  p95: number;
  stddev: number;
  min: number;
  max: number;
}

export interface BundleSizeBreakdown {
  clientJS: number;
  clientCSS: number;
  serverBundle: number;
  staticHTML: number;
  totalOutput: number;
}

export interface AutocannonResult {
  latency: {
    mean: number;
    min: number;
    stddev: number;
    p50: number;
    p97_5: number;
    p99: number;
    max: number;
  };
  requests: {
    mean: number;
    total: number;
    min: number;
    max: number;
    stddev: number;
  };
  throughput: {
    mean: number;
    min: number;
    max: number;
    stddev: number;
  };
  runCount: number;
  non2xx: number;
  errors: number;
  timeouts: number;
  duration: number;
  connections: number;
}

export interface PageWeightResult {
  rawBytes: number;
  gzipBytes: number;
  statusCode: number;
}

export interface LighthouseMetrics {
  performance: number;
  fcp: number;
  lcp: number;
  cls: number;
  tbt: number;
  speedIndex: number;
}

export interface LighthouseResult extends LighthouseMetrics {
  runCount: number;
  /** Scalars above retain the run with the median performance score. */
  statistics: Record<keyof LighthouseMetrics, RunStats>;
}

export interface StreamingResult {
  ttfb: number;
  ttlb: number;
  delta: number;
  totalBytes: number;
  runCount: number;
  statistics: Record<'ttfb' | 'ttlb' | 'delta' | 'totalBytes', RunStats>;
}
