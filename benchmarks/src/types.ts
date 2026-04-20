export interface FrameworkResult {
  name: string;
  version: string;
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
