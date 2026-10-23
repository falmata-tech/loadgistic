-- FEAT-ENT/PRV-001 / NR-54. Keep retained former-member rows renderable without PII.
begin;
select pg_advisory_xact_lock(8030164);
do $directory_retention$
declare definition text;before_text text;after_text text;
begin
 definition:=pg_get_functiondef('public.business_workspace_directory(uuid,uuid)'::regprocedure);
 for before_text,after_text in values
 ($before$'firstName',coalesce(nullif(p.first_name,''),split_part(p.full_name,' ',1))$before$,
  $after$'firstName',case when u.deleted_at is not null then 'Former team member' else coalesce(nullif(p.first_name,''),split_part(p.full_name,' ',1)) end$after$),
 ($before$||case when manager then jsonb_build_object('email',u.email) else '{}'::jsonb end$before$,
  $after$||case when u.deleted_at is not null then jsonb_build_object('erased',true) else '{}'::jsonb end
   ||case when manager and u.deleted_at is null and nullif(trim(u.email),'') is not null then jsonb_build_object('email',u.email) else '{}'::jsonb end$after$)
 loop
  if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'BUSINESS_DIRECTORY_RETENTION_DRIFT'; end if;
  definition:=replace(definition,before_text,after_text);
 end loop;
 execute definition;
end $directory_retention$;
notify pgrst,'reload schema';
commit;
