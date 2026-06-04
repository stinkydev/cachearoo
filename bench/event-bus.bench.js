#!/usr/bin/env node
/*
 * Micro-benchmark for the WebSocket event bus (WSAPI.wsBroadcastChange /
 * wsBroadcastBinary). Exercises the REAL compiled class with fake client
 * connections injected, so it measures the matching + serialization + dispatch
 * hot path without touching the network.
 *
 *   npm run bench
 *
 * Reports events/sec and payload throughput for a few representative fan-out
 * shapes. Numbers are only meaningful relative to each other (same machine,
 * same run) — use them to compare before/after a change, not as absolutes.
 */
'use strict';

process.env.NODE_ENV = 'test'; // logger becomes a no-op stub
const path = require('path');

const BUILD = path.resolve(__dirname, '..', 'build', 'app');
let WSAPI;
try {
  ({ WSAPI } = require(path.join(BUILD, 'api', 'ws', 'ws-api')));
} catch (e) {
  console.error('Could not load compiled WSAPI. Run `npm run build-backend` first.');
  console.error(e.message);
  process.exit(1);
}

// A fake connection: same shape wsBroadcastChange/Binary touch. send() just
// accounts bytes into a global sink so the JS engine can't elide the work.
let SINK = 0;
function makeClient(registeredEvents, { isReplication = false, sendValues = true } = {}) {
  return {
    info: { events: 0, bytesSent: 0 },
    registeredEvents,
    isReplication,
    sendValues,
    send(data) { SINK += typeof data === 'string' ? data.length : data.length; },
  };
}

function newApi(clients) {
  const ws = new WSAPI({}); // datastore is only stored, never used by broadcast
  ws.wsClients = clients;   // private field, injected for benchmarking
  return ws;
}

function bench(name, { clients, events, run }) {
  const ws = newApi(clients);
  // warmup
  for (let i = 0; i < Math.min(events, 5000); i++) run(ws, i);
  SINK = 0;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < events; i++) run(ws, i);
  const t1 = process.hrtime.bigint();
  const secs = Number(t1 - t0) / 1e9;
  const evPerSec = events / secs;
  const mbOut = SINK / (1024 * 1024);
  console.log(
    `${name.padEnd(34)} ${(evPerSec).toLocaleString('en-US', { maximumFractionDigits: 0 }).padStart(12)} ev/s` +
    `   ${secs.toFixed(3)}s   ${(mbOut / secs).toFixed(0).padStart(5)} MB/s out`,
  );
}

const SMALL = { a: 1, b: 'hello', c: true };
const LARGE = { id: 'x'.repeat(32), payload: Array.from({ length: 200 }, (_, i) => ({ i, v: 'value-' + i })) };

function star() { return [{ bucket: '*', key: '*' }]; }
function bucketReg(b) { return [{ bucket: b, key: '*' }]; }

console.log('\nEvent-bus benchmark (higher ev/s is better)\n' + '-'.repeat(72));

// 1. Wide fan-out: 1000 clients all subscribed to everything, small payload.
bench('fanout-1000 wildcard small', {
  clients: Array.from({ length: 1000 }, () => makeClient(star())),
  events: 20000,
  run: (ws) => ws.wsBroadcastChange('b', 'k', SMALL, false, null, '2026-01-01T00:00:00Z'),
});

// 2. Wide fan-out, large payload (stringify cost dominates).
bench('fanout-1000 wildcard large', {
  clients: Array.from({ length: 1000 }, () => makeClient(star())),
  events: 4000,
  run: (ws) => ws.wsBroadcastChange('b', 'k', LARGE, false, null, '2026-01-01T00:00:00Z'),
});

// 3. Selective: 1000 clients spread across 50 buckets; events round-robin buckets.
bench('selective 1000 clients / 50 bkt', {
  clients: Array.from({ length: 1000 }, (_, i) => makeClient(bucketReg('bucket-' + (i % 50)))),
  events: 20000,
  run: (ws, i) => ws.wsBroadcastChange('bucket-' + (i % 50), 'k', SMALL, false, null, '2026-01-01T00:00:00Z'),
});

// 4. sendValues=false subscribers (no value in payload).
bench('fanout-1000 sendValues=false', {
  clients: Array.from({ length: 1000 }, () => makeClient(star(), { sendValues: false })),
  events: 20000,
  run: (ws) => ws.wsBroadcastChange('b', 'k', LARGE, false, null, '2026-01-01T00:00:00Z'),
});

// 5. Duplicate registrations: each client registered to both {b,k} and {b,*}.
bench('dup-reg 500 clients', {
  clients: Array.from({ length: 500 }, () => makeClient([{ bucket: 'b', key: 'k' }, { bucket: 'b', key: '*' }])),
  events: 20000,
  run: (ws) => ws.wsBroadcastChange('b', 'k', SMALL, false, null, '2026-01-01T00:00:00Z'),
});

// 6. Binary broadcast fan-out.
const buf = Buffer.alloc(4096, 7);
bench('binary fanout-1000 wildcard', {
  clients: Array.from({ length: 1000 }, () => makeClient(star())),
  events: 20000,
  run: (ws) => ws.wsBroadcastBinary('b', 'k', buf, null),
});

console.log('-'.repeat(72));
console.log(`(sink=${SINK} — printed so dispatch work is not optimized away)\n`);
