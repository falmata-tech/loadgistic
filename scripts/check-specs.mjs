import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'specs');
const required = ['id', 'title', 'related_ids', 'problem', 'behavior', 'contracts', 'observability', 'rollout'];
const idPattern = /^(BASE-(FE|BE|DEP)|FEAT-[A-Z]{3})-\d{3}$/;

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  });
}

function parseArray(value, file, key) {
  if (!value.startsWith('[') || !value.endsWith(']')) throw new Error(`${file}: ${key} must be an inline YAML array`);
  const inner = value.slice(1, -1).trim();
  return inner ? inner.split(',').map(item => item.trim()).filter(Boolean) : [];
}

function parseSpec(file) {
  const source = fs.readFileSync(file, 'utf8');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) throw new Error(`${file}: missing YAML front matter`);
  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const separator = line.indexOf(':');
    if (separator < 1) throw new Error(`${file}: invalid front matter line: ${line}`);
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (Object.hasOwn(metadata, key)) throw new Error(`${file}: duplicate ${key}`);
    metadata[key] = value;
  }
  for (const key of required) if (!metadata[key]) throw new Error(`${file}: missing ${key}`);
  const arrays = Object.fromEntries(['related_ids', 'contracts', 'observability'].map(key => [key, parseArray(metadata[key], file, key)]));
  if (!idPattern.test(metadata.id)) throw new Error(`${file}: invalid id ${metadata.id}`);
  if (!arrays.contracts.length || !arrays.observability.length) throw new Error(`${file}: contracts and observability cannot be empty`);
  if (metadata.id.startsWith('FEAT-')) {
    for (const keyword of ['Given ', 'When ', 'Then ']) if (!source.includes(keyword)) throw new Error(`${file}: feature specs require ${keyword.trim()} scenarios`);
    if (!source.includes('Tests:') && !source.includes('- Tests:')) throw new Error(`${file}: feature spec must name test ownership`);
  }
  return { file, source, metadata, ...arrays };
}

if (!fs.existsSync(root)) throw new Error('Missing specs directory');
const files = filesUnder(root).filter(file => file.endsWith('.md') && !file.includes(`${path.sep}templates${path.sep}`) && path.basename(file) !== 'README.md' && path.basename(file) !== 'TRACEABILITY.md');
const specs = files.map(parseSpec);
const byId = new Map();
for (const spec of specs) {
  if (byId.has(spec.metadata.id)) throw new Error(`Duplicate spec id ${spec.metadata.id}`);
  byId.set(spec.metadata.id, spec);
}
for (const spec of specs) {
  for (const related of spec.related_ids) if (!byId.has(related)) throw new Error(`${spec.file}: unresolved related id ${related}`);
  if (spec.metadata.id.startsWith('FEAT-') && !spec.related_ids.some(id => id.startsWith('BASE-'))) throw new Error(`${spec.file}: feature must link to a base spec`);
}

console.log(`Spec check passed: ${specs.length} specs, ${[...byId.values()].filter(spec => spec.metadata.id.startsWith('FEAT-')).length} features, all links resolved.`);
