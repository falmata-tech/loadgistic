import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync('supabase/migrations/160_customer_business_workspaces.sql','utf8');
test('customer foundation keeps RLS and service-only SQL ports separate from provider/global authority',()=>{
 for(const table of ['business_workspaces','business_workspace_members','business_workspace_invitations','business_workspace_selections','business_workspace_audit'])assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`));
 assert.match(sql,/revoke all on public\.business_workspaces,[\s\S]*from public,anon,authenticated,service_role;/);
 assert.match(sql,/public\.business_workspace_permission\(actor_user_id uuid,target_workspace_id uuid,required_permission text default 'ACCESS'\)/);
 assert.match(sql,/p\.role::text not in\('ADMIN','SUPPORT'\)/);assert.match(sql,/u\.email_confirmed_at is not null/);
 assert.match(sql,/m\.user_id=actor_user_id and m\.workspace_id=target_workspace_id and m\.active and w\.active/);
 assert.match(sql,/when 'CAPACITY' then m\.can_view_capacity when 'TRACKING' then m\.can_view_tracking/);
 assert.doesNotMatch(sql,/insert into public\.(organization_members|provider_profiles|support_agent_profiles)/);
 assert.match(sql,/managed_provider_signup_eligible\(actor_user_id\)/);
});
test('software Support and customer-first provider signup require membership rather than dormant global role',()=>{
 const support=sql.slice(sql.indexOf('create or replace function public.support_member_actor'),sql.indexOf('create or replace function public.accept_content_policy'));
 assert.match(support,/business_workspace_permission\(p\.id,m\.workspace_id,'ACCESS'\)/);assert.doesNotMatch(support,/in\('SHIPPER','RECEIVER'/);
 const eligible=sql.slice(sql.indexOf('create function public.business_provider_signup_eligible'),sql.indexOf('create or replace function public.managed_provider_signup_eligible'));
 for(const table of ['applications','provider_profiles','organization_members','drivers','driver_permissions','driver_vehicle_assignments','support_agent_profiles'])assert.match(eligible,new RegExp(`not exists\\(select 1 from public\\.${table}`));
 assert.match(eligible,/m\.user_id=p\.id and m\.active and w\.active/);assert.match(sql,/business_workspace_claim_invitation_email/);assert.match(sql,/email_lease_until>now\(\)/);assert.match(sql,/email_sent_at>now\(\)-interval '1 minute'/);
});
test('invitation and lifecycle boundaries preserve fresh email authority, one-time acceptance and scope',()=>{
 assert.match(sql,/expires_at<=now\(\)/);assert.match(sql,/verified_email is distinct from invitation\.email/);
 assert.match(sql,/Recheck the exact verified email after acquiring its row lock/);
 assert.match(sql,/status='ACCEPTED',accepted_by=actor_user_id/);assert.match(sql,/business\.version\+1/);
 assert.match(sql,/BUSINESS_OWNER_HANDOVER_REQUIRED/);assert.match(sql,/create trigger business_account_delete_guard before delete/);
 assert.match(sql,/business_workspace_permission\(invitation\.created_by,invitation\.workspace_id/);
 assert.match(sql,/business_workspace_permission\(actor_user_id,s\.workspace_id,'ACCESS'\)/);
 assert.match(sql,/delete from public\.business_workspace_selections selection/);
 assert.match(sql,/where w\.active and \(strpos\(lower\(w\.name\),needle\)>0/);
 assert.doesNotMatch(sql,/grant execute[\s\S]*to (anon|authenticated)/);
});
