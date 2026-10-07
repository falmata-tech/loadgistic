import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCapacityPage, capacityUrl, loadCapacity, loadSharedCapacity } from '../src/api/public-capacity.ts';
const row = (id, extra = {}) => ({ id, status: 'EMPTY', assigned_driver_first_name: 'Driver', location_lat: 9, location_lng: 38, ...extra });
test('only available assigned trucks enter the projection; contacts stay out', () => {
 const page = parseCapacityPage({ items: [row('a', { contact_email: 'private@example.test' }), row('b', { status: 'FULL' }), row('c', { assigned_driver_first_name: '' })], hasMore: false });
 assert.equal(page.items.length, 1); assert.equal('contact_email' in page.items[0], false);
});
test('invalid coordinates stay off map and malformed pagination fails', () => {
 assert.equal(parseCapacityPage({ items: [row('a', { location_lat: 100 })], hasMore: false }).items[0].latitude, null);
 assert.throws(() => parseCapacityPage({ items: [], hasMore: true }));
});
test('search is encoded; insecure external endpoints and embedded credentials fail', () => {
 assert.equal(new URL(capacityUrl('https://loadgistic.com', 'A&B')).searchParams.get('q'), 'A&B');
 assert.throws(() => capacityUrl('http://example.com', ''));
 assert.throws(() => capacityUrl('https://user:password@loadgistic.com', ''));
});
test('all cursor pages load automatically and duplicate rows collapse', async () => {
 let calls = 0, result;
 await loadCapacity('https://loadgistic.com', '', new AbortController().signal, items => result = items, async (_url, options) => {
 assert.equal(options.credentials, 'omit'); calls++;
 return Response.json({ items: [row('a'), ...(calls === 2 ? [row('b')] : [])], hasMore: calls === 1, nextCursor: calls === 1 ? 'page2' : null });
 });
 assert.equal(calls, 2); assert.equal(result.length, 2);
});
test('repeated cursors fail instead of silently looping or truncating', async () => {
 await assert.rejects(loadCapacity('https://loadgistic.com', '', new AbortController().signal, () => {}, async () => Response.json({ items: [], hasMore: true, nextCursor: 'same' })), /finish loading/);
});
test('aborted response cannot publish stale search data', async () => {
 const c = new AbortController(); let published = false;
 await assert.rejects(loadCapacity('https://loadgistic.com', '', c.signal, () => { published = true; }, async () => { c.abort(); return Response.json({ items: [row('a')], hasMore: false }); }));
 assert.equal(published, false);
});

test('lookalike local hostnames cannot bypass HTTPS', () => {
 for (const host of ['10.evil.example', '192.168.attacker.example', '172.32.1.2']) assert.throws(() => capacityUrl(`http://${host}`, ''));
 for (const host of ['10.0.2.2', '192.168.1.10', '172.16.1.3']) assert.equal(new URL(capacityUrl(`http://${host}:3100`, '')).hostname, host);
});

test('private capacity loads every scoped page and cannot publish after access cancellation', async () => {
 let calls = 0, result;
 await loadSharedCapacity('A&B', new AbortController().signal, items => { result = items; }, async path => {
  assert.equal(new URL(path, 'https://loadgistic.com').searchParams.get('q'), 'A&B'); assert.ok(path.startsWith('/api/mobile/visitor/capacity/signals?')); calls++;
  return { items: [row('a'), ...(calls === 2 ? [row('b')] : [])], hasMore: calls === 1, nextCursor: calls === 1 ? 'next' : null };
 });
 assert.equal(calls, 2); assert.equal(result.length, 2);
 const abort = new AbortController(); let published = false;
 await assert.rejects(loadSharedCapacity('', abort.signal, () => { published = true; }, async () => { abort.abort(); return { items: [row('a')], hasMore: false }; })); assert.equal(published, false);
 await assert.rejects(loadSharedCapacity('', new AbortController().signal, () => {}, async () => ({ items: [], hasMore: true, nextCursor: 'repeat' })), /finish loading/);
});
