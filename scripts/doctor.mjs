#!/usr/bin/env node
import net from 'node:net';
import { readFile } from 'node:fs/promises';

function parseDotEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('error', () => resolve(false));
    socket.setTimeout(700, () => { socket.destroy(); resolve(false); });
  });
}

async function fetchStatus(url) {
  try {
    const res = await fetch(url);
    return res.status;
  } catch {
    return null;
  }
}

function major(v) {
  const m = String(v || '').match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

let passCount = 0;
let warnCount = 0;
let failCount = 0;

function pass(msg) { passCount += 1; console.log(`PASS  ${msg}`); }
function warn(msg) { warnCount += 1; console.log(`WARN  ${msg}`); }
function fail(msg) { failCount += 1; console.log(`FAIL  ${msg}`); }

async function main() {
  const envText = await readFile('.env', 'utf8').catch(() => '');
  const env = parseDotEnv(envText);

  const nodeMajor = major(process.versions.node);
  if (nodeMajor && nodeMajor >= 22) pass(`Node ${process.versions.node} (>=22)`);
  else fail(`Node ${process.versions.node} (need >=22)`);

  const npmUserAgent = process.env.npm_config_user_agent || '';
  const npmVer = (npmUserAgent.match(/npm\/(\d+\.\d+\.\d+)/) || [])[1];
  if (npmVer) {
    const npmMajor = major(npmVer);
    if (npmMajor && npmMajor >= 10) pass(`npm ${npmVer} (>=10)`);
    else warn(`npm ${npmVer} (<10, project prefers >=10)`);
  } else {
    warn('npm version unknown in this shell');
  }

  const required = ['JWT_SECRET', 'ALERTS_INTERNAL_KEY'];
  for (const key of required) {
    if (env[key] || process.env[key]) pass(`${key} is set`);
    else fail(`${key} missing (.env or shell)`);
  }

  const moralis =
    env.MORALIS_API_KEY ||
    env.VITE_MORALIS_API_KEY ||
    process.env.MORALIS_API_KEY ||
    process.env.VITE_MORALIS_API_KEY;
  if (moralis) pass('Moralis configured (MORALIS_API_KEY or VITE_MORALIS_API_KEY)');
  else warn('Moralis not set — server Moralis discovery/prices and dashboard Moralis fallbacks are off');

  const alchemy =
    env.ALCHEMY_API_KEY ||
    env.VITE_ALCHEMY_API_KEY ||
    process.env.ALCHEMY_API_KEY ||
    process.env.VITE_ALCHEMY_API_KEY;
  if (alchemy) pass('Alchemy configured (ALCHEMY_API_KEY or VITE_ALCHEMY_API_KEY)');
  else warn('Alchemy not set — server Alchemy paths and dashboard Alchemy fallbacks are off (public RPC used for landing wagmi if no key)');

  const backendPort = Number(process.env.BACKEND_PORT || env.PORT || 3002);
  const landingDefault = Number(process.env.LANDING_PORT || 3000);
  const dashboardDefault = Number(process.env.DASHBOARD_PORT || 3001);

  const bUp = await checkPort(backendPort);
  if (bUp) pass(`Backend port ${backendPort} is listening`);
  else warn(`Backend port ${backendPort} is not listening`);

  const lBusy = await checkPort(landingDefault);
  const dBusy = await checkPort(dashboardDefault);
  if (lBusy) warn(`Landing default port ${landingDefault} is occupied (dynamic runtime will auto-adjust)`);
  else pass(`Landing default port ${landingDefault} is free`);

  if (dBusy) warn(`Dashboard default port ${dashboardDefault} is occupied (dynamic runtime will auto-adjust)`);
  else pass(`Dashboard default port ${dashboardDefault} is free`);

  const health = await fetchStatus(`http://localhost:${backendPort}/api/health`);
  if (health === 200) pass(`GET /api/health -> 200`);
  else if (health === null) warn(`GET /api/health unreachable (backend likely down)`);
  else warn(`GET /api/health -> ${health}`);

  const nonce = await fetchStatus(`http://localhost:${backendPort}/api/siwe/nonce`);
  if (nonce === 200) pass(`GET /api/siwe/nonce -> 200`);
  else if (nonce === null) warn(`GET /api/siwe/nonce unreachable (backend likely down)`);
  else warn(`GET /api/siwe/nonce -> ${nonce}`);

  console.log('');
  const rateLimitEnv = [
    'GLOBAL_RATE_LIMIT_WINDOW_MS',
    'GLOBAL_RATE_LIMIT_MAX',
    'MUTATION_RATE_LIMIT_WINDOW_MS',
    'MUTATION_RATE_LIMIT_MAX',
    'INTERNAL_RATE_LIMIT_WINDOW_MS',
    'INTERNAL_RATE_LIMIT_MAX',
    'EXPENSIVE_READ_LIMIT_WINDOW_MS',
    'EXPENSIVE_READ_LIMIT_MAX',
  ];
  const presentRateLimitEnv = rateLimitEnv.filter((k) => (env[k] || process.env[k]) != null);
  if (presentRateLimitEnv.length > 0) {
    pass(`Rate-limit env overrides set: ${presentRateLimitEnv.join(', ')}`);
  } else {
    warn('Rate-limit env overrides not set (using secure defaults in server code)');
  }

  console.log('');
  console.log('Suggested next commands:');
  console.log('- npm run test:e2e:smoke');
  console.log('- npm run dev:runtime');

  console.log('');
  const result = failCount > 0 ? 'FAIL' : 'PASS';
  console.log(`RESULT  ${result} (pass=${passCount}, warn=${warnCount}, fail=${failCount})`);
  if (failCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error(`FAIL  doctor crashed: ${err.message}`);
  process.exit(1);
});
