declare module 'autocannon' {
  interface Options {
    url: string;
    connections?: number;
    duration?: number;
  }

  interface Result {
    latency: { mean: number; min: number; stddev: number; p50: number; p97_5: number; p99: number; max: number };
    requests: { mean: number; total: number; min: number; max: number; stddev: number };
    throughput: { mean: number; min: number; max: number; stddev: number };
    non2xx: number;
    errors: number;
    timeouts: number;
  }

  export default function autocannon(opts: Options): Promise<Result>;
}
