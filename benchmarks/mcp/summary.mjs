import { readFile } from 'node:fs/promises';
const result = JSON.parse(await readFile(new URL('./results/latest.json', import.meta.url), 'utf8'));
const fixed = (n, digits = 2) => n.toFixed(digits);
const spread = (s, scale = 1, digits = 2) => `${fixed(s.p50 / scale, digits)} [${fixed(s.min / scale, digits)}–${fixed(s.max / scale, digits)}]`;
console.log('| Framework | Transport | Install MiB | Build ms | Cold ms | Idle RSS MiB | list p50 / p95 ms | call p50 / p95 ms | UI bytes |');
console.log('| --- | --- | ---: | ---: | ---: | ---: | --- | --- | ---: |');
for (const [name, app] of Object.entries(result.apps)) {
  const transports = Object.entries(app.transports);
  if (!transports.length) {
    console.log(`| ${name} | N/A (client only) | ${fixed(app.installBytes / 2 ** 20)} | ${spread(app.build)} | N/A | N/A | N/A | N/A | N/A |`);
  }
  for (const [nameTransport, t] of transports) {
    const s = t.summary;
    console.log(`| ${name} | ${nameTransport} | ${fixed(app.installBytes / 2 ** 20)} | ${spread(app.build)} | ${spread(s.coldMs)} | ${spread(s.idleRssBytes, 2 ** 20)} | ${spread(s.listP50Ms)} / ${spread(s.listP95Ms)} | ${spread(s.callP50Ms)} / ${spread(s.callP95Ms)} | ${t.verification.resource?.bytes ?? 'N/A'} |`);
  }
}
console.log('\nEach cell is the median across runs [minimum–maximum]. Latency spreads describe per-run percentiles.');
console.log(`${result.method.buildRuns} clean builds per app; ${result.method.runs} fresh processes per supported transport; ${result.method.samplesPerMethodPerRun} timed requests per method per process, after ${result.method.warmupsPerMethodPerRun} warmups. Serial concurrency 1; client list cache bypassed. MiB = 1,048,576 bytes.`);
