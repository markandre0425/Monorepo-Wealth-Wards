#!/usr/bin/env node
import net from 'node:net';
import { spawn } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');

function isPortFree(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen({ port, host }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findFreePort(preferred, { max = 50, excluded = new Set() } = {}) {
  for (let i = 0; i <= max; i += 1) {
    const port = preferred + i;
    if (excluded.has(port)) continue;
    // Check localhost and loopback explicitly
    const freeA = await isPortFree(port, '127.0.0.1');
    const freeB = await isPortFree(port, '::1').catch(() => true);
    if (freeA && freeB) return port;
  }
  throw new Error(`No free port found near ${preferred}`);
}

function start(name, command, commandArgs, env) {
  const child = spawn(command, commandArgs, {
    env,
    stdio: 'inherit',
    shell: false,
  });

  child.on('exit', (code, signal) => {
    const why = signal ? `signal ${signal}` : `code ${code}`;
    console.log(`[${name}] exited (${why})`);
  });

  return child;
}

async function main() {
  const backendPort = Number(process.env.BACKEND_PORT || 3002);

  const landingPort = await findFreePort(Number(process.env.LANDING_PORT || 3000), {
    excluded: new Set([backendPort]),
  });
  const dashboardPort = await findFreePort(Number(process.env.DASHBOARD_PORT || 3001), {
    excluded: new Set([backendPort, landingPort]),
  });

  const landingUrl = `http://localhost:${landingPort}`;
  const dashboardUrl = `http://localhost:${dashboardPort}`;
  const backendUrl = `http://localhost:${backendPort}`;

  console.log('Dynamic runtime ports selected:');
  console.log(`- Landing:   ${landingUrl}`);
  console.log(`- Dashboard: ${dashboardUrl}`);
  console.log(`- Backend:   ${backendUrl}`);
  console.log('');
  console.log('Env wiring:');
  console.log(`- Landing  VITE_DASHBOARD_URL=${dashboardUrl}`);
  console.log(`- Dashboard VITE_LANDING_URL=${landingUrl}`);
  console.log(`- Dashboard VITE_API_URL_WEB=${backendUrl}`);
  console.log('');

  if (dryRun) return;

  const landingEnv = {
    ...process.env,
    VITE_DASHBOARD_URL: dashboardUrl,
    VITE_API_URL: backendUrl,
    VITE_API_URL_ELECTRON: backendUrl,
  };

  const dashboardEnv = {
    ...process.env,
    VITE_LANDING_URL: landingUrl,
    VITE_API_URL_WEB: backendUrl,
    VITE_API_URL: backendUrl,
    BASE_URL: '/dashboard/',
  };

  const landing = start(
    'landing',
    'npm',
    ['-w', 'apps/landing', 'run', 'dev', '--', '--port', String(landingPort)],
    landingEnv,
  );

  const dashboard = start(
    'dashboard',
    'npm',
    ['-w', 'apps/dashboard', 'run', 'dev', '--', '--port', String(dashboardPort)],
    dashboardEnv,
  );

  const terminate = (signal) => {
    console.log(`\nReceived ${signal}. Stopping child processes...`);
    landing.kill('SIGTERM');
    dashboard.kill('SIGTERM');
    setTimeout(() => {
      landing.kill('SIGKILL');
      dashboard.kill('SIGKILL');
      process.exit(0);
    }, 1500).unref();
  };

  process.on('SIGINT', () => terminate('SIGINT'));
  process.on('SIGTERM', () => terminate('SIGTERM'));
}

main().catch((err) => {
  console.error('[dev-runtime] failed:', err.message);
  process.exit(1);
});
