import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdtempSync, mkdirSync, symlinkSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {planRasterAbortRepair, applyRasterAbortRepair} from '../scripts/fix-maplibre-raster-abort.cjs';

const project = path.resolve(import.meta.dirname, '..');
const vendor = path.join(project, 'node_modules/maplibre-gl');
const pinnedFiles = planRasterAbortRepair(project);
const source = readFileSync(path.join(vendor, 'src/source/raster_tile_source.ts'), 'utf8');
const tree = ts.createSourceFile('raster.ts', source, ts.ScriptTarget.Latest, true);
const raster = tree.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'RasterTileSource');
const methods = ['loadTile', 'abortTile'].map(name => raster.members.find(member => member.name?.getText(tree) === name).getText(tree));
const javascript = ts.transpileModule(`class Raster { ${methods.join('\n')} }; Raster;`, {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;

function harness(request) {
  // Execute the installed loader, not a copy of the proposed algorithm.
  const Raster = vm.runInNewContext(javascript, {
    AbortController, Uint8Array, Error,
    isAbortError: error => error instanceof Error && error.name === 'AbortError',
    ImageRequest: {transformAndGetImage: request}, ResourceType: {Tile:'Tile'},
  });
  const loader = new Raster();
  const texture = {updates:0, update(){this.updates++;}};
  loader.map = {getPixelRatio:()=>1, _requestManager:{}, _refreshExpiredTiles:false,
    painter:{context:{gl:{}}, getTileTexture:()=>texture}};
  const tile = {state:'loading', aborted:false, tileID:{canonical:{url:()=>'/fixture.png'}}};
  return {loader, tile, texture};
}

test('actual raster abortTile cancellation with false aborted flag unloads without throwing', async () => {
  const {loader,tile} = harness((_manager,_url,_type,controller) => new Promise((_resolve,reject) => {
    controller.signal.addEventListener('abort', () => reject(controller.signal.reason), {once:true});
  }));
  const loading = loader.loadTile(tile);
  await loader.abortTile(tile);
  assert.equal(tile.aborted,false);
  await loading;
  assert.equal(tile.state,'unloaded');
  assert.equal('abortController' in tile,false);
});

test('actual raster loader preserves HTTP, network and image decode failures', async () => {
  for (const name of ['HTTPError','TypeError','InvalidStateError']) {
    const error = new Error('Synthetic tile failure'); error.name=name;
    const {loader,tile} = harness(async()=>{throw error;});
    await assert.rejects(loader.loadTile(tile), error);
    assert.equal(tile.state,'errored');
    assert.equal('abortController' in tile,false);
  }
});

test('actual raster loader still uploads a successful image and handles already-aborted tiles', async () => {
  const response = {data:{width:256,height:256}};
  const {loader,tile,texture} = harness(async()=>response);
  await loader.loadTile(tile); assert.equal(tile.state,'loaded'); assert.equal(texture.updates,1);
  const cancelled = harness(async()=>response); cancelled.tile.aborted=true;
  await cancelled.loader.loadTile(cancelled.tile);
  assert.equal(cancelled.tile.state,'unloaded'); assert.equal(cancelled.texture.updates,0);
});

function fixture(t) {
  const root=mkdtempSync(path.join(tmpdir(),'loadgistic-raster-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'@loadgistic/mobile'}));
  const consumer=path.join(root,'node_modules/maplibre-gl');
  for (const file of ['package.json','src/source/raster_tile_source.ts','dist/maplibre-gl.mjs']) {
    mkdirSync(path.dirname(path.join(consumer,file)),{recursive:true});
    const pinned=pinnedFiles.find(entry=>entry.target===path.join(vendor,file));
    writeFileSync(path.join(consumer,file),pinned?.upstream ?? readFileSync(path.join(vendor,file)));
  }
  return {root,consumer};
}

test('adapter reinstallation is idempotent and repairs both pinned source and imported bundle', t => {
  const {root}=fixture(t);
  for (const entry of planRasterAbortRepair(root)) assert.notEqual(entry.original,entry.content);
  applyRasterAbortRepair(root);
  for (const entry of planRasterAbortRepair(root)) assert.equal(entry.original,entry.content);
  applyRasterAbortRepair(root);
});

test('adapter rejects package, version and source drift before any write', t => {
  for (const [file,content,reason] of [
    ['package.json',JSON.stringify({name:'another-app'}),'LOADGISTIC_MOBILE_REQUIRED'],
    ['node_modules/maplibre-gl/package.json',JSON.stringify({version:'6.14.0'}),'REVIEW_NEW_MAPLIBRE_VERSION'],
    ['node_modules/maplibre-gl/dist/maplibre-gl.mjs','changed upstream bundle','REVIEW_MAPLIBRE_RASTER_SOURCE_DRIFT'],
  ]) {
    const {root,consumer}=fixture(t),sourceFile=path.join(consumer,'src/source/raster_tile_source.ts');
    const before=readFileSync(sourceFile,'utf8');
    writeFileSync(path.join(root,file),content);
    assert.throws(()=>applyRasterAbortRepair(root),new RegExp(reason));
    assert.equal(readFileSync(sourceFile,'utf8'),before);
  }
});

test('adapter refuses a linked dependency outside this mobile project', t => {
  const {root,consumer}=fixture(t);
  rmSync(consumer,{recursive:true});symlinkSync(vendor,consumer,'dir');
  assert.throws(()=>applyRasterAbortRepair(root),/LOADGISTIC_LOCAL_MAPLIBRE_REQUIRED/);
});
