#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const FLAGS_SOURCE = 'https://www.countries-ofthe-world.com/flags-of-the-world.html';
export const EXPECTED_FLAGS = 197;
const SOURCE_ORIGIN = new URL(FLAGS_SOURCE).origin;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'data/flags-manifest.json');
const SOURCE_SNAPSHOT = join(ROOT, 'data/flags-source-snapshot.html');
const ASSETS = join(ROOT, 'public/assets/flags');

export function parseFlagTable(html) {
  return [...html.matchAll(/<img[^>]+src=["']([^"']*flags-normal\/[^"']+)["'][^>]*>\s*<\/td>\s*<td[^>]*>\s*([^<]+)\s*<\/td>/gi)]
    .map(([, sourceUrl, name]) => {
      const parsedUrl = new URL(sourceUrl, FLAGS_SOURCE);
      if (parsedUrl.origin !== SOURCE_ORIGIN || !parsedUrl.pathname.startsWith('/flags-normal/') || !parsedUrl.pathname.endsWith('.png')) {
        throw new Error(`Unsafe flag source URL: ${parsedUrl.href}`);
      }
      const absoluteUrl = parsedUrl.href;
      const key = createHash('sha256').update(absoluteUrl).digest('hex').slice(0, 20);
      return { name: name.trim(), sourceUrl: absoluteUrl, asset: `/assets/flags/${key}.png` };
    });
}

function validateRows(rows) {
  if (rows.length !== EXPECTED_FLAGS) throw new Error(`Expected ${EXPECTED_FLAGS} flags, got ${rows.length}`);
  if (new Set(rows.map((row) => row.name)).size !== rows.length) throw new Error('Country names are not unique');
  if (new Set(rows.map((row) => row.sourceUrl)).size !== rows.length) throw new Error('Source image URLs are not unique');
  if (new Set(rows.map((row) => row.asset)).size !== rows.length) throw new Error('Local asset paths are not unique');
}

export function isPng(bytes) {
  try {
    if (bytes.length <= 24 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
    let offset = 8;
    let header = null;
    const imageData = [];
    let ended = false;
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset);
      const end = offset + 12 + length;
      if (end > bytes.length) return false;
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      const data = bytes.subarray(offset + 8, offset + 8 + length);
      if (type === 'IHDR') header = data;
      if (type === 'IDAT') imageData.push(data);
      if (type === 'IEND') { ended = true; break; }
      offset = end;
    }
    if (!header || header.length !== 13 || !imageData.length || !ended) return false;
    const width = header.readUInt32BE(0);
    const height = header.readUInt32BE(4);
    const bitDepth = header[8];
    const channels = new Map([[0, 1], [2, 3], [3, 1], [4, 2], [6, 4]]).get(header[9]);
    if (!width || !height || !channels || header[10] !== 0 || header[11] !== 0 || header[12] !== 0) return false;
    const rowBytes = Math.ceil(width * channels * bitDepth / 8);
    return inflateSync(Buffer.concat(imageData)).length === (rowBytes + 1) * height;
  } catch {
    return false;
  }
}

const curl = promisify(execFile);
const USER_AGENT = 'amuseical-chairs flag scraper';

async function fetchBytes(url) {
  const args = ['-fsSL', '--retry', '3', '-A', USER_AGENT];
  if (url !== FLAGS_SOURCE) args.push('-e', FLAGS_SOURCE);
  args.push(url);
  const { stdout } = await curl('curl', args, {
    encoding: 'buffer',
    maxBuffer: 2 * 1024 * 1024,
  });
  return stdout;
}

async function main() {
  const verify = process.argv.includes('--verify');
  const html = verify
    ? await readFile(SOURCE_SNAPSHOT, 'utf8')
    : (await fetchBytes(FLAGS_SOURCE)).toString('utf8');
  const rows = parseFlagTable(html);
  validateRows(rows);

  if (!verify) {
    await rm(ASSETS, { recursive: true, force: true });
    await mkdir(ASSETS, { recursive: true });
    for (const row of rows) {
      const bytes = await fetchBytes(row.sourceUrl);
      if (!isPng(bytes)) throw new Error(`Invalid PNG asset: ${row.name}`);
      await writeFile(join(ASSETS, basename(row.asset)), bytes);
    }
    await mkdir(join(ROOT, 'data'), { recursive: true });
    const tableRows = html.split(/\r?\n/).filter((line) => line.includes('<tr>') && line.includes('flags-normal/'));
    if (tableRows.length !== EXPECTED_FLAGS) throw new Error(`Expected ${EXPECTED_FLAGS} source table rows, got ${tableRows.length}`);
    await writeFile(SOURCE_SNAPSHOT, `<table>\n${tableRows.join('\n')}\n</table>\n`);
    await writeFile(MANIFEST, `${JSON.stringify({ source: FLAGS_SOURCE, count: rows.length, flags: rows }, null, 2)}\n`);
  }

  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  validateRows(manifest.flags);
  if (manifest.source !== FLAGS_SOURCE || manifest.count !== EXPECTED_FLAGS) throw new Error('Manifest metadata does not match the source contract');
  if (JSON.stringify(manifest.flags) !== JSON.stringify(rows)) throw new Error('Manifest does not match the parsed source table');
  for (const row of manifest.flags) {
    const bytes = await readFile(join(ROOT, 'public', row.asset.replace(/^\//, '')));
    if (!isPng(bytes)) throw new Error(`Committed asset is not a decodable PNG: ${row.name}`);
  }
  console.log(`Verified ${rows.length} unique local flags from ${FLAGS_SOURCE}`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) main().catch((error) => { console.error(error); process.exitCode = 1; });
