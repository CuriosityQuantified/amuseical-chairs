#!/usr/bin/env node

/**
 * Low-impact web security assessment for Amuse-ical Chairs.
 *
 * This intentionally avoids brute force, payload spraying, account access,
 * destructive actions, and load testing. It checks the public HTTP surface,
 * TLS, static exposure, browser-facing headers, and authorization boundaries
 * using one short-lived test room.
 */

import fs from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import tls from 'node:tls';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { io as connect } from 'socket.io-client';

const DEFAULT_TARGET = 'https://amuseical.com';
const USER_AGENT = 'amuseical-security-assessment/1.0 (+authorized low-impact verification)';
const REQUEST_TIMEOUT_MS = 12_000;
const SOCKET_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 256 * 1024;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const execFileAsync = promisify(execFile);

const args = process.argv.slice(2);
function argValue(name, fallback = undefined) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: node scripts/security-assessment.mjs [options]

Options:
  --target URL       Target origin (default: ${DEFAULT_TARGET})
  --report PATH      Write a Markdown report to PATH
  --json PATH        Write machine-readable results to PATH
  --no-socket        Skip the short-lived Socket.IO authorization checks
  --no-browser       Skip the headless browser smoke checks

Environment equivalents: SECURITY_TARGET, SECURITY_REPORT, SECURITY_JSON.
CI safety: SECURITY_ALLOWED_HOSTS=amuseical.com, SECURITY_ALLOWED_ORIGINS=https://amuseical.com, and SECURITY_REQUIRE_HTTPS=true.
`);
  process.exit(0);
}

const target = new URL(argValue('--target', process.env.SECURITY_TARGET || DEFAULT_TARGET));
if (!['http:', 'https:'].includes(target.protocol)) {
  throw new Error(`Target must use http:// or https://, got ${target.protocol}`);
}
if (target.username || target.password) {
  throw new Error('Target must not include URL credentials.');
}
const allowedHosts = new Set((process.env.SECURITY_ALLOWED_HOSTS || '')
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean));
if (allowedHosts.size && !allowedHosts.has(target.hostname.toLowerCase())) {
  throw new Error(`Target hostname ${target.hostname} is not in SECURITY_ALLOWED_HOSTS.`);
}
const allowedOrigins = new Set((process.env.SECURITY_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean));
if (allowedOrigins.size && !allowedOrigins.has(target.origin)) {
  throw new Error(`Target origin ${target.origin} is not in SECURITY_ALLOWED_ORIGINS.`);
}
if (process.env.SECURITY_REQUIRE_HTTPS === 'true' && target.protocol !== 'https:') {
  throw new Error('This assessment requires an HTTPS target.');
}
if (target.port && target.port !== '443') {
  throw new Error('Only the default HTTPS port is permitted for an allowlisted assessment target.');
}
target.pathname = '/';
target.search = '';
target.hash = '';

const reportPath = argValue('--report', process.env.SECURITY_REPORT);
const jsonPath = argValue('--json', process.env.SECURITY_JSON);
const skipSocket = args.includes('--no-socket');
const skipBrowser = args.includes('--no-browser');

const startedAt = new Date().toISOString();
const checks = [];
const findings = [];
const notes = [];

function check(id, status, title, evidence = '') {
  checks.push({ id, status, title, evidence });
}

function finding({ id, severity, status = 'open', title, category, description, evidence = [], recommendation }) {
  if (findings.some((item) => item.id === id)) return;
  findings.push({ id, severity, status, title, category, description, evidence, recommendation });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readLimitedBody(response) {
  if (!response.body) return { text: '', truncated: false };
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  let truncated = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = MAX_BODY_BYTES - total;
      if (remaining <= 0) {
        truncated = true;
        await reader.cancel();
        break;
      }
      const piece = value.byteLength > remaining ? value.slice(0, remaining) : value;
      chunks.push(Buffer.from(piece));
      total += piece.byteLength;
      if (piece.byteLength < value.byteLength) {
        truncated = true;
        await reader.cancel();
        break;
      }
    }
  } catch {
    truncated = true;
  }
  return { text: Buffer.concat(chunks).toString('utf8'), truncated };
}

async function request(urlOrPath, options = {}) {
  const url = urlOrPath instanceof URL ? urlOrPath : new URL(urlOrPath, target);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: '*/*',
        ...(options.headers || {}),
      },
    });
    const body = await readLimitedBody(response);
    return {
      ok: true,
      url: url.toString(),
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      text: body.text,
      truncated: body.truncated,
    };
  } catch (error) {
    return { ok: false, url: url.toString(), error: `${error.name || 'Error'}: request failed` };
  } finally {
    clearTimeout(timer);
  }
}

function header(response, name) {
  return response?.headers?.[name.toLowerCase()] || '';
}

function safeBodyPreview(text) {
  const body = String(text || '');
  return `body_bytes=${Buffer.byteLength(body, 'utf8')}; sha256_16=${createHash('sha256').update(body).digest('hex').slice(0, 16)}`;
}

function safeFailure(error) {
  const value = String(error || 'request failed');
  return value.split(':', 1)[0] || 'request failed';
}

function safeLocation(location, base) {
  if (!location) return '(missing)';
  try {
    const resolved = new URL(location, base);
    return `${resolved.origin} (path/query redacted)`;
  } catch {
    return '(invalid Location header)';
  }
}

function safeAckSummary(value) {
  return JSON.stringify({
    ok: value?.ok === true,
    error: Boolean(value?.error),
  });
}

function safeTlsSummary(info) {
  if (!info?.ok) return 'TLS probe failed';
  return JSON.stringify({
    authorized: info.authorized,
    authorizationError: info.authorizationError ? '[certificate error]' : null,
    protocol: info.protocol,
    validTo: info.validTo,
  });
}

function summarizeJoin(value) {
  if (!value || typeof value !== 'object') return { type: typeof value };
  const snapshot = value.snapshot;
  return {
    ok: value.ok,
    error: Boolean(value.error),
    nameLength: typeof value.name === 'string' ? value.name.length : undefined,
    playerId: value.playerId ? '[redacted]' : undefined,
    snapshot: snapshot ? {
      phase: snapshot.phase,
      solo: snapshot.solo,
      playerCount: Array.isArray(snapshot.players) ? snapshot.players.length : undefined,
      configKeys: snapshot.config ? Object.keys(snapshot.config).sort() : undefined,
    } : undefined,
  };
}

