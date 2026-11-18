// CI-only dump/restore pipeline. Keep raw PostgreSQL stderr in memory and emit
// only fixed error categories: it can contain object names or connection data.
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const STDERR_LIMIT = 8192;
export const GPS_CLONE_ARCHIVE_RESTORE_TIMEOUT_MS=120000;

// Extension CREATE defaults can lose the source table's RLS/initial grants.
// Fixed local resource only; use the existing owner bootstrap before SQL tests.
export const GPS_CLONE_SPATIAL_SECURITY_SQL=`select jsonb_build_object(
 'extension',(select e.extname from pg_depend d join pg_extension e on e.oid=d.refobjid where d.classid='pg_class'::regclass and d.objid=to_regclass('public.spatial_ref_sys')and d.deptype='e'),
 'version',(select extversion from pg_extension where extname='postgis'),
 'schema',(select n.nspname from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='postgis'),
 'owner',(select pg_get_userbyid(relowner)from pg_class where oid=to_regclass('public.spatial_ref_sys')),
 'rls',(select relrowsecurity from pg_class where oid=to_regclass('public.spatial_ref_sys')),
 'forceRls',(select relforcerowsecurity from pg_class where oid=to_regclass('public.spatial_ref_sys')),
 'policyCount',(select count(*)from pg_policy where polrelid=to_regclass('public.spatial_ref_sys')),
 'acl',(select jsonb_agg(jsonb_build_array(pg_get_userbyid(a.grantor),case when a.grantee=0 then 'PUBLIC'else pg_get_userbyid(a.grantee)end,a.privilege_type,a.is_grantable)order by a.grantor,a.grantee,a.privilege_type)
 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))a where c.oid=to_regclass('public.spatial_ref_sys')));`;

export function parseGpsCloneSpatialSecurity(value){
 try{return JSON.parse(value);}catch{throw Error('GPS CI PostGIS security metadata unavailable');}
}
function spatialAcl(snapshot,hardened){
 const fail=()=>{throw Error('GPS CI expected local PostGIS owner security');};
 if(!snapshot||Object.keys(snapshot).sort().join(',')!=='acl,extension,forceRls,owner,policyCount,rls,schema,version'
  ||snapshot.extension!=='postgis'||snapshot.schema!=='public'||snapshot.owner!=='supabase_admin'
  ||!/^3\.\d+\.\d+$/.test(snapshot.version)||typeof snapshot.rls!=='boolean'||snapshot.forceRls!==false
  ||snapshot.policyCount!==0||!Array.isArray(snapshot.acl))fail();
 const privileges=['DELETE','INSERT','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE'];
 if(snapshot.acl.some(a=>Array.isArray(a)&&a[2]==='MAINTAIN'))privileges.push('MAINTAIN');
 const expected=[];for(const role of ['supabase_admin','postgres','service_role'])for(const privilege of privileges)expected.push(JSON.stringify(['supabase_admin',role,privilege,false]));
 const actual=snapshot.acl.map(a=>JSON.stringify(a));
 if(new Set(actual).size!==actual.length||actual.some(a=>!expected.includes(a)))fail();
 if(hardened&&(snapshot.rls!==true||actual.length!==expected.length))fail();
 if(!privileges.every(p=>actual.includes(JSON.stringify(['supabase_admin','supabase_admin',p,false]))))fail();
 return actual.sort().join('|');
}
export function checkedGpsCloneSpatialSecurity(source,target=source){
 const sourceAcl=spatialAcl(source,true),targetAcl=spatialAcl(target,true);
 if(source.version!==target.version||sourceAcl!==targetAcl)throw Error('GPS CI PostGIS source/clone security mismatch');
 return true;
}
export function gpsCloneSpatialOwnerSql(source,target,ownerSql){
 spatialAcl(source,true);spatialAcl(target,false);
 if(source.version!==target.version)throw Error('GPS CI PostGIS source/clone version mismatch');
 const anchor='alter table public.spatial_ref_sys enable row level security;';
 if(typeof ownerSql!=='string'||ownerSql.split(anchor).length!==2||!/^begin;$/m.test(ownerSql))throw Error('GPS CI expected existing local owner bootstrap');
 return ownerSql.replace(/^begin;$/m,`begin;
do $gps_spatial_clone$begin
 if current_database()<>'loadgistic_telematics_ci'or current_user<>'supabase_admin'then raise exception 'GPS_CLONE_LOCAL_OWNER_REQUIRED';end if;
end $gps_spatial_clone$;`).replace(anchor,'grant all privileges on table public.spatial_ref_sys to postgres,service_role;\n'+anchor);
}

