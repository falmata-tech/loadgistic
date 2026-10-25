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
    ['/', '/?view=private', '/track', '/featured', '/app/network']
  );
  assert.deepEqual(manifest.shortcuts.map(shortcut=>shortcut.name),[
    'Public Capacity','Capacity shared with you','Track a shipment','Featured Transport Providers','Network'
  ]);
  assert.deepEqual(manifest.screenshots.map(screenshot=>screenshot.src),[
    '/landing/capacity-map-wide.png','/landing/capacity-map-phone.png'
  ]);
  for(const screenshot of manifest.screenshots){
    const image=await readFile(new URL(`../public${screenshot.src}`,import.meta.url));
    assert.equal(image.subarray(1,4).toString(),'PNG');
  }
  assert.match(worker, /event\.request\.mode === 'navigate'/);
  assert.doesNotMatch(worker, /pathname\.startsWith\('\/_next\/'\)/);
  assert.doesNotMatch(worker, /pathname\.startsWith\('\/app\/'\)/);
  const headers=await nextConfig.headers();
  const workerHeaders=headers.find(entry=>entry.source==='/sw.js')?.headers||[];
  assert.equal(workerHeaders.find(header=>header.key==='Cache-Control')?.value,'no-cache, no-store, must-revalidate');
  assert.equal(workerHeaders.find(header=>header.key==='Content-Security-Policy')?.value,"default-src 'self'; script-src 'self'");
});