async function probeTrace(url) {
  const transport = url.protocol === 'https:' ? https : http;
  return new Promise((resolve) => {
    const request = transport.request(url, {
      method: 'TRACE',
      headers: { 'user-agent': USER_AGENT, accept: '*/*' },
      rejectUnauthorized: true,
    }, (response) => {
      const chunks = [];
      let total = 0;
      response.on('data', (chunk) => {
        if (total >= MAX_BODY_BYTES) return;
        const piece = Buffer.from(chunk).subarray(0, MAX_BODY_BYTES - total);
        chunks.push(piece);
        total += piece.length;
      });
      response.on('end', () => resolve({
        ok: true,
        status: response.statusCode || 0,
        statusText: response.statusMessage || '',
        headers: Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : String(value ?? '')])),
        text: Buffer.concat(chunks).toString('utf8'),
      }));
      response.on('error', (error) => resolve({ ok: false, error: `${error.name || 'Error'}: response failed` }));
    });
    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error('TRACE probe timed out'));
    });
    request.on('error', (error) => resolve({ ok: false, error: `${error.name || 'Error'}: request failed` }));
    request.end();
  });
}

async function probeTls() {
  if (target.protocol !== 'https:') return null;
  return new Promise((resolve) => {
    const socket = tls.connect({
      host: target.hostname,
      port: Number(target.port) || 443,
      servername: target.hostname,
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
    });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, error: 'TLS probe timed out' });
    }, REQUEST_TIMEOUT_MS);
    socket.once('secureConnect', () => {
      clearTimeout(timer);
      const cert = socket.getPeerCertificate();
      const result = {
        ok: true,
        authorized: socket.authorized,
        authorizationError: socket.authorizationError || null,
        protocol: socket.getProtocol(),
        cipher: socket.getCipher()?.name || null,
        subject: cert.subject || null,
        issuer: cert.issuer || null,
        validFrom: cert.valid_from || null,
        validTo: cert.valid_to || null,
        subjectAltName: cert.subjectaltname || null,
      };
      socket.end();
      resolve(result);
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: `${error.code || error.name || 'Error'}: TLS probe failed` });
    });
  });
}

function openSocket() {
  return new Promise((resolve, reject) => {
    const socket = connect(target.origin, {
      path: '/socket.io',
      transports: ['polling'],
      forceNew: true,
      reconnection: false,
      timeout: SOCKET_TIMEOUT_MS,
      extraHeaders: { 'user-agent': USER_AGENT },
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket.IO connection timed out'));
    }, SOCKET_TIMEOUT_MS + 1_000);
    const fail = (error) => {
      clearTimeout(timer);
      socket.disconnect();
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('connect_error', fail);
  });
}

function probeSocketOrigin() {
  return new Promise((resolve) => {
    const socket = connect(target.origin, {
      path: '/socket.io',
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      timeout: SOCKET_TIMEOUT_MS,
      // Node lets this probe send the same Origin value a browser would send
      // for a page hosted at an untrusted origin. No application event is sent.
      extraHeaders: {
        origin: 'https://evil.example',
        'user-agent': USER_AGENT,
      },
    });
    const finish = (result) => {
      socket.disconnect();
      resolve(result);
    };
    const timer = setTimeout(() => finish({ connected: false, error: 'WebSocket origin probe timed out' }), SOCKET_TIMEOUT_MS + 1_000);
    socket.once('connect', () => {
      clearTimeout(timer);
      finish({ connected: true });
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      finish({ connected: false, error: 'WebSocket origin rejected' });
    });
  });
}

function emitAck(socket, event, payload, timeout = 2_000) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ timedOut: true, value: null });
      }
    }, timeout);
    socket.emit(event, payload, (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ timedOut: false, value });
    });
  });
}

