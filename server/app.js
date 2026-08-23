import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { attachSockets } from './sockets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self' wss://amuseical.com https://cloudflareinsights.com",
  "form-action 'self'",
].join('; ');

function allowedSocketOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // Native/test Socket.IO clients do not send Origin.
  const configured = new Set((process.env.APP_ORIGINS || 'https://amuseical.com')
    .split(',').map((value) => value.trim()).filter(Boolean));
  if (configured.has(origin)) return true;
  try {
    const parsed = new URL(origin);
    const host = String(req.headers.host || '').toLowerCase();
    const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname);
    return loopback && parsed.host.toLowerCase() === host;
  } catch {
    return false;
  }
}

export function createServer({ allowClientScoredCompetitive = false } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set({
      'Content-Security-Policy': CONTENT_SECURITY_POLICY,
      'Strict-Transport-Security': 'max-age=31536000',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    next();
  });
  app.use(express.static(path.join(__dirname, '../public')));
  // Shared pure-logic modules are served to the browser as-is (ES modules).
  app.use('/shared', express.static(path.join(__dirname, '../shared')));
  app.get('/healthz', (_req, res) => res.json({ ok: true }));

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    // Same-origin app; generous ping so flaky wifi survives (30s grace lives
    // in the room layer, not the transport).
    pingTimeout: 20000,
    pingInterval: 10000,
    maxHttpBufferSize: 64 * 1024,
    allowRequest: (req, callback) => callback(null, allowedSocketOrigin(req)),
  });
  const rooms = attachSockets(io, { allowClientScoredCompetitive });
  return { httpServer, io, rooms };
}
