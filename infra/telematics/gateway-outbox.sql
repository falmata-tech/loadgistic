-- Install only after pinned Traccar has initialized its dedicated database.
-- No Traccar business row is updated. Each committed decoded position creates
-- its outbox row in the same transaction, including command-result positions.
begin;
create schema if not exists loadgistic_bridge;
create table if not exists loadgistic_bridge.outbox(
 id bigint generated always as identity primary key,source_id bigint not null unique,
 payload jsonb not null,created_at timestamptz not null default clock_timestamp(),
 lease_id uuid,lease_until timestamptz,attempts integer not null default 0,
 next_attempt_at timestamptz not null default clock_timestamp(),delivered_at timestamptz,denial_code text,
 check(octet_length(payload::text)<=16384)
);
create index if not exists outbox_ready_idx on loadgistic_bridge.outbox(next_attempt_at,id) where delivered_at is null;
create table if not exists loadgistic_bridge.dispatches(
 command_id uuid primary key,lease_id uuid not null,gateway_device_id bigint not null,
 expires_at timestamptz not null,created_at timestamptz not null default clock_timestamp(),
 state text not null check(state in('CLAIMED','DISPATCHED','UNKNOWN','FAILED','ACKNOWLEDGED'))
);
create or replace function loadgistic_bridge.position_outbox()
returns trigger language plpgsql security definer set search_path=public,loadgistic_bridge,pg_temp as $$
declare row_value jsonb:=to_jsonb(new);attributes_value jsonb;identifier text;
begin
 attributes_value:=coalesce(nullif(row_value->>'attributes',''),'{}')::jsonb;
 select uniqueid into identifier from public.tc_devices where id=(row_value->>'deviceid')::bigint;
 insert into loadgistic_bridge.outbox(source_id,payload) values((row_value->>'id')::bigint,
  jsonb_build_object('id',(row_value->>'id')::bigint,'deviceId',(row_value->>'deviceid')::bigint,'uniqueId',identifier,
   'protocol',row_value->>'protocol','fixTime',row_value->>'fixtime','serverTime',row_value->>'servertime',
   'valid',(row_value->>'valid')::boolean,'latitude',(row_value->>'latitude')::double precision,
   'longitude',(row_value->>'longitude')::double precision,'speed',(row_value->>'speed')::double precision,
   'course',(row_value->>'course')::double precision,'attributes',jsonb_strip_nulls(jsonb_build_object(
    'ignition',attributes_value->'ignition','batteryLevel',attributes_value->'batteryLevel','power',attributes_value->'power',
    'alarm',attributes_value->'alarm','result',case when length(attributes_value->>'result')<=200 then attributes_value->'result' end))));
 return new;
end $$;
drop trigger if exists loadgistic_position_outbox on public.tc_positions;
create trigger loadgistic_position_outbox after insert on public.tc_positions for each row execute function loadgistic_bridge.position_outbox();
revoke all on schema loadgistic_bridge from public;
revoke all on all tables in schema loadgistic_bridge from public;
revoke all on function loadgistic_bridge.position_outbox() from public;
grant usage on schema loadgistic_bridge to loadgistic_bridge;
grant select,update,delete on loadgistic_bridge.outbox to loadgistic_bridge;
grant select,insert,update,delete on loadgistic_bridge.dispatches to loadgistic_bridge;
commit;
