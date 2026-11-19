-- Existing dated placements own the illustration, just as they own position.
begin;
alter table public.sponsor_placements add column artwork_key text
  check (artwork_key in ('machining', 'motors'));

-- Preserve the installed permission lock, eligibility, overlap checks and audit.
do $migration$
declare
  definition text := pg_get_functiondef('public.save_managed_sponsorship(uuid,jsonb)'::regprocedure);
  anchor text := '  return placement_record_id;';
begin
  if strpos(definition, anchor) = 0 then raise exception 'Unexpected sponsor save definition'; end if;
  execute replace(definition, anchor, $body$
  if command ? 'artwork_key' then
    update public.sponsor_placements
       set artwork_key = case when kind = 'ADVERTISER' then nullif(command->>'artwork_key','') end
     where id = placement_record_id;
  end if;
$body$ || anchor);
end;
$migration$;
commit;
