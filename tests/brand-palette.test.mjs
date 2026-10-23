import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const sourceRoots = [
  'src',
  'apps/mobile/src',
  'public',
  'resources/marketing/google-play',
  'supabase/templates',
];
const sourceExtensions = new Set(['.css', '.html', '.js', '.jsx', '.scss', '.svg', '.ts', '.tsx']);
const excludedDirectories = new Set(['.next', 'dist', 'node_modules']);
const brandImages = [
  'public/brand/loadgistic-icon.png',
  'public/brand/loadgistic-wordmark.png',
  'public/brand/loadgistic-wordmark-blue.png',
  'public/brand/loadgistic-wordmark-on-dark.png',
  'public/icon-192.png',
  'public/icon-512.png',
  'public/icon-maskable-512.png',
  'apps/mobile/assets/loadgistic-icon.png',
  'apps/mobile/assets/loadgistic-wordmark.png',
  'apps/mobile/assets/loadgistic-wordmark-on-dark.png',
  'apps/mobile/assets/android-icon-foreground.png',
];

function collectSourceFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return excludedDirectories.has(entry.name) ? [] : collectSourceFiles(filePath);
    }
    return sourceExtensions.has(path.extname(entry.name).toLowerCase()) ? [filePath] : [];
  });
}

function hasLegacyGreenHue(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  if (chroma === 0 || max <= 0.18 || chroma / max <= 0.01) return false;

  let hue;
  if (max === r) hue = ((g - b) / chroma) % 6;
  else if (max === g) hue = (b - r) / chroma + 2;
  else hue = (r - g) / chroma + 4;
  hue = (hue * 60 + 360) % 360;
  return hue >= 75 && hue <= 175;
}

function findLegacyColors(source) {
  const colors = [];
  for (const match of source.matchAll(/#([\da-f]{3,8})\b/gi)) {
    let hex = match[1];
    if (hex.length === 3) hex = [...hex].map(char => char + char).join('');
    if (hex.length === 4) hex = [...hex.slice(0, 3)].map(char => char + char).join('');
    if (hex.length !== 6 && hex.length !== 8) continue;
    const channels = [0, 2, 4].map(index => Number.parseInt(hex.slice(index, index + 2), 16));
    if (hasLegacyGreenHue(...channels)) colors.push(match[0]);
  }
  for (const match of source.matchAll(/rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})(?:\s*[,/]\s*[\d.]+%?)?\s*\)/gi)) {
    const channels = match.slice(1, 4).map(Number);
    if (hasLegacyGreenHue(...channels)) colors.push(match[0]);
  }
  for (const match of source.matchAll(/hsla?\(\s*([\d.]+)(?:deg)?\s*[, ]\s*[\d.]+%\s*[, ]\s*[\d.]+%(?:\s*[,/]\s*[\d.]+%?)?\s*\)/gi)) {
    const hue = Number(match[1]) % 360;
    if (hue >= 75 && hue <= 175) colors.push(match[0]);
  }
  const colorProperties = /(?:^|[;{,])\s*(?:color|background(?:-color|Color)?|border(?:-[\w-]+|Color)?)\s*:\s*([^;},]+)/gi;
  const legacyNamedColor = /\b(?:lime|green|teal|olive|chartreuse|springgreen|mediumspringgreen|lightgreen|yellowgreen|seagreen|mediumseagreen|darkgreen|forestgreen|limegreen|turquoise|aquamarine|cadetblue)\b/i;
  for (const match of source.matchAll(colorProperties)) {
    if (legacyNamedColor.test(match[1])) colors.push(match[1].trim());
  }
  for (const match of source.matchAll(/(?:fill|stroke)\s*=\s*["']([^"']+)["']/gi)) {
    if (legacyNamedColor.test(match[1])) colors.push(match[0]);
  }
  return colors;
}

test('production UI source contains no legacy green or teal brand hues', () => {
  const findings = sourceRoots.flatMap(root => collectSourceFiles(root)).flatMap(filePath =>
    findLegacyColors(readFileSync(filePath, 'utf8')).map(color => `${filePath}: ${color}`),
  );
  assert.deepEqual(findings, [], `Replace old green/teal UI colors with the approved palette:\n${findings.join('\n')}`);
});

test('served brand marks and app icons contain no legacy green or teal pixels', async () => {
  const findings = [];
  for (const filePath of brandImages) {
    const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let index = 0; index < data.length; index += info.channels) {
      if (data[index + 3] < 96) continue;
      if (hasLegacyGreenHue(data[index], data[index + 1], data[index + 2])) {
        findings.push(filePath);
        break;
      }
    }
  }
  assert.deepEqual(findings, [], `Rebuild legacy-tinted brand assets from the approved navy/cobalt identity:\n${findings.join('\n')}`);
});
