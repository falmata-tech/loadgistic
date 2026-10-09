// Temporary MapLibre GL JS 6.13.0 compatibility adapter (FEAT-MOB-001).
// Raster cancellation follows the existing vector/GeoJSON AbortError policy.
// Remove after reviewing an upstream fix; unexpected package/source drift fails.
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const repairs = [
  {
    file: 'src/source/raster_tile_source.ts',
    hash: 'd3627f7cd672ab07865ac6a79847f7397c0f9b2e108be9b17580ca411c8ad611',
    before: "} catch (err) {\n            delete tile.abortController;\n            if (tile.aborted) {",
    after: "} catch (err) {\n            delete tile.abortController;\n            if (tile.aborted || isAbortError(err)) {",
  },
  {
    file: 'dist/maplibre-gl.mjs',
    hash: '389731e8581cc59d484e867b051db73ae034a76f0691d2890a2a1a7d2495bdf3',
    before: 'catch(t){if(delete e.abortController,e.aborted)e.state=`unloaded`;else if(t)throw e.state=`errored`,t}}async abortTile(e)',
    after: 'catch(t){if(delete e.abortController,e.aborted||t instanceof Error&&t.name===`AbortError`)e.state=`unloaded`;else if(t)throw e.state=`errored`,t}}async abortTile(e)',
  },
];

function planRasterAbortRepair(root) {
  const project = fs.realpathSync(root);
  if (JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8')).name !== '@loadgistic/mobile') {
    throw Error('LOADGISTIC_MOBILE_REQUIRED');
  }
  const expected = path.join(project, 'node_modules/maplibre-gl');
  const consumer = fs.realpathSync(expected);
  if (consumer !== expected) throw Error('LOADGISTIC_LOCAL_MAPLIBRE_REQUIRED');
  if (JSON.parse(fs.readFileSync(path.join(consumer, 'package.json'), 'utf8')).version !== '6.13.0') {
    throw Error('REVIEW_NEW_MAPLIBRE_VERSION');
  }
  // Validate all targets before writing any; never leave a partial drift repair.
  return repairs.map(repair => {
    const target = path.join(consumer, repair.file);
    if (fs.realpathSync(target) !== target) throw Error('LOADGISTIC_LOCAL_MAPLIBRE_REQUIRED');
    const original = fs.readFileSync(target, 'utf8');
    const patched = original.includes(repair.after);
    const reverted = patched ? original.replace(repair.after, repair.before) : original;
    if (createHash('sha256').update(reverted).digest('hex') !== repair.hash ||
        reverted.split(repair.before).length !== 2) {
      throw Error('REVIEW_MAPLIBRE_RASTER_SOURCE_DRIFT');
    }
    return {target, original, upstream: reverted, content: patched ? original : original.replace(repair.before, repair.after)};
  });
}

function applyRasterAbortRepair(root) {
  const plan = planRasterAbortRepair(root);
  for (const entry of plan) if (entry.content !== entry.original) fs.writeFileSync(entry.target, entry.content);
}

module.exports = {planRasterAbortRepair, applyRasterAbortRepair};
if (require.main === module) {
  applyRasterAbortRepair(path.resolve(__dirname, '..'));
  console.log('Loadgistic mobile: verified raster cancellation compatibility adapter.');
}
