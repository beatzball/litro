declare module 'autocannon' {
  interface Options {
    url: string;
    connections?: number;
    duration?: number;
  }

  interface Result {
    latency: { mean: number; p50: number; p97_5: number; p99: number; max: number };
    requests: { mean: number; total: number };
    throughput: { mean: number };
    errors: number;
    timeouts: number;
  }

  export default function autocannon(opts: Options): Promise<Result>;
}
