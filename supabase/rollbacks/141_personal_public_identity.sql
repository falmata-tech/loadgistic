-- Pre-use recovery only. An old public-serving version is not a privacy-safe
-- fallback: keep the 141 projections or disable personal public serving/editing.
-- Saved identity/contact changes require forward repair, never data deletion.
begin;
select pg_advisory_xact_lock(8030141);
set local timezone='UTC';
lock table public.profiles,public.provider_signup_intents,public.drivers,public.company_pages in share row exclusive mode;
do $guard$
declare backup record;receipt jsonb;signature text;name text;before_definition text;baseline_fingerprint text;backup_count integer:=0;
begin
 select encode(extensions.digest(jsonb_build_object(
  'profiles',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from profiles p),
  'intents',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from provider_signup_intents p),
  'drivers',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from drivers p),
  'pages',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from company_pages p)
 )::text,'sha256'),'hex') into baseline_fingerprint;
 for backup in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and right(p.proname,16)='_pre_identity141' loop
  backup_count:=backup_count+1;receipt:=obj_description(backup.oid,'pg_proc')::jsonb;signature:=receipt->>'original_signature';name:=split_part(split_part(signature,'(',1),'.',2);
  if receipt->>'migration' is distinct from '141' or receipt->>'baseline_identity_sha256' is distinct from baseline_fingerprint then raise exception 'PERSONAL_IDENTITY_ROLLBACK_CHANGED_FORWARD_REPAIR_REQUIRED';end if;
  if md5(pg_get_functiondef(signature::regprocedure)) is distinct from receipt->>'after_md5'
   or(select proowner::regrole::text from pg_proc where oid=signature::regprocedure) is distinct from receipt->>'owner'
   or(select coalesce(proacl::text,'') from pg_proc where oid=signature::regprocedure) is distinct from receipt->>'acl' then raise exception 'PERSONAL_IDENTITY_INSTALLED_DRIFT';end if;
  before_definition:=replace(pg_get_functiondef(backup.oid),'CREATE OR REPLACE FUNCTION public.'||name||'_pre_identity141(','CREATE OR REPLACE FUNCTION public.'||name||'(');
  if md5(before_definition) is distinct from receipt->>'before_md5' then raise exception 'PERSONAL_IDENTITY_BACKUP_DRIFT';end if;
  if has_function_privilege('anon',backup.oid,'EXECUTE') or has_function_privilege('authenticated',backup.oid,'EXECUTE') or has_function_privilege('service_role',backup.oid,'EXECUTE') then raise exception 'PERSONAL_IDENTITY_BACKUP_ACL_DRIFT';end if;
 end loop;
 if backup_count<>21 then raise exception 'PERSONAL_IDENTITY_BACKUP_COUNT_DRIFT';end if;
 foreach signature in array array['public.normalize_personal_name(text)','public.public_person_first_name(uuid)','public.public_person_callback_phone(uuid)',
 'public.public_person_portrait_url(uuid)','public.public_person_identities(uuid[])','public.prepare_provider_signup_identity(text,jsonb,timestamptz)'] loop
  receipt:=obj_description(signature::regprocedure,'pg_proc')::jsonb;
  if receipt->>'migration' is distinct from '141' or md5(pg_get_functiondef(signature::regprocedure)) is distinct from receipt->>'after_md5'
   or(select proowner::regrole::text from pg_proc where oid=signature::regprocedure) is distinct from receipt->>'owner'
   or(select coalesce(proacl::text,'') from pg_proc where oid=signature::regprocedure) is distinct from receipt->>'acl' then raise exception 'PERSONAL_IDENTITY_HELPER_DRIFT';end if;
 end loop;
end $guard$;
do $restore$
declare backup record;signature text;name text;
begin
 for backup in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and right(p.proname,16)='_pre_identity141' order by p.proname loop
  signature:=obj_description(backup.oid,'pg_proc')::jsonb->>'original_signature';name:=split_part(split_part(signature,'(',1),'.',2);
  execute replace(pg_get_functiondef(backup.oid),'CREATE OR REPLACE FUNCTION public.'||name||'_pre_identity141(','CREATE OR REPLACE FUNCTION public.'||name||'(');
 end loop;
end $restore$;
drop function public.prepare_provider_signup_identity(text,jsonb,timestamptz),public.public_person_identities(uuid[]),public.public_person_portrait_url(uuid),
 public.public_person_callback_phone(uuid),public.public_person_first_name(uuid),public.normalize_personal_name(text);
alter table public.provider_signup_intents drop column first_name,drop column last_name,drop column public_callback_phone,drop column public_callback_phone_configured;
alter table public.profiles drop column first_name,drop column last_name,drop column public_callback_phone,drop column public_callback_phone_configured;
notify pgrst,'reload schema';
commit;
