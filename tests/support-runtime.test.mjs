import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const supportRoutes=[
  'src/app/app/support/page.tsx','src/app/support/page.tsx','src/app/support/[id]/page.tsx',
  'src/app/support/assisted/page.tsx','src/app/support/assisted/[id]/page.tsx','src/app/admin/support/page.tsx',
  'src/app/help/page.tsx','src/app/help/[id]/page.tsx','src/app/api/support/availability/route.ts',
  'src/app/api/support/conversations/route.ts','src/app/api/support/conversations/[id]/claim/route.ts',
  'src/app/api/support/conversations/[id]/close/route.ts','src/app/api/support/conversations/[id]/messages/route.ts',
  'src/app/api/guest-support/route.ts','src/app/api/guest-support/current/route.ts','src/app/api/guest-support/access/route.ts',
  'src/app/api/guest-support/[id]/messages/route.ts','src/app/api/guest-support/[id]/claim/route.ts',
  'src/app/api/guest-support/[id]/close/route.ts','src/app/api/guest-support/[id]/end/route.ts',
  'src/app/api/guest-support/[id]/attachments/[attachmentId]/route.ts',
  'src/app/api/admin/support-agents/route.ts','src/app/api/admin/support-agents/[id]/route.ts'
];

test('active Support and Assisted matching routes use the managed Support port',()=>{
  for(const path of supportRoutes){
    const source=read(path);assert.doesNotMatch(source,/lib\/repository\.js/,path);assert.match(source,/lib\/support\.js/,path);
  }
});

test('managed Support commands are bounded, actor scoped, terminal, and service-role-only',()=>{
  const sql=read('supabase/migrations/054_managed_support_runtime.sql');
  assert.match(sql,/greatest\(1,least\(50,/i);
  assert.match(sql,/support_actor_can_read\(actor\.id,conversation_id\)/);
  assert.match(sql,/SUPPORT_CONVERSATION_CLOSED/);
  assert.match(sql,/for update[^;]+skip locked/is);
  assert.match(sql,/requested_email_digest/);
  assert.match(sql,/managed_guest_support_attachment_file/);
  assert.match(sql,/revoke all on function public\.managed_guest_support_conversation[^;]+from public,anon,authenticated/i);
  assert.match(sql,/grant execute on function public\.managed_guest_support_conversation[^;]+to service_role/i);
  assert.doesNotMatch(sql,/grant execute[^;]+to authenticated/i);
});

test('private guest uploads are cleaned on failed metadata commands and never projected by queue reads',()=>{
  const adapter=read('src/lib/support/supabase.js');const sql=read('supabase/migrations/054_managed_support_runtime.sql');
  assert.match(adapter,/removePrivateUpload\(stored\.path\)\.catch/);
  assert.match(adapter,/managed_guest_support_attachment_file/);
  const inbox=sql.slice(sql.indexOf('create or replace function public.managed_guest_support_inbox'),sql.indexOf('create or replace function public.send_managed_guest_support_message'));
  assert.doesNotMatch(inbox,/file_path|storage_path/);
});

test('platform team provisioning has no password and promotes only an inactive unowned Auth placeholder',()=>{
  const page=read('src/app/admin/support/page.tsx');const route=read('src/app/api/admin/support-agents/route.ts');
  const adapter=read('src/lib/support/supabase.js');const fix=read('supabase/migrations/055_support_identity_bootstrap.sql');
  assert.doesNotMatch(page,/name="password"|type="password"/);
  assert.doesNotMatch(route,/password\s*:/);
  assert.match(adapter,/auth\.admin\.createUser\(\{\s*email:command\.email,email_confirm:true/);
  assert.doesNotMatch(adapter,/createUser\([^)]*password/s);
  assert.match(fix,/profile\.active or exists\(select 1 from public\.organization_members/);
  assert.match(fix,/on conflict\(id\) do update/);
});

test('shared platform permission scope covers every documented responsibility',()=>{
  const sql=read('supabase/migrations/056_managed_platform_permission_scope.sql');
  for(const permission of ['CUSTOMERS','OPERATIONS','TRUST','BILLING','SUPPORT'])assert.match(sql,new RegExp(`when '${permission}'`));
  assert.match(sql,/profile\.role='ADMIN'/);
  assert.match(sql,/revoke all[^;]+from public,anon,authenticated/is);
});
