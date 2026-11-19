import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { capacityMapColors,capacityStatusPresentation } from '../src/lib/capacity-status-presentation.js';

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

test('status and map colors have distinct meanings and readable foregrounds', () => {
  assert.equal(new Set([
    ...Object.values(capacityStatusPresentation).map(({color})=>color),
    ...Object.values(capacityMapColors),
  ]).size, 6);
  for (const {color,soft,text} of Object.values(capacityStatusPresentation)) {
    assert.ok(contrast('#ffffff', color) >= 4.5, `White marker text on ${color}`);
    assert.ok(contrast(text,soft) >= 4.5, `Status text on ${soft}`);
  }
  for (const [name,color] of Object.entries(capacityMapColors)) {
    assert.ok(contrast('#ffffff',color)>=3, `${name} outline against light surfaces`);
  }
  assert.match(mobileTokens,/export \{capacityMapColors,capacityStatusPresentation\} from .*capacity-status-presentation\.js/);
});

test('web maps, filters, cards and map keys use the shared Partial color', () => {
  for (const [token, value] of Object.entries({
    '--capacity-empty': capacityStatusPresentation.EMPTY.color,
    '--capacity-empty-soft': capacityStatusPresentation.EMPTY.soft,
    '--capacity-empty-text': capacityStatusPresentation.EMPTY.text,
    '--capacity-location': capacityMapColors.location,
    '--capacity-preferred': capacityMapColors.preferred,
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

test('selection keeps status visible and map keys use shape as well as hue',()=>{
  const selected=css.match(/vehicle-image-marker\.selected:is\(\.empty,\.partial\) \.vehicle-marker-image\{([^}]+)\}/)?.[1]||'';
  assert.match(selected,/outline:2px solid var\(--blue\)/);
  assert.doesNotMatch(selected,/background/);
  assert.match(css,/\.public-map-legend \.partial-status::before\{border-radius:3px;transform:none\}/);
  assert.match(css,/\.public-map-legend \.privacy::before\{border:2px dashed var\(--capacity-location\)/);
  assert.match(css,/\.public-map-legend \.corridor::before\{border-top:3px dotted var\(--capacity-preferred\)/);
});
