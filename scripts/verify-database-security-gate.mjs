// FEAT-SEC-001: inject unsafe ACLs only inside rolled-back local transactions.
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const gate=readFileSync(new URL('./check-database-security.sql',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/migrations/096_browser_relation_boundary.sql',import.meta.url),'utf8');
const cases=[
  ['table','grant select on public.profiles to authenticated;','APPLICATION_BROWSER_PRIVILEGES_FORBIDDEN'],
  ['column','grant update(full_name) on public.profiles to authenticated;','APPLICATION_BROWSER_PRIVILEGES_FORBIDDEN'],
  ['public column','grant select(full_name) on public.profiles to public;','APPLICATION_BROWSER_PRIVILEGES_FORBIDDEN'],
  ['view','create view public.security_boundary_view as select id from public.profiles; grant select on public.security_boundary_view to anon;','APPLICATION_BROWSER_PRIVILEGES_FORBIDDEN'],
  ['sequence','create sequence public.security_boundary_sequence; grant usage on sequence public.security_boundary_sequence to authenticated;','APPLICATION_BROWSER_PRIVILEGES_FORBIDDEN'],
  ['definer','grant execute on function public.is_org_member(uuid) to authenticated;','APPLICATION_BROWSER_DEFINER_FORBIDDEN'],
  ['anonymous identity','grant execute on function public.current_user_projection() to anon;','APPLICATION_BROWSER_DEFINER_FORBIDDEN'],
  ['RLS','create table public.security_boundary_table(id bigint);','PUBLIC_RLS_REQUIRED']
];
function check(sql){
  // Fixed isolated container and database: no remote URL, credential or CLI override.
  const result=spawnSync('docker',['exec','-i','supabase_db_loadgistic-local',
    'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{
    input:`begin; set local lock_timeout='5s'; set local statement_timeout='30s';\n${sql}\nrollback;\n`,
    encoding:'utf8',timeout:45000,maxBuffer:1024*1024
  });
  if(result.error||result.signal||result.status===null)throw new Error('LOCAL_SECURITY_GATE_RUN_FAILED');
  return result;
}
const baseline=check(gate);
if(baseline.status!==0)throw new Error('LOCAL_SECURITY_GATE_BASELINE_FAILED');
for(const [name,sql,expected] of cases){
  const result=check(`${sql}\n${gate}`);
  if(result.status===0||!result.stderr.includes(expected))throw new Error(`SECURITY_GATE_REGRESSION:${name}`);
  console.log(`Security gate rejects ${name}.`);
}
const repaired=check(`grant select(full_name) on public.profiles to public;
grant update(full_name) on public.profiles to authenticated;\n${migration}\n${gate}`);
if(repaired.status!==0)throw new Error('COLUMN_REPAIR_OR_REPEATABILITY_FAILED');
console.log('Explicit column repair and repeatable migration passed; all fixture changes rolled back.');
