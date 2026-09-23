-- FEAT-SEC-001: actual PostgreSQL role boundaries, no retained writes.
begin;
set local role anon;
do $$ begin
  begin perform 1 from public.spatial_ref_sys limit 0; raise exception 'ANON_READ_ALLOWED'; exception when insufficient_privilege then null; end;
  begin insert into public.spatial_ref_sys(srid) values(990999); raise exception 'ANON_INSERT_ALLOWED'; exception when insufficient_privilege then null; end;
  begin update public.spatial_ref_sys set auth_name=auth_name where false; raise exception 'ANON_UPDATE_ALLOWED'; exception when insufficient_privilege then null; end;
  begin delete from public.spatial_ref_sys where false; raise exception 'ANON_DELETE_ALLOWED'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
  begin perform 1 from public.spatial_ref_sys limit 0; raise exception 'AUTH_READ_ALLOWED'; exception when insufficient_privilege then null; end;
  begin insert into public.spatial_ref_sys(srid) values(990999); raise exception 'AUTH_INSERT_ALLOWED'; exception when insufficient_privilege then null; end;
  begin update public.spatial_ref_sys set auth_name=auth_name where false; raise exception 'AUTH_UPDATE_ALLOWED'; exception when insufficient_privilege then null; end;
  begin delete from public.spatial_ref_sys where false; raise exception 'AUTH_DELETE_ALLOWED'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ begin
  if not exists(select 1 from public.spatial_ref_sys where srid=4326) then raise exception 'SERVICE_REFERENCE_READ_FAILED'; end if;
  if st_srid(st_transform(st_setsrid(st_makepoint(38.76,9.03),4326),3857))<>3857 then raise exception 'SERVICE_SPATIAL_TRANSFORM_FAILED'; end if;
end $$;
reset role;
rollback;
