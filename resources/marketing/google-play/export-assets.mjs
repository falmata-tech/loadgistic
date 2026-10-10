import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const sources = path.join(root, 'resources/marketing/google-play');
const output = path.join(root, '.local/play-store-20261010');
const listing = JSON.parse(await readFile(path.join(sources, 'listing-en-US.json'), 'utf8'));
assert.equal(listing.package, 'com.loadgistic.app');
assert.ok(listing.appName.length <= 30 && listing.shortDescription.length <= 80 && listing.fullDescription.length <= 4000);
for (const asset of [listing.featureGraphic, listing.icon, ...listing.phoneScreenshots]) {
  assert.ok(asset.altText.length <= 140);
}
await mkdir(output, { recursive: true });
const artwork = await readFile(path.join(sources, 'feature-artwork.png'));
const overlay = await readFile(path.join(sources, 'feature-graphic.svg'));
const icon = await readFile(path.join(root, listing.icon.source));
const feature = await sharp(artwork).resize(1024, 500, { fit: 'cover', position: 'centre' })
  .composite([{ input: overlay }]).flatten({ background: '#0b1d3a' }).removeAlpha().png().toBuffer();
const iconExport = await sharp(icon).resize(512, 512).ensureAlpha().png().toBuffer();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const assets = [];
for (const [name, bytes, width, height, channels, maxBytes] of [
  ['feature-graphic-1024x500.png', feature, 1024, 500, 3, 8388608],
  ['icon-512.png', iconExport, 512, 512, 4, 1048576],
]) {
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, width);
  assert.equal(metadata.height, height);
  assert.equal(metadata.channels, channels);
  assert.ok(bytes.length <= maxBytes);
  await writeFile(path.join(output, name), bytes);
  assets.push({ name, width, height, channels, hasAlpha: metadata.hasAlpha, bytes: bytes.length, sha256: sha(bytes) });
}
await writeFile(path.join(output, 'listing-en-US.json'), JSON.stringify(listing, null, 2) + '\n');
const evidence = {
  package: listing.package, createdAt: new Date().toISOString(), state: 'local_draft_not_submitted',
  newGraphicAiAssisted: true, generator: 'built-in imagegen', provenance: listing.featureGraphic.provenance,
  sourceArtworkSha256: sha(artwork), sourceSvgSha256: sha(overlay),
  existingIconSourceSha256: sha(icon), newGraphicOwnerApproved: listing.featureGraphic.reviewed === true,
  ownerApproval: listing.featureGraphic.approval || null,
  descriptionLengths: { name: listing.appName.length, short: listing.shortDescription.length, full: listing.fullDescription.length },
  altTextLengthsChecked: true, assets,
  finalPhoneScreenshotsCaptured: false, googleListingChanged: false,
};
await writeFile(path.join(output, 'asset-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ state: evidence.state, assets }));
