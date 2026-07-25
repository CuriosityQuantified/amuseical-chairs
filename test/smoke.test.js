// Boot the real server and check that everything a browser asks for is
// actually served.
//
// The client half of this app has no build step: `public/js/*.js` import
// `/shared/*.js` and `/vendor/*.js` by absolute URL, resolved by express
// static routes at request time. Nothing else in the suite imports those
// modules, so a client importing a path the server does not serve is a 404 on
// a player's phone and green everywhere else — including in `npm run check`,
// which verifies the import is well-formed but not that it resolves.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createServer } from '../server/app.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

async function withServer(fn) {
  const { httpServer, io, rooms } = createServer();
  await new Promise((r) => httpServer.listen(0, r));
  const base = `http://localhost:${httpServer.address().port}`;
  try {
    await fn(base);
  } finally {
    for (const room of rooms.values()) room.destroy();
    io.close();
    httpServer.close();
  }
}

test('healthz answers and the two entry points are served', async () => {
  await withServer(async (base) => {
    const health = await fetch(`${base}/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });

    for (const path of ['/', '/host.html']) {
      const res = await fetch(`${base}${path}`);
      assert.equal(res.status, 200, `${path} is served`);
      assert.match(await res.text(), /<html/i, `${path} is a document`);
    }
  });
});

test('every absolute import in a client module resolves over HTTP', async () => {
  const jsDir = join(ROOT, 'public/js');
  const modules = readdirSync(jsDir).filter((f) => f.endsWith('.js'));
  assert.ok(modules.length >= 6, 'found the client modules');

  // Static and dynamic imports that start with "/" — the ones express has to
  // route. Relative imports resolve against a URL that is already proven.
  const specifiers = new Set();
  for (const file of modules) {
    const src = readFileSync(join(jsDir, file), 'utf8');
    for (const [, spec] of src.matchAll(/from\s+['"](\/[^'"]+)['"]/g)) specifiers.add(spec);
    for (const [, spec] of src.matchAll(/import\(\s*['"](\/[^'"]+)['"]\s*\)/g)) specifiers.add(spec);
  }
  assert.ok(specifiers.has('/shared/rng.js'), 'the shared modules are in the sample');

  await withServer(async (base) => {
    for (const file of modules) {
      const res = await fetch(`${base}/js/${file}`);
      assert.equal(res.status, 200, `/js/${file} is served`);
    }
    for (const spec of specifiers) {
      const res = await fetch(`${base}${spec}`);
      assert.equal(res.status, 200, `${spec} is imported by a client module but not served`);
      assert.match(res.headers.get('content-type') || '', /javascript/,
        `${spec} is served as JavaScript — a browser refuses any other type for a module`);
    }
  });
});