async function staticSourceScan() {
  const files = [
    'public/js/player.js',
    'public/js/host.js',
    'public/js/games.js',
    'public/js/chairs.js',
    'public/js/tutorials.js',
  ];
  const unsafe = [
    { name: 'innerHTML', re: /\.innerHTML\s*=/g },
    { name: 'outerHTML', re: /\.outerHTML\s*=/g },
    { name: 'insertAdjacentHTML', re: /insertAdjacentHTML\s*\(/g },
    { name: 'document.write', re: /document\.write\s*\(/g },
    { name: 'eval', re: /\beval\s*\(/g },
    { name: 'new Function', re: /\bnew\s+Function\s*\(/g },
  ];
  const matches = [];
  for (const relative of files) {
    let source;
    try {
      source = await fs.readFile(path.resolve(repoRoot, relative), 'utf8');
    } catch (error) {
      check(`SRC-${relative}`, 'error', `Read ${relative}`, safeFailure(error));
      continue;
    }
    for (const pattern of unsafe) {
      const found = source.match(pattern.re);
      if (found) matches.push(`${relative}: ${pattern.name} (${found.length})`);
    }
  }
  if (matches.length) {
    finding({
      id: 'SRC-UNSAFE-DOM-SINK',
      severity: 'informational',
      category: 'client-side injection',
      title: 'Heuristic source scan matched an HTML or code sink',
      description: 'A heuristic source scan matched a direct HTML/code execution sink in browser application code. This is not a confirmed vulnerability: data flow, reachability, and sanitization require manual review.',
      evidence: matches,
      recommendation: 'Replace dynamic HTML construction with textContent/DOM node construction and remove dynamic eval/function construction.',
    });
    check('SRC-UNSAFE-DOM-SINK', 'warn', 'Application source has no heuristic HTML/code sink matches', matches.join('; '));
    notes.push('The client sink scan is heuristic and does not perform taint/data-flow analysis; any match requires manual review.');
  } else {
    check('SRC-UNSAFE-DOM-SINK', 'pass', 'Application source avoids direct HTML/code sinks', 'No matches in the checked browser application modules.');
  }
}

async function runDependencyAudit() {
  let stdout = '';
  let stderr = '';
  try {
    ({ stdout, stderr } = await execFileAsync('npm', ['audit', '--omit=dev', '--json'], {
      cwd: repoRoot,
      timeout: 90_000,
      maxBuffer: 2 * 1024 * 1024,
    }));
  } catch (error) {
    stdout = error.stdout || '';
    stderr = error.stderr || '';
    if (!stdout) {
      check('DEP-AUDIT', 'error', 'Production dependency audit completes', `${error.code || error.name}: ${String(stderr || error.message).trim()}`);
      notes.push('Dependency audit could not complete; rerun npm audit --omit=dev --audit-level=high with network access.');
      return;
    }
  }
  try {
    const audit = JSON.parse(stdout);
    const vulnerabilities = audit.metadata?.vulnerabilities || {};
    const high = Number(vulnerabilities.high || 0);
    const critical = Number(vulnerabilities.critical || 0);
    const total = Number(vulnerabilities.total || 0);
    const clean = high === 0 && critical === 0;
    check('DEP-AUDIT', clean ? 'pass' : 'fail', 'Production dependency audit has no high/critical advisories', JSON.stringify({ total, high, critical }));
    if (!clean) {
      finding({
        id: 'DEP-HIGH-CRITICAL',
        severity: critical > 0 ? 'critical' : 'high',
        category: 'dependency security',
        title: 'Production dependency audit reports high or critical advisories',
        description: 'npm audit reported high or critical vulnerabilities in the production dependency tree.',
        evidence: [JSON.stringify({ total, high, critical })],
        recommendation: 'Review npm audit advisories, update or replace affected production dependencies, and rerun the audit.',
      });
    }
  } catch (error) {
    check('DEP-AUDIT', 'error', 'Production dependency audit completes', `Could not parse npm audit JSON: ${error.message}`);
    notes.push(`npm audit returned output that could not be parsed: ${String(stderr).trim()}`);
  }
}

async function sourceBoundaryReview() {
  const [socketSource, roomSource, appSource] = await Promise.all([
    fs.readFile(path.resolve(repoRoot, 'server/sockets.js'), 'utf8'),
    fs.readFile(path.resolve(repoRoot, 'server/room.js'), 'utf8'),
    fs.readFile(path.resolve(repoRoot, 'server/app.js'), 'utf8'),
  ]);

  const joinHandlerPresent = /socket\.on\(['"]player:join['"]/.test(socketSource);
  const codeMatch = roomSource.match(/CODE_ALPHABET\s*=\s*['"]([^'"]+)['"]/);
  const codeLengthMatch = roomSource.match(/for\s*\(let\s+i\s*=\s*0;\s*i\s*<\s*(\d+)\s*;\s*i\+\+\)/);
  const codeAlphabet = codeMatch?.[1] || '';
  const codeLength = Number(codeLengthMatch?.[1] || 0);
  const codeSpace = codeAlphabet && codeLength ? codeAlphabet.length ** codeLength : null;
  const hasRateControl = /rate.?limit|throttl|quota|failedAttempts|attemptsBy/i.test(`${socketSource}\n${appSource}`);

  if (joinHandlerPresent && codeSpace && codeLength <= 4 && !hasRateControl) {
    check('SRC-ROOM-CODE-ONLINE-ENUMERATION', 'warn', 'Room-code join attempts have server-side throttling', `Source review: ${codeLength}-character code over ${codeAlphabet.length} symbols (${codeSpace} combinations); no explicit rate-limit or failed-attempt control found in server/sockets.js or server/app.js.`);
    finding({
      id: 'SRC-ROOM-CODE-ONLINE-ENUMERATION',
      severity: 'medium',
      status: 'source-confirmed; dynamic rate test not performed',
      category: 'session management / abuse resistance',
      title: 'Short room codes have no evident online-guessing throttle',
      description: `The player:join endpoint uses a ${codeLength}-character room code drawn from ${codeAlphabet.length} symbols (${codeSpace} possible combinations), returns a distinguishable room-not-found response, and has no explicit server-side rate-limit or failed-attempt control in the reviewed HTTP/Socket.IO wiring. This creates an online room-existence oracle; practical enumeration speed and edge protections were not stress-tested.`,
      evidence: [
        `Source: server/room.js defines CODE_ALPHABET (${codeAlphabet.length} symbols) and a ${codeLength}-character generator.`,
        'Source: server/sockets.js handles player:join with a direct room lookup and distinguishable error.',
        'Source review found no explicit rate-limit, throttle, quota, or failed-attempt control in server/sockets.js or server/app.js.',
      ],
      recommendation: 'Add edge and application rate limits for failed joins, consider longer/high-entropy invite tokens, and avoid exposing a highly distinguishable room-existence oracle. Validate with an approved bounded rate-limit test.',
    });
  } else {
    check('SRC-ROOM-CODE-ONLINE-ENUMERATION', 'pass', 'Room-code join attempts have server-side throttling or a larger code space', 'No short-code/no-throttle condition matched in the source review.');
  }

  const rawEventForwarding = /r\.handleSubmit\(socket\.data\.playerId,\s*payload\)/.test(socketSource)
    && /r\.handleRedemptionReport\(socket\.data\.playerId,\s*report\)/.test(socketSource);
  const syncBroadcasts = /recordSync\(socket\.data\.playerId,\s*sync\)/.test(socketSource)
    && /broadcastPlayers\(\)/.test(roomSource);
  if (rawEventForwarding && syncBroadcasts && !hasRateControl) {
    check('SRC-SOCKET-EVENT-RATE-LIMITS', 'warn', 'Socket.IO player events have explicit rate and schema limits', 'Source review found direct forwarding of submit/report payloads and sync-triggered roster broadcasts without an explicit rate-control layer.');
    finding({
      id: 'SRC-SOCKET-EVENT-RATE-LIMITS',
      severity: 'medium',
      status: 'source-confirmed; dynamic flood test not performed',
      category: 'availability / input validation',
      title: 'Socket.IO player events lack an evident application rate-control layer',
      description: 'The reviewed Socket.IO handlers forward player:submit and redemption:report payloads into room logic and allow sync:report to trigger roster broadcasts. No explicit per-socket rate limit, event quota, or shared schema/serialized-size guard was found in the reviewed wiring. A connected client may therefore cause disproportionate CPU, memory, or broadcast work; sustained impact was not tested.',
      evidence: [
        'Source: server/sockets.js forwards player:submit and redemption:report payloads directly to room methods.',
        'Source: server/sockets.js forwards sync:report; server/room.js recordSync broadcasts player summaries.',
        'Source review found no explicit rate-limit, throttle, or quota control in server/sockets.js or server/app.js.',
      ],
      recommendation: 'Add per-socket and per-room event budgets, validate each payload against strict schemas and serialized-size limits, and add bounded local flood tests before exposing the service to untrusted clients.',
    });
  } else {
    check('SRC-SOCKET-EVENT-RATE-LIMITS', 'pass', 'Socket.IO player events have explicit rate and schema limits', 'No direct-forwarding/no-rate-control condition matched in the source review.');
  }
}

async function runBrowserSmoke() {
  if (skipBrowser) {
    check('BROWSER-SMOKE', 'not_run', 'Headless browser smoke checks', '--no-browser was supplied');
    return;
  }
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ userAgent: USER_AGENT });
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const playerResponse = await page.goto(target.origin, { waitUntil: 'networkidle', timeout: REQUEST_TIMEOUT_MS });
    const playerControls = await page.locator('#join-btn, #solo-btn').count();
    check('BROWSER-PLAYER', playerResponse?.status() === 200 && playerControls === 2 ? 'pass' : 'fail', 'Player page renders its public join controls in a real browser', JSON.stringify({ status: playerResponse?.status() || null, controls: playerControls }));

    const hostResponse = await page.goto(new URL('/host.html', target).toString(), { waitUntil: 'networkidle', timeout: REQUEST_TIMEOUT_MS });
    const hostControls = await page.locator('#create-btn').count();
    check('BROWSER-HOST', hostResponse?.status() === 200 && hostControls === 1 ? 'pass' : 'fail', 'Host page renders its public create control in a real browser', JSON.stringify({ status: hostResponse?.status() || null, controls: hostControls }));
    const clean = consoleErrors.length === 0 && pageErrors.length === 0;
    check('BROWSER-CONSOLE', clean ? 'pass' : 'warn', 'Public player/host page smoke flow has no browser errors', JSON.stringify({ consoleErrors: consoleErrors.length, pageErrors: pageErrors.length }));
    if (!clean) notes.push(`Browser smoke observed ${consoleErrors.length} console error(s) and ${pageErrors.length} page error(s); raw browser messages were not retained in the report.`);
  } catch (error) {
    check('BROWSER-SMOKE', 'error', 'Headless browser smoke checks', safeFailure(error));
    notes.push('Browser smoke checks could not complete; install the Playwright Chromium browser or rerun with --no-browser to make the omission explicit.');
  } finally {
    await browser?.close();
  }
}

async function runHttpChecks() {
  const root = await request('/');
  if (!root.ok) {
    check('HTTP-ROOT', 'error', 'Fetch the public home page', root.error);
    notes.push(`HTTP checks could not continue from ${target.origin}: ${root.error}`);
    return { root };
  }
  check('HTTP-ROOT', root.status === 200 ? 'pass' : 'fail', 'Public home page responds', `${root.status} ${root.statusText}`);
  if (root.status !== 200) {
    finding({
      id: 'HTTP-ROOT-UNAVAILABLE',
      severity: 'high',
      category: 'availability',
      title: 'Public home page did not return HTTP 200',
      description: 'The assessment could not establish the expected public application entry point.',
      evidence: [`${root.status} ${root.statusText}`],
      recommendation: 'Investigate deployment and edge/origin health before relying on a whitelist decision.',
    });
  }

  const contentType = header(root, 'content-type');
  check('HTTP-CONTENT-TYPE', contentType.toLowerCase().includes('text/html') ? 'pass' : 'fail', 'Home page declares an HTML content type', contentType || '(missing)');

  const routes = [
    ['/host.html', 'Host page'],
    ['/healthz', 'Health endpoint'],
    ['/socket.io/?EIO=4&transport=polling', 'Socket.IO handshake'],
  ];
  for (const [route, title] of routes) {
    const response = await request(route);
    check(`HTTP-${route.split(/[/?]/)[1]?.toUpperCase() || 'ROUTE'}`, response.ok && response.status >= 200 && response.status < 400 ? 'pass' : 'fail', `${title} responds`, response.ok ? `${response.status} ${safeBodyPreview(response.text)}` : response.error);
  }

  const expectedHeaders = [
    ['strict-transport-security', 'low', 'Strict-Transport-Security (HSTS)', 'Enable HSTS after confirming every production subdomain is HTTPS-only.'],
    ['content-security-policy', 'low', 'Content-Security-Policy (CSP)', 'Deploy a tested CSP appropriate for the external font and Socket.IO resources.'],
    ['x-content-type-options', 'low', 'X-Content-Type-Options', 'Send X-Content-Type-Options: nosniff.'],
    ['x-frame-options', 'low', 'Clickjacking protection (X-Frame-Options or frame-ancestors)', 'Send X-Frame-Options or a CSP frame-ancestors directive appropriate for the host/player pages.'],
    ['referrer-policy', 'low', 'Referrer-Policy', 'Send a restrictive policy such as strict-origin-when-cross-origin.'],
    ['permissions-policy', 'informational', 'Permissions-Policy', 'Restrict browser capabilities not needed by the application.'],
  ];
  const csp = header(root, 'content-security-policy');
  const frameProtected = Boolean(header(root, 'x-frame-options') || /(^|;)\s*frame-ancestors\s+/i.test(csp));
  for (const [name, severity, title, recommendation] of expectedHeaders) {
    const present = name === 'x-frame-options' ? frameProtected : Boolean(header(root, name));
    const value = name === 'x-frame-options' ? (header(root, name) || (frameProtected ? 'CSP frame-ancestors present' : '')) : header(root, name);
    check(`HDR-${name.toUpperCase().replaceAll('-', '_')}`, present ? 'pass' : 'warn', title, value || '(missing)');
    if (!present) {
      finding({
        id: `HDR-${name.toUpperCase().replaceAll('-', '_')}-MISSING`,
        severity,
        category: 'security headers',
        title: `Missing ${title}`,
        description: `The response from ${target.origin}/ did not include ${title}. This is a defense-in-depth configuration gap, not proof of an exploitable vulnerability by itself.`,
        evidence: [`GET / → ${root.status}`, `${title}: missing`],
        recommendation,
      });
    }
  }

  const disclosureHeaders = ['server', 'x-powered-by', 'x-railway-edge'];
  const disclosures = disclosureHeaders.filter((name) => header(root, name)).map((name) => `${name}: ${header(root, name)}`);
  check('HDR-DISCLOSURE', disclosures.length ? 'warn' : 'pass', 'Response does not unnecessarily disclose platform details', disclosures.join('; ') || 'No checked disclosure headers present.');
  if (disclosures.length) {
    finding({
      id: 'HDR-PLATFORM-DISCLOSURE',
      severity: 'informational',
      category: 'information disclosure',
      title: 'Platform/framework response headers are exposed',
      description: 'The edge response identifies deployment or framework details. This is normally low risk but gives reconnaissance information to an attacker.',
      evidence: disclosures,
      recommendation: 'Remove or minimize nonessential framework/platform headers at the edge where operationally safe.',
    });
  }

  if (target.protocol === 'https:') {
    const insecure = new URL(target);
    insecure.protocol = 'http:';
    const response = await request(insecure);
    const location = response.ok ? response.headers.location || '' : '';
    let redirectUrl;
    try { redirectUrl = location ? new URL(location, insecure) : null; } catch { redirectUrl = null; }
    const redirectsToCanonicalHttps = redirectUrl?.protocol === 'https:' && redirectUrl.origin === target.origin;
    const redirectEvidence = response.ok ? `${response.status} Location: ${safeLocation(location, insecure)}` : response.error;
    check('TLS-HTTP-REDIRECT', redirectsToCanonicalHttps ? 'pass' : response.ok ? 'warn' : 'error', 'HTTP redirects to the canonical HTTPS origin', redirectEvidence);
    if (response.ok && !redirectsToCanonicalHttps) {
      finding({
        id: 'TLS-NO-HTTPS-REDIRECT',
        severity: 'medium',
        category: 'transport security',
        title: 'HTTP did not redirect to the canonical HTTPS origin',
        description: 'The plaintext HTTP origin did not return a redirect to the requested canonical HTTPS origin.',
        evidence: [`GET ${insecure.origin}/ → ${response.status}`, `Location: ${safeLocation(location, insecure)}`],
        recommendation: 'Redirect all HTTP traffic to the canonical HTTPS origin and keep HSTS enabled after validation.',
      });
    }
  }

  const cors = await request('/healthz', { headers: { origin: 'https://evil.example' } });
  const allowOrigin = header(cors, 'access-control-allow-origin');
  const corsOpen = allowOrigin === '*' || allowOrigin === 'https://evil.example';
  check('CORS-UNTRUSTED-ORIGIN', corsOpen ? 'fail' : 'pass', 'Untrusted origin is not granted permissive CORS access', `Access-Control-Allow-Origin: ${allowOrigin || '(missing)'}`);
  if (corsOpen) {
    finding({
      id: 'CORS-REFLECTIVE-ORIGIN',
      severity: 'high',
      category: 'cross-origin access control',
      title: 'Health/API response grants access to an untrusted origin',
      description: 'The response grants CORS access to a deliberately untrusted origin. If credentials or sensitive responses are exposed under the same policy, this can enable cross-origin data theft.',
      evidence: [`Origin: https://evil.example`, `Access-Control-Allow-Origin: ${allowOrigin}`],
      recommendation: 'Allow only the exact production origins required by the application; never combine wildcard origins with credentials.',
    });
  }

  const socketCors = await request('/socket.io/?EIO=4&transport=polling', {
    headers: { origin: 'https://evil.example' },
  });
  const socketAllowOrigin = header(socketCors, 'access-control-allow-origin');
  const socketCorsOpen = socketAllowOrigin === '*' || socketAllowOrigin === 'https://evil.example';
  check('CORS-SOCKETIO-UNTRUSTED-ORIGIN', socketCorsOpen ? 'fail' : socketCors.ok ? 'pass' : 'error', 'Socket.IO handshake does not grant permissive access to an untrusted origin', socketCors.ok ? `Access-Control-Allow-Origin: ${socketAllowOrigin || '(missing)'}` : socketCors.error);
  if (socketCorsOpen) {
    finding({
      id: 'CORS-SOCKETIO-REFLECTIVE-ORIGIN',
      severity: 'high',
      category: 'cross-origin access control',
      title: 'Socket.IO handshake grants access to an untrusted origin',
      description: 'The Socket.IO polling handshake grants CORS access to a deliberately untrusted origin. Cross-origin clients could then attempt to establish application sessions unless an explicit origin policy or equivalent edge control blocks them.',
      evidence: [`Origin: https://evil.example`, `Access-Control-Allow-Origin: ${socketAllowOrigin}`],
      recommendation: 'Configure Socket.IO CORS with an exact allowlist of required production origins and verify the WebSocket upgrade path at the edge.',
    });
  }

  const websocketOrigin = await probeSocketOrigin();
  check('CORS-SOCKETIO-WEBSOCKET-ORIGIN', websocketOrigin.connected ? 'warn' : 'pass', 'Socket.IO WebSocket rejects an untrusted Origin', websocketOrigin.connected ? 'Connected with Origin: https://evil.example' : (websocketOrigin.error || 'Connection rejected'));
  if (websocketOrigin.connected) {
    finding({
      id: 'CORS-SOCKETIO-WEBSOCKET-ORIGIN',
      severity: 'low',
      category: 'cross-origin access control',
      title: 'Socket.IO WebSocket accepts an untrusted Origin',
      description: 'A WebSocket-only Socket.IO connection succeeded while sending Origin: https://evil.example. WebSocket handshakes are not governed by browser CORS headers, so an explicit Socket.IO origin allowRequest policy is needed if cross-origin connections should be blocked.',
      evidence: ['WebSocket connection succeeded with Origin: https://evil.example', 'No application event or room data was sent during this probe.'],
      recommendation: 'Configure Socket.IO allowRequest (or an equivalent edge policy) to allow only the exact application origins required, then verify both polling and WebSocket transports.',
    });
  }

  const trace = await probeTrace(new URL('/', target));
  const traceEchoes = trace.ok && trace.status >= 200 && trace.status < 300 && /TRACE\s+\//i.test(trace.text);
  check('HTTP-TRACE', traceEchoes ? 'fail' : trace.ok ? 'pass' : 'error', 'TRACE is not enabled as an HTTP echo', trace.ok ? `${trace.status} ${safeBodyPreview(trace.text)}` : trace.error);
  if (traceEchoes) {
    finding({
      id: 'HTTP-TRACE-ENABLED',
      severity: 'medium',
      category: 'HTTP configuration',
      title: 'TRACE method appears enabled',
      description: 'The server returned an HTTP TRACE response that echoed request data.',
      evidence: [`TRACE / → ${trace.status}`, safeBodyPreview(trace.text)],
      recommendation: 'Disable TRACE at the edge/origin unless there is a documented operational requirement.',
    });
  }

  const sensitivePaths = [
    '/.env',
    '/.git/config',
    '/package.json',
    '/package-lock.json',
    '/server/index.js',
    '/server/app.js',
    '/%2e%2e/server/app.js',
    '/shared/%2e%2e/server/app.js',
    '/%2e%2e/%2e%2e/etc/passwd',
    '/.npmrc',
  ];
  for (const route of sensitivePaths) {
    const response = await request(route);
    const exposed = response.ok && response.status >= 200 && response.status < 300;
    const id = `EXPOSURE-${route.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase()}`;
    check(id, exposed ? 'fail' : response.ok ? 'pass' : 'error', `Sensitive path is not publicly exposed: ${route}`, response.ok ? `${response.status} ${safeBodyPreview(response.text)}` : response.error);
    if (exposed) {
      finding({
        id,
        severity: route.includes('.env') || route.includes('.git') || route.includes('passwd') ? 'critical' : 'high',
        category: 'information disclosure / path traversal',
        title: `Publicly exposed sensitive path: ${route}`,
        description: 'A path that should remain outside the public web root returned a successful response.',
        evidence: [`GET ${route} → ${response.status}`, safeBodyPreview(response.text)],
        recommendation: 'Restrict the static web root to intended public assets, reject encoded traversal, and remove sensitive files from the deployed artifact.',
      });
    }
    await wait(40);
  }

  return { root };
}

async function runSocketChecks() {
  if (skipSocket) {
    check('SOCKET-AUTH', 'not_run', 'Socket.IO authorization boundary checks', '--no-socket was supplied');
    return;
  }
  const sockets = [];
  try {
    const host = await openSocket();
    sockets.push(host);
    const created = await emitAck(host, 'host:create', { origin: target.origin, config: {} }, 10_000);
    const room = created.value;
    if (created.timedOut || !room?.ok) {
      check('SOCKET-CREATE', 'error', 'Create one short-lived assessment room', created.timedOut ? 'host:create timed out' : safeAckSummary(room));
      return;
    }
    check('SOCKET-CREATE', 'pass', 'Create one temporary assessment room', 'Room created; identifier redacted.');
    const codeShape = /^[A-HJ-NP-Z]{4}$/.test(room.code || '');
    check('SOCKET-CODE', codeShape ? 'pass' : 'fail', 'Room code uses the documented four-letter format', codeShape ? 'Four-letter format matched; identifier redacted.' : '(missing or invalid)');
    if (!codeShape) {
      finding({
        id: 'SOCKET-ROOM-CODE-FORMAT',
        severity: 'low',
        category: 'session management',
        title: 'Room code format differs from the documented format',
        description: 'The room creation response did not contain the expected four-letter ambiguity-free code.',
        evidence: ['Room code was missing or did not match the documented format; value redacted.'],
        recommendation: 'Confirm the room-code generator and client validation agree.',
      });
    }
    const hostKeyShape = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(room.hostKey || '');
    check('SOCKET-HOST-KEY', hostKeyShape ? 'pass' : 'fail', 'Host rejoin credential is present as a UUID-shaped value', room.hostKey ? 'UUID-shaped' : '(missing)');

    const playerOne = await openSocket();
    const playerTwo = await openSocket();
    sockets.push(playerOne, playerTwo);
    const phaseEvents = [];
    const configEvents = [];
    playerOne.on('phase', (value) => phaseEvents.push(value));
    host.on('room:config', (value) => configEvents.push(value));

    const joinOne = await emitAck(playerOne, 'player:join', {
      code: room.code,
      name: '<security-probe>',
    });
    const joinTwo = await emitAck(playerTwo, 'player:join', {
      code: room.code,
      name: 'A'.repeat(500),
    });
    const joinsValid = joinOne.value?.ok && joinTwo.value?.ok;
    check('SOCKET-JOIN', joinsValid ? 'pass' : 'error', 'Two test players can join the assessment room', JSON.stringify({ one: summarizeJoin(joinOne.value), two: summarizeJoin(joinTwo.value) }));
    if (joinsValid) {
      const bounded = String(joinTwo.value.name || '').length <= 20;
      check('SOCKET-NAME-BOUND', bounded ? 'pass' : 'fail', 'Player display names are bounded server-side', `returned length=${String(joinTwo.value.name || '').length}`);
      if (!bounded) {
        finding({
          id: 'SOCKET-NAME-UNBOUNDED',
          severity: 'low',
          category: 'input validation',
          title: 'Player display name was not bounded server-side',
          description: 'A deliberately oversized display name was accepted without the documented length cap.',
          evidence: [`Returned length=${String(joinTwo.value.name || '').length}`],
          recommendation: 'Enforce a small server-side display-name limit before broadcasting the value.',
        });
      }

      const impersonator = await openSocket();
      sockets.push(impersonator);
      const impersonated = await emitAck(impersonator, 'player:join', {
        code: room.code,
        name: 'not-the-original-player',
        playerId: joinOne.value.playerId,
      });
      const identityRebound = impersonated.value?.ok === true
        && impersonated.value.playerId === joinOne.value.playerId
        && impersonated.value.name === joinOne.value.name;
      check('SOCKET-PLAYER-RECONNECT-AUTH', identityRebound ? 'fail' : impersonated.timedOut ? 'error' : 'pass', 'A different socket cannot rebind an existing player identity', identityRebound ? 'Existing player identity accepted from a different socket; identifiers redacted.' : JSON.stringify(summarizeJoin(impersonated.value)));
      if (identityRebound) {
        finding({
          id: 'SOCKET-PLAYER-IDENTITY-REBIND',
          severity: 'high',
          category: 'authentication / session management',
          title: 'Player identity can be rebound using a broadcast player ID',
          description: 'The player:join handler accepted an existing playerId from a different socket and rebound the existing player identity without proof of possession. The room roster/snapshot also exposes player IDs to room participants. A participant who learns another player ID can impersonate that player and submit game data on their behalf or disrupt their connection.',
          evidence: ['A second socket supplied the first test player’s playerId and received ok=true with the original player name.', 'Source: server/room.js:219-231 accepts playerId and rebinds the socket without a second credential.', 'Source: server/room.js:203-214 broadcasts player IDs in room:players summaries.', 'All identifiers were redacted from this report.'],
          recommendation: 'Use a separate unguessable reconnect credential that is never broadcast in room roster data; require that credential for reconnects and treat player IDs as non-secret identifiers only.',
        });
      }
    }

    const wrongHost = await openSocket();
    sockets.push(wrongHost);
    const wrongRejoin = await emitAck(wrongHost, 'host:rejoin', { code: room.code, hostKey: '00000000-0000-0000-0000-000000000000' });
    const rejected = wrongRejoin.value?.error && !wrongRejoin.value?.ok;
    check('SOCKET-HOST-REJOIN-AUTH', rejected ? 'pass' : 'fail', 'Incorrect host rejoin credential is rejected', safeAckSummary(wrongRejoin.value));
    if (!rejected) {
      finding({
        id: 'SOCKET-HOST-REJOIN-BYPASS',
        severity: 'critical',
        category: 'authorization / session management',
        title: 'Host rejoin accepted an incorrect credential',
        description: 'A socket that did not possess the room host credential was able to rejoin as host.',
        evidence: [safeAckSummary(wrongRejoin.value)],
        recommendation: 'Require an unguessable, server-generated host credential and compare it with a constant-time-safe check where appropriate.',
      });
    }

    const unauthorizedStart = await emitAck(playerOne, 'host:start', {}, 700);
    await wait(350);
    const unauthorizedConfig = await emitAck(playerOne, 'host:config', { gameDuration: 500 }, 700);
    await wait(350);
    const hostEventsObserved = phaseEvents.length > 0 || configEvents.length > 0;
    const denied = unauthorizedStart.timedOut && unauthorizedConfig.timedOut && !hostEventsObserved;
    check('SOCKET-HOST-ONLY', denied ? 'pass' : 'fail', 'Player sockets cannot invoke host-only actions', JSON.stringify({ unauthorizedStart: unauthorizedStart.timedOut, unauthorizedConfig: unauthorizedConfig.timedOut, phaseEvents: phaseEvents.length, configEvents: configEvents.length }));
    if (!denied) {
      finding({
        id: 'SOCKET-HOST-ACTION-BYPASS',
        severity: 'critical',
        category: 'authorization',
        title: 'A non-host socket invoked a host-only action',
        description: 'The test attempted to start the room and change host configuration from a player socket. The room emitted evidence that at least one action was accepted.',
        evidence: [JSON.stringify({ unauthorizedStart: unauthorizedStart.timedOut, unauthorizedConfig: unauthorizedConfig.timedOut, phaseEvents, configEvents })],
        recommendation: 'Enforce host authorization from server-side socket state for every host event and add regression tests for each host-only event.',
      });
    }
  } catch (error) {
    check('SOCKET-AUTH', 'error', 'Socket.IO authorization boundary checks', safeFailure(error));
    notes.push(`Socket checks were incomplete (${safeFailure(error)}).`);
  } finally {
    for (const socket of sockets) {
      try { socket.disconnect(); } catch { /* best effort cleanup */ }
    }
  }
}

function severityRank(value) {
  return ({ critical: 0, high: 1, medium: 2, low: 3, informational: 4 })[value] ?? 9;
}

function markdownReport(result) {
  const counts = Object.fromEntries(['critical', 'high', 'medium', 'low', 'informational'].map((level) => [level, findings.filter((item) => item.severity === level).length]));
  const material = findings.filter((item) => ['critical', 'high', 'medium'].includes(item.severity));
  const assessmentStatus = material.length ? 'Findings require remediation or risk acceptance before a security whitelist decision.' : 'No critical, high, or medium findings were observed by this limited assessment; this is not a claim that the site has no vulnerabilities.';
  const lines = [
    '# Amuse-ical Chairs penetration-test assessment',
    '',
    `- **Target:** ${result.target}`,
    `- **Assessment time (UTC):** ${result.startedAt}`,
    `- **Method:** Authorized, low-impact external web assessment plus source-backed authorization checks`,
    `- **Status:** ${assessmentStatus}`,
    '',
    '> This is an assessment of the reachable surface at a point in time, not a guarantee that the site has no vulnerabilities. It does not include credentialed testing, source-code exploitation, load testing, brute force, social engineering, or destructive actions.',
    '',
    '## Executive summary',
    '',
    `Observed findings: **${findings.length}** — Critical: **${counts.critical}**, High: **${counts.high}**, Medium: **${counts.medium}**, Low: **${counts.low}**, Informational: **${counts.informational}**.`,
    '',
    'Checks run:',
    '',
    '| Status | Count |',
    '|---|---:|',
    `| Pass | ${checks.filter((item) => item.status === 'pass').length} |`,
    `| Warnings | ${checks.filter((item) => item.status === 'warn').length} |`,
    `| Failures | ${checks.filter((item) => item.status === 'fail').length} |`,
    `| Errors / not run | ${checks.filter((item) => ['error', 'not_run'].includes(item.status)).length} |`,
    '',
    '## Findings',
    '',
  ];
  const sorted = [...findings].sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.id.localeCompare(b.id));
  if (!sorted.length) lines.push('No findings were recorded.');
  for (const item of sorted) {
    lines.push(`### ${item.id} — ${item.title}`);
    lines.push('');
    lines.push(`- **Severity:** ${item.severity}`);
    lines.push(`- **Status:** ${item.status} — this assessment did not apply remediation`);
    lines.push(`- **Category:** ${item.category}`);
    lines.push(`- **Description:** ${item.description}`);
    lines.push('- **Evidence:**');
    for (const evidence of item.evidence) lines.push(`  - \`${String(evidence).replaceAll('`', '\\`')}\``);
    lines.push(`- **Recommendation:** ${item.recommendation}`);
    lines.push('');
  }
  lines.push('## Check results', '', '| ID | Status | Check | Evidence |', '|---|---|---|---|');
  for (const item of checks) {
    lines.push(`| ${item.id} | ${item.status} | ${item.title.replaceAll('|', '\\|')} | ${String(item.evidence || '').replaceAll('|', '\\|').replaceAll('\n', ' ')} |`);
  }
  lines.push('', '## Scope and limitations', '');
  lines.push('- Tested the canonical HTTPS origin and a single short-lived assessment room created through the public application flow.');
  lines.push('- HTTP checks were limited to safe GET/HEAD-like inspection, one TRACE capability check, CORS header inspection, encoded traversal probes, and a Socket.IO handshake.');
  lines.push('- Host authorization checks used three test player sockets (including an identity-rebind probe) and an incorrect host credential; no existing user room, account, or stored data was accessed.');
  lines.push('- No password guessing, token theft, exploit chaining, payload spraying, load generation, file upload, payment flow, or destructive state changes were attempted.');
  lines.push('- The source-sink scan and authorization regression tests cover the checked-out repository; deployment-to-commit correlation was not independently verified.');
  lines.push('- Dynamic browser XSS behavior and authenticated/role-based flows require a separate approved test plan with test accounts and explicit scope.');
  lines.push('- Rate-limit, sustained event-flood, and denial-of-service resilience testing was not performed. Source review indicates follow-up testing is warranted for room-code enumeration and per-event quotas/schema limits.');
  if (notes.length) {
    lines.push('', '## Assessment notes', '');
    for (const note of notes) lines.push(`- ${note}`);
  }
  lines.push('', '## Methodology references', '');
  lines.push('- [OWASP Web Security Testing Guide — HTTP security header misconfigurations (WSTG-CONF-14)](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/14-Test_Other_HTTP_Security_Header_Misconfigurations)');
  lines.push('- [OWASP HTTP Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)');
  lines.push('- [OWASP API Security Top 10 — API4:2023 Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption)');
  lines.push('- [Socket.IO — Handling CORS](https://socket.io/docs/v4/handling-cors)');
  lines.push('', '## Reproduction', '', '```bash', 'npm ci', `node scripts/security-assessment.mjs --target ${result.target} --report docs/security/assessment-latest.md --json docs/security/assessment-latest.json`, '```');
  return `${lines.join('\n')}\n`;
}

async function main() {
  await staticSourceScan();
  await runDependencyAudit();
  await sourceBoundaryReview();
  await runBrowserSmoke();
  const tlsInfo = await probeTls();
  if (tlsInfo) {
    const tlsPass = tlsInfo.ok && tlsInfo.authorized;
    check('TLS-CERT', tlsPass ? 'pass' : 'fail', 'TLS certificate validates for the target hostname', safeTlsSummary(tlsInfo));
    if (!tlsPass) {
      finding({
        id: 'TLS-CERTIFICATE',
        severity: 'high',
        category: 'transport security',
        title: 'TLS certificate validation failed',
        description: 'The TLS connection did not validate for the requested target hostname.',
        evidence: [safeTlsSummary(tlsInfo)],
        recommendation: 'Install and renew a certificate whose chain and SAN cover the canonical hostname.',
      });
    }
    const modernTls = tlsInfo.ok && ['TLSv1.2', 'TLSv1.3'].includes(tlsInfo.protocol);
    check('TLS-PROTOCOL', !tlsInfo.ok ? 'error' : modernTls ? 'pass' : 'fail', 'Negotiated TLS protocol is TLS 1.2 or newer', tlsInfo.ok ? `Protocol: ${tlsInfo.protocol}` : 'TLS probe failed');
    if (tlsInfo.ok && !modernTls) {
      finding({
        id: 'TLS-LEGACY-NEGOTIATED',
        severity: 'medium',
        category: 'transport security',
        title: 'Legacy or unknown TLS protocol negotiated',
        description: `The endpoint negotiated ${tlsInfo.protocol || 'no protocol'}.`,
        evidence: [`Protocol: ${tlsInfo.protocol}`],
        recommendation: 'Require TLS 1.2 or newer at the edge.',
      });
    }
    notes.push('The TLS probe enforces a TLSv1.2 minimum; it verifies the negotiated protocol but does not independently test whether the endpoint accepts TLS 1.0 or 1.1.');
  } else {
    check('TLS-CERT', 'not_run', 'TLS certificate validates for the target hostname', 'Target is not HTTPS.');
    check('TLS-PROTOCOL', 'not_run', 'Negotiated TLS protocol is TLS 1.2 or newer', 'Target is not HTTPS.');
  }
  await runHttpChecks();
  await runSocketChecks();

  const result = {
    target: target.origin,
    startedAt,
    finishedAt: new Date().toISOString(),
    scope: 'low-impact external assessment and unauthenticated Socket.IO authorization checks',
    checks,
    findings: findings.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.id.localeCompare(b.id)),
    notes,
  };
  const report = markdownReport(result);
  if (reportPath) {
    await fs.mkdir(path.dirname(path.resolve(reportPath)), { recursive: true });
    await fs.writeFile(reportPath, report, 'utf8');
  }
  if (jsonPath) {
    await fs.mkdir(path.dirname(path.resolve(jsonPath)), { recursive: true });
    await fs.writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }
  console.log(report);
  // A medium-or-higher finding must fail a whitelist-oriented run. Low and
  // informational hardening notes remain reportable without blocking CI.
  if (findings.some((item) => ['critical', 'high', 'medium'].includes(item.severity))) process.exitCode = 2;
}

await main();
