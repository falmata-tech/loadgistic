-- FEAT-FTR-001: reviewed function rollback only; retain both histories and days.
-- First set Featured to Manual through its authorized settings command. Do not
-- re-enable the legacy AUTO rule without reviewing/reconciling post-137 turns.
-- No roster, credential, RLS, grant or history restoration is performed here.
begin;
select pg_advisory_xact_lock(8030180);
do $rollback$
declare definition text;original_name text;backup_name text;
begin
  if not exists(select 1 from public.platform_controls where singleton and featured_mode='MANUAL') then
    raise exception 'FEATURED_ROLLBACK_REQUIRES_MANUAL';
  end if;
  for original_name,backup_name in values
    ('generate_managed_featured_days_core()','generate_managed_featured_days_global_legacy()'),
    ('managed_featured_overview(actor_user_id uuid)','managed_featured_overview_global_legacy(actor_user_id uuid)')
  loop
    definition:=pg_get_functiondef(to_regprocedure('public.'||replace(backup_name,'actor_user_id ','')));
    if definition is null or strpos(definition,'CREATE OR REPLACE FUNCTION public.'||backup_name)<>1 then
      raise exception 'FEATURED_ROTATION_ROLLBACK_CONTRACT';
    end if;
    execute replace(definition,'CREATE OR REPLACE FUNCTION public.'||backup_name,
      'CREATE OR REPLACE FUNCTION public.'||original_name);
  end loop;
end $rollback$;
revoke all on function public.generate_managed_featured_days_core(),public.generate_managed_featured_days_for_date(date),
  public.featured_truck_primary_theme(text),public.generate_managed_featured_days_global_legacy(),public.managed_featured_overview_global_legacy(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.managed_featured_overview(uuid) from public,anon,authenticated;
grant execute on function public.managed_featured_overview(uuid) to service_role;
commit;
