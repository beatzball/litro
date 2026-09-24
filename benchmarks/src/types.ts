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
  pageWeight: Record<string, PageWeightResult>;
  lighthouse?: Record<string, LighthouseResult>;
}

export interface BenchmarkResults {
  meta: {
    timestamp: string;
    nodeVersion: string;
    platform: string;
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
    p50: number;
    p97_5: number;
    p99: number;
    max: number;
  };
  requests: {
    mean: number;
    total: number;
  };
  throughput: {
    mean: number;
  };
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

export interface LighthouseResult {
  performance: number;
  fcp: number;
  lcp: number;
  cls: number;
  tbt: number;
  speedIndex: number;
}

export interface StreamingResult {
  ttfb: number;
  ttlb: number;
  delta: number;
  totalBytes: number;
}
