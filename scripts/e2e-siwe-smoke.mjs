#!/usr/bin/env node
import net from 'node:net';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import jwt from 'jsonwebtoken';

const ROOT = process.cwd();
const started = [];

function log(msg) {
  console.log(`[e2e-smoke] ${msg}`);
}

function parseDotEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function start(name, cmd, args, env = process.env) {
  const child = spawn(cmd, args, {
    cwd: ROOT,
    env,
    stdio: 'ignore',
    shell: false,
  });
  started.push({ name, child });
  return child;
}

async function stopAll() {
  for (const { child } of started) {
    try { child.kill('SIGTERM'); } catch {}
  }
  await new Promise((r) => setTimeout(r, 700));
  for (const { child } of started) {
    try { child.kill('SIGKILL'); } catch {}
  }
}

function isPortFree(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen({ port, host }, () => server.close(() => resolve(true)));
  });
}

async function findFreePort(preferred, excluded = new Set(), max = 50) {
  for (let i = 0; i <= max; i += 1) {
    const port = preferred + i;
    if (excluded.has(port)) continue;
    const free4 = await isPortFree(port, '127.0.0.1');
    const free6 = await isPortFree(port, '::1').catch(() => true);
    if (free4 && free6) return port;
  }
  throw new Error(`No free port near ${preferred}`);
}

async function waitForHttp(url, expectStatus, timeoutMs = 25000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status === expectStatus) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const envText = await readFile(`${ROOT}/.env`, 'utf8').catch(() => '');
  const env = parseDotEnv(envText);
  const jwtSecret = process.env.JWT_SECRET || env.JWT_SECRET;
  assert(jwtSecret, 'JWT_SECRET missing (.env)');

  const backendPort = Number(process.env.BACKEND_PORT || env.PORT || 3002);

  const backendReady = await waitForHttp(`http://localhost:${backendPort}/api/siwe/nonce`, 200, 1800);
  if (!backendReady) {
    log(`Backend not detected on :${backendPort}, starting apps/server...`);
    start('backend', 'node', ['apps/server/server.js'], {
      ...process.env,
      PORT: String(backendPort),
    });
    const up = await waitForHttp(`http://localhost:${backendPort}/api/siwe/nonce`, 200, 30000);
    assert(up, `Backend failed to start on :${backendPort}`);
  } else {
    log(`Backend already running on :${backendPort}`);
  }

  const landingPort = await findFreePort(Number(process.env.LANDING_PORT || 3000), new Set([backendPort]));
  const dashboardPort = await findFreePort(Number(process.env.DASHBOARD_PORT || 3001), new Set([backendPort, landingPort]));

  const landingUrl = `http://localhost:${landingPort}`;
  const dashboardUrl = `http://localhost:${dashboardPort}`;
  const backendUrl = `http://localhost:${backendPort}`;

  log(`Landing: ${landingUrl}`);
  log(`Dashboard: ${dashboardUrl}`);
  log(`Backend: ${backendUrl}`);

  start('landing', 'npm', ['-w', 'apps/landing', 'run', 'dev', '--', '--port', String(landingPort)], {
    ...process.env,
    VITE_DASHBOARD_URL: dashboardUrl,
    VITE_API_URL: backendUrl,
    VITE_API_URL_ELECTRON: backendUrl,
  });

  start('dashboard', 'npm', ['-w', 'apps/dashboard', 'run', 'dev', '--', '--port', String(dashboardPort)], {
    ...process.env,
    VITE_LANDING_URL: landingUrl,
    VITE_API_URL_WEB: backendUrl,
    VITE_API_URL: backendUrl,
    BASE_URL: '/dashboard/',
  });

  const landingUp = await waitForHttp(`${landingUrl}/`, 200, 30000);
  assert(landingUp, 'Landing failed to start');
  const dashUp = await waitForHttp(`${dashboardUrl}/dashboard/`, 200, 30000);
  assert(dashUp, 'Dashboard failed to start');

  const nonceRes = await fetch(`${landingUrl}/api/siwe/nonce`);
  assert(nonceRes.status === 200, `Expected nonce 200, got ${nonceRes.status}`);

  const unauth = await fetch(`${dashboardUrl}/api/walletAddress`);
  assert(unauth.status === 401, `Expected walletAddress 401 when logged out, got ${unauth.status}`);

  const wallet = '0x1111111111111111111111111111111111111111';
  const token = jwt.sign({ sub: wallet.toLowerCase() }, jwtSecret, { expiresIn: '7d' });
  const authCookie = `token=${token}`;

  const authRes = await fetch(`${dashboardUrl}/api/walletAddress`, {
    headers: { cookie: authCookie },
  });
  assert(authRes.status === 200, `Expected walletAddress 200 with cookie, got ${authRes.status}`);
  const authJson = await authRes.json();
  assert(authJson?.address?.toLowerCase?.() === wallet.toLowerCase(), 'Session address mismatch');

  const logoutRes = await fetch(`${dashboardUrl}/api/logout`, {
    method: 'POST',
    headers: { cookie: authCookie },
  });
  assert(logoutRes.status === 200, `Expected logout 200, got ${logoutRes.status}`);
  const clearSetCookie = logoutRes.headers.get('set-cookie') || '';
  assert(clearSetCookie.includes('token='), 'Logout did not return token clearing cookie header');

  const clearedCookie = clearSetCookie.split(';')[0];
  const afterLogout = await fetch(`${dashboardUrl}/api/walletAddress`, {
    headers: { cookie: clearedCookie },
  });
  assert(afterLogout.status === 401, `Expected 401 after cleared cookie, got ${afterLogout.status}`);

  log('PASS: E2E SIWE smoke checks completed');
}

main()
  .catch(async (err) => {
    console.error(`[e2e-smoke] FAIL: ${err.message}`);
    await stopAll();
    process.exit(1);
  })
  .then(async () => {
    await stopAll();
  });
