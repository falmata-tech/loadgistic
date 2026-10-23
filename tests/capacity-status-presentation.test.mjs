import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { capacityStatusPresentation } from '../src/lib/capacity-status-presentation.js';

const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const mobileTokens = readFileSync(new URL('../apps/mobile/src/theme/capacity-status-presentation.ts', import.meta.url), 'utf8');

function contrast(foreground, background) {
  const luminance = color => {
    const channels = color.match(/[\da-f]{2}/gi).map(channel => Number.parseInt(channel, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('Empty and Partial have distinct, readable shared status colors', () => {
  assert.deepEqual(capacityStatusPresentation, {
    EMPTY: { color: '#155eef', soft: '#eaf1ff', text: '#155eef' },
    PARTIAL: { color: '#667085', soft: '#f2f4f7', text: '#475467' },
  });
  assert.ok(contrast('#ffffff', capacityStatusPresentation.PARTIAL.color) >= 4.5);
  assert.ok(contrast(capacityStatusPresentation.PARTIAL.text, capacityStatusPresentation.PARTIAL.soft) >= 4.5);

  for (const [status, tokens] of Object.entries(capacityStatusPresentation)) {
    const block = mobileTokens.match(new RegExp(`${status}:\\s*\\{([^}]+)\\}`))?.[1];
    assert.ok(block, `mobile ${status} tokens exist`);
    for (const [name, value] of Object.entries(tokens)) {
      assert.match(block, new RegExp(`${name}:\\s*['\"]${value}['\"]`), `mobile ${status}.${name} matches web`);
    }
  }
});

test('web maps, filters, cards and map keys use the shared Partial color', () => {
  for (const [token, value] of Object.entries({
    '--capacity-empty': capacityStatusPresentation.EMPTY.color,
    '--capacity-empty-soft': capacityStatusPresentation.EMPTY.soft,
    '--capacity-partial': capacityStatusPresentation.PARTIAL.color,
    '--capacity-partial-soft': capacityStatusPresentation.PARTIAL.soft,
    '--capacity-partial-text': capacityStatusPresentation.PARTIAL.text,
  })) assert.match(css, new RegExp(`${token}:\\s*${value.replace('#', '\\#')};`));

  for (const selector of [
    '.public-map-legend .partial-status::before',
    '.capacity-truck-map-marker.vehicle-image-marker.partial::after',
    '.capacity-truck-map-marker.vehicle-image-marker.partial .vehicle-marker-image',
    '.capacity-map-cluster.partial',
    '.capacity-map-key i.partial-route',
    '.capacity-choice-symbol.partial',
    '.capacity-marker-tooltip.partial',
    '.capacity-signal-inspector article.partial',
  ]) assert.match(css, new RegExp(`${selector.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\{[^}]*var\\(--capacity-partial`));
});
