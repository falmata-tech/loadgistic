import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import nextConfig from '../next.config.mjs';

test('PWA launches into public discovery and keeps private pages network-first', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  const worker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.deepEqual(
    manifest.shortcuts.map(shortcut => shortcut.url),
    ['/', '/shared-capacity', '/track', '/featured', '/app/home']
  );
  assert.match(worker, /event\.request\.mode === 'navigate'/);
  assert.doesNotMatch(worker, /pathname\.startsWith\('\/_next\/'\)/);
  assert.doesNotMatch(worker, /pathname\.startsWith\('\/app\/'\)/);
  const headers=await nextConfig.headers();
  const workerHeaders=headers.find(entry=>entry.source==='/sw.js')?.headers||[];
  assert.equal(workerHeaders.find(header=>header.key==='Cache-Control')?.value,'no-cache, no-store, must-revalidate');
  assert.equal(workerHeaders.find(header=>header.key==='Content-Security-Policy')?.value,"default-src 'self'; script-src 'self'");
});