export function checkedLocalGpsPassword(status) {
  let url;
  try {
    url = new URL(status?.DB_URL);
  } catch {
    throw new Error('GPS CI local database URL is missing or invalid');
  }
  if (!['postgresql:', 'postgres:'].includes(url.protocol)
      || url.hostname !== '127.0.0.1' || url.port !== '55322'
      || url.pathname !== '/postgres' || decodeURIComponent(url.username) !== 'postgres'
      || !url.password || url.search || url.hash) {
    throw new Error('GPS CI local database target mismatch');
  }
  return decodeURIComponent(url.password);
}

export function checkedLocalRestoreRole(user) {
  if (user !== 'supabase_admin') throw new Error('GPS CI local restore role mismatch');
  return user;
}

export function checkedMatchingPgMajor(clientMajor, serverMajor) {
  if (![15, 17].includes(clientMajor) || clientMajor !== serverMajor) {
    throw new Error('GPS CI PostgreSQL client/server major mismatch');
  }
  return clientMajor;
}

function graphqlArchiveParts(toc,snapshot){
  if(typeof toc!=='string')throw Error('GPS CI expected one Supabase pg_graphql wrapper ACL');
  const lines = toc.split(/\r?\n/);
  const pattern = /^\d+; \d+ \d+ ACL graphql_public FUNCTION graphql\("operationName" text, query text, variables jsonb, extensions jsonb\) supabase_admin$/;
  const deferred = lines.filter((line) => pattern.test(line));
  // Refuse changed signatures, quoting, owners and unexpected object labels,
  // rather than treating an unrecognized wrapper ACL as an omitted ACL.
  const related=lines.filter(line=>!/^\s*;/.test(line)&&/\bACL\b/.test(line)
    &&/(?:^|\s)"?graphql_public"?(?:\s|\.)/.test(line)
    &&/(?:^|\s|\.)"?graphql"?(?:\s|\(|$)/.test(line));
  const matchesInitial=snapshot?.initialAclCount===1&&snapshot.initialAclHash===snapshot.identity.split('|')[1];
  const mode=deferred.length===1&&related.length===1?'DEFERRED_WRAPPER_ACL':
    deferred.length===0&&related.length===0&&matchesInitial&&snapshot.owner==='supabase_admin'?'INITIAL_WRAPPER_ACL':'REFUSED';
  const bucket=count=>count===0?'zero':count===1?'one':'multiple';
  return {lines,pattern,deferred,mode,diagnostic:{mode,exactAclEntries:bucket(deferred.length),relatedAclEntries:bucket(related.length),
    initialAclRows:bucket(snapshot?.initialAclCount??0),currentMatchesInitial:matchesInitial,expectedOwner:snapshot?.owner==='supabase_admin'}};
}

// Defer only the known PG15 ACL. A second dump can omit it after extension
// enrollment recorded these exact current grants as the initial grants.
export function splitPgGraphqlAclToc(toc,graphqlSnapshot=null) {
  if(graphqlSnapshot!==null)checkedGraphqlSnapshot(graphqlSnapshot);
  const {lines,pattern,deferred,mode,diagnostic}=graphqlArchiveParts(toc,graphqlSnapshot);
  if(mode==='REFUSED')throw new Error('GPS CI expected one Supabase pg_graphql wrapper ACL');
  return {
    main: `${lines.filter((line) => !pattern.test(line)).join('\n').trimEnd()}\n`,
    deferred: deferred.length?`${deferred[0]}\n`:null,
    diagnostic,
  };
}

const graphqlWrapper='graphql_public.graphql(text,text,jsonb,jsonb)';
const graphqlIdentitySql=`select md5(pg_get_functiondef(p.oid)) || '|' || md5(coalesce(p.proacl::text,''))
 from pg_proc p where p.oid=to_regprocedure('${graphqlWrapper}');`;
const graphqlExtensionSql=`select e.extname from pg_depend d join pg_extension e on e.oid=d.refobjid
 where d.classid='pg_proc'::regclass and d.objid=to_regprocedure('${graphqlWrapper}') and d.deptype='e';`;
const graphqlOwnerSql=`select pg_get_userbyid(proowner) from pg_proc where oid=to_regprocedure('${graphqlWrapper}');`;
const graphqlInitialSql=`select jsonb_build_object('owner',pg_get_userbyid(p.proowner),
 'initialAclCount',(select count(*) from pg_init_privs i where i.classoid='pg_proc'::regclass and i.objoid=p.oid),
 'initialAclHash',(select md5(min(i.initprivs::text)) from pg_init_privs i where i.classoid='pg_proc'::regclass and i.objoid=p.oid and i.objsubid=0 and i.privtype='e'))
 from pg_proc p where p.oid=to_regprocedure('${graphqlWrapper}');`;
function checkedGraphqlSnapshot(snapshot){
 if(snapshot?.extension!=='pg_graphql'||!/^[a-f0-9]{32}\|[a-f0-9]{32}$/.test(snapshot?.identity||'')
  ||typeof snapshot?.definition!=='string'||!snapshot.definition.startsWith('CREATE OR REPLACE FUNCTION graphql_public.graphql(')
  ||![0,1].includes(snapshot?.initialAclCount)
  ||(snapshot.initialAclCount===0?snapshot.initialAclHash!==null:!/^[a-f0-9]{32}$/.test(snapshot.initialAclHash||'')))
  throw Error('GPS CI invalid pg_graphql restore snapshot');
 if(snapshot.owner!=='supabase_admin')throw Error('GPS CI GraphQL wrapper owner mismatch');
 return snapshot;
}
function graphqlInitialFacts(value){
 try{const parsed=JSON.parse(value);if(parsed&&typeof parsed==='object')return {owner:parsed.owner,initialAclCount:parsed.initialAclCount,initialAclHash:parsed.initialAclHash};}catch{}
 throw Error('GPS CI invalid pg_graphql restore snapshot');
}

// Capture before a disposable source is dropped, or from the unchanged local
// primary used by normal CI cloning. No credentials or customer rows are read.
export async function captureGpsCloneGraphql({major,query}){
 checkedMatchingPgMajor(major,major);
 if(major!==15)return null;
 return checkedGraphqlSnapshot({extension:await query(graphqlExtensionSql),identity:await query(graphqlIdentitySql),
  definition:await query(`select pg_get_functiondef('${graphqlWrapper}'::regprocedure);`),
  ...graphqlInitialFacts(await query(graphqlInitialSql))});
}

// This probe is deliberately separate from read-only source capture: the normal
// cloner must never create a probe in the unchanged primary. Only the owner-race
// runner calls it on an already verified disposable clone, before fixture writes.
export async function proveGpsCloneGraphqlCreation({database,graphqlSnapshot,query}){
 if(!['loadgistic_pilot_ci','loadgistic_telematics_ci'].includes(database))throw Error('GPS CI disposable GraphQL probe database required');
 const source=checkedGraphqlSnapshot(graphqlSnapshot),name='loadgistic_acl_probe_'+randomUUID().replaceAll('-','');
 const result=await query(`begin;set local statement_timeout='5s';set local lock_timeout='2s';
 do $guard$ begin if current_database()<>'${database}' or current_user<>'supabase_admin' then raise exception 'GPS_CLONE_DISPOSABLE_REQUIRED';end if;end $guard$;
 create function graphql_public.${name}() returns jsonb language sql as 'select null::jsonb';
 select md5(coalesce(proacl::text,''))||'|'||pg_get_userbyid(proowner) from pg_proc where oid='graphql_public.${name}()'::regprocedure;
 rollback;`);
 if(result!==source.identity.split('|')[1]+'|supabase_admin')throw Error('GPS CI fresh GraphQL wrapper ACL differs from source');
 return true;
}

export function gpsCloneGraphqlArchiveDiagnostic({major,graphqlSnapshot,toc}){
 checkedMatchingPgMajor(major,major);if(major===17)return null;
 return graphqlArchiveParts(toc,checkedGraphqlSnapshot(graphqlSnapshot)).diagnostic;
}

export function checkedGpsCloneArchive({major,graphqlSnapshot,toc}){
 checkedMatchingPgMajor(major,major);
 if(major===17)return null;
 checkedGraphqlSnapshot(graphqlSnapshot);
 return splitPgGraphqlAclToc(toc,graphqlSnapshot);
}

// Both clone creation and same-clone baseline restoration use this exact PG15
// sequence. Callbacks own their checked local connection and private archive.
export async function restoreGpsCloneArchive({major,graphqlSnapshot,readToc,restoreArchive,targetQuery}){
 checkedMatchingPgMajor(major,major);
 if(major===17){await restoreArchive(null);return;}
 const source=checkedGraphqlSnapshot(graphqlSnapshot),lists=checkedGpsCloneArchive({major,graphqlSnapshot:source,toc:await readToc()});
 await restoreArchive(lists.main);
 if(await targetQuery(`select to_regprocedure('${graphqlWrapper}') is null;`)!=='t')
  throw Error('GPS CI expected PostgreSQL15 GraphQL wrapper restore gap changed');
 await targetQuery(source.definition+'\n');
 const createdIdentity=await targetQuery(graphqlIdentitySql);
 if(await targetQuery(graphqlOwnerSql)!==source.owner)throw Error('GPS CI GraphQL wrapper owner mismatch');
 if(!/^[a-f0-9]{32}\|[a-f0-9]{32}$/.test(createdIdentity)||createdIdentity.split('|')[0]!==source.identity.split('|')[0]
  ||(lists.deferred===null&&createdIdentity!==source.identity))throw Error('GPS CI fresh GraphQL wrapper ACL differs from source');
 await targetQuery(`alter extension pg_graphql add function ${graphqlWrapper};`);
 if(lists.deferred!==null)await restoreArchive(lists.deferred);
 if(await targetQuery(graphqlExtensionSql)!=='pg_graphql'||await targetQuery(graphqlIdentitySql)!==source.identity
  ||await targetQuery(graphqlOwnerSql)!==source.owner)
  throw Error('GPS CI restored GraphQL wrapper definition or grants differ');
 if(lists.deferred===null){
  const initial=graphqlInitialFacts(await targetQuery(graphqlInitialSql));
  if(initial.owner!==source.owner||initial.initialAclCount!==source.initialAclCount||initial.initialAclHash!==source.initialAclHash)
   throw Error('GPS CI restored GraphQL initial privileges differ');
 }
}

export function postgresErrorCategory(stderr) {
  if (/server version mismatch|aborting because of server version mismatch/i.test(stderr)) return 'version-mismatch';
  if (/password authentication failed|SASL authentication failed/i.test(stderr)) return 'authentication-failed';
  if (/role .* does not exist/i.test(stderr)) return 'role-missing';
  if (/permission denied|must be owner|not permitted/i.test(stderr)) return 'permission-denied';
  if (/canceling statement due to lock timeout|deadlock detected/i.test(stderr)) return 'lock-contention';
  if (/no space left on device|out of memory|disk full/i.test(stderr)) return 'resource-exhausted';
  if (/connection refused|could not connect to server|connection timed out/i.test(stderr)) return 'connection-failed';
  if (/broken pipe|EPIPE/i.test(stderr)) return 'broken-pipe';
  if (/pg_restore: error:|ERROR:/i.test(stderr)) return 'restore-sql-error';
  if (/pg_dump: error:/i.test(stderr)) return 'dump-error';
  return 'unclassified';
}

function boundedStderr(child) {
  let tail = Buffer.alloc(0);
  child.stderr.on('data', (chunk) => {
    tail = Buffer.concat([tail, chunk]).subarray(-STDERR_LIMIT);
  });
  return () => postgresErrorCategory(tail.toString('utf8'));
}

function outcome(result) {
  if (!result) return 'pending';
  if (result.error) return `spawn-${result.error}`;
  return result.signal ?? String(result.code);
}

export async function runGpsClonePipeline({
  dumpCommand, dumpArgs, restoreCommand, restoreArgs, env,
  timeoutMs = 8 * 60_000, killAfterMs = 10_000,
  spawnProcess = spawn,
}) {
  const startedAt = Date.now();
  const dump = spawnProcess(dumpCommand, dumpArgs, {
    env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const restore = spawnProcess(restoreCommand, restoreArgs, {
    env, stdio: ['pipe', 'ignore', 'pipe'],
  });
  const dumpCategory = boundedStderr(dump);
  const restoreCategory = boundedStderr(restore);
  const results = {dump: null, restore: null};
  let firstFailure = null;
  let timedOut = false;
  let hardKillTimer;
  let timeout;

  function stop(child) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  }
  function stopBoth() {
    dump.stdout.unpipe(restore.stdin);
    stop(dump);
    stop(restore);
    hardKillTimer ??= setTimeout(() => {
      if (dump.exitCode === null && dump.signalCode === null) dump.kill('SIGKILL');
      if (restore.exitCode === null && restore.signalCode === null) restore.kill('SIGKILL');
    }, killAfterMs);
  }

  dump.stdout.pipe(restore.stdin);
  restore.stdin.on('error', () => {}); // Peer may close before the producer.

  const completion = new Promise((resolve) => {
    function record(name, result) {
      if (results[name]) return;
      results[name] = result;
      if (!timedOut && (result.error || result.code !== 0) && !firstFailure) {
        firstFailure = name;
        stopBoth();
      }
      if (results.dump && results.restore) resolve();
    }
    for (const [name, child] of [['dump', dump], ['restore', restore]]) {
      child.once('error', (error) => record(name, {error: error.code ?? 'unknown'}));
      child.once('close', (code, signal) => record(name, {code, signal}));
    }
  });

  timeout = setTimeout(() => {
    timedOut = true;
    stopBoth();
  }, timeoutMs);
  try {
    await completion;
  } finally {
    clearTimeout(timeout);
    clearTimeout(hardKillTimer);
  }

  if (timedOut || firstFailure) {
    const stage = timedOut ? 'timeout' : firstFailure;
    const elapsedMs = Date.now() - startedAt;
    const categories = `dump=${dumpCategory()},restore=${restoreCategory()}`;
    throw new Error(`GPS clone ${stage} after ${elapsedMs}ms; exits dump=${outcome(results.dump)},restore=${outcome(results.restore)}; categories ${categories}`);
  }
}
