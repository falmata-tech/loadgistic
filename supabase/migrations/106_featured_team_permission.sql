-- FEAT-FTR-001: separate, default-off Featured team responsibility.
alter table public.support_agent_profiles add column can_manage_featured boolean not null default false;
create function public.can_manage_featured(actor_user_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.profiles p left join public.support_agent_profiles a on a.user_id=p.id
 where p.id=actor_user_id and p.active and (p.role='ADMIN' or (p.role='SUPPORT' and a.active and a.can_manage_featured)))
$$;
create function public.lock_featured_actor(actor_user_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor public.profiles%rowtype;agent public.support_agent_profiles%rowtype;
begin
 select * into actor from public.profiles where id=actor_user_id for share;
 if not found or not actor.active then raise exception 'FORBIDDEN';end if;
 if actor.role='ADMIN' then return;end if;
 select * into agent from public.support_agent_profiles where user_id=actor_user_id for share;
 if actor.role<>'SUPPORT' or not found or not agent.active or not agent.can_manage_featured then raise exception 'FORBIDDEN';end if;
end $$;

-- Exact, asserted replacements retain existing command validation, audit and ACLs.
do $patch$
declare definition text;before_text text;after_text text;signature text;
begin
 for signature,before_text,after_text in select * from (values
 ('public.current_user_projection()','''can_manage_brokerage'',coalesce(support_agent.can_manage_brokerage,false),','''can_manage_brokerage'',coalesce(support_agent.can_manage_brokerage,false),''can_manage_featured'',coalesce(support_agent.can_manage_featured,false),'),
 ('public.managed_support_agent_page(uuid,integer,integer)','''can_manage_brokerage'',row.can_manage_brokerage,','''can_manage_brokerage'',row.can_manage_brokerage,''can_manage_featured'',row.can_manage_featured,'),
 ('public.create_managed_support_agent(uuid,uuid,jsonb)','can_manage_brokerage,created_at,updated_at)','can_manage_brokerage,can_manage_featured,created_at,updated_at)'),
 ('public.create_managed_support_agent(uuid,uuid,jsonb)','coalesce((command->>''can_manage_brokerage'')::boolean,false),now(),now());','coalesce((command->>''can_manage_brokerage'')::boolean,false),coalesce((command->>''can_manage_featured'')::boolean,false),now(),now());'),
 ('public.update_managed_support_agent(uuid,uuid,jsonb)','can_manage_brokerage=coalesce((command->>''can_manage_brokerage'')::boolean,false),updated_at=now()','can_manage_brokerage=coalesce((command->>''can_manage_brokerage'')::boolean,false),can_manage_featured=coalesce((command->>''can_manage_featured'')::boolean,false),updated_at=now()'),
 ('public.create_managed_support_agent(uuid,uuid,jsonb)','''brokerage'',coalesce((command->>''can_manage_brokerage'')::boolean,false))),now());','''brokerage'',coalesce((command->>''can_manage_brokerage'')::boolean,false),''featured'',coalesce((command->>''can_manage_featured'')::boolean,false))),now());'),
 ('public.update_managed_support_agent(uuid,uuid,jsonb)','''brokerage'',coalesce((command->>''can_manage_brokerage'')::boolean,false)),now());','''brokerage'',coalesce((command->>''can_manage_brokerage'')::boolean,false),''featured'',coalesce((command->>''can_manage_featured'')::boolean,false)),now());'),
 ('public.managed_admin_featured_day(uuid,date,text,text[])','exists(select 1 from public.profiles profile where profile.id=actor_user_id and profile.active and profile.role::text=''ADMIN'')','public.can_manage_featured(actor_user_id)'),
 ('public.managed_featured_overview(uuid)','exists(select 1 from public.profiles where id=actor_user_id and active and role=''ADMIN'')','public.can_manage_featured(actor_user_id)'),
 ('public.managed_featured_overview(uuid)','pair->>''driver_user_id''=s.driver_user_id::text)','pair->>''driver_user_id''=s.driver_user_id::text and (theme->''configurations'') ? (pair->>''configuration''))'),
 ('public.save_managed_featured_truck_day(uuid,jsonb)','if not exists(select 1 from public.profiles profile where profile.id=actor_user_id and profile.active and profile.role::text=''ADMIN'') then raise exception ''FORBIDDEN''; end if;','perform public.lock_featured_actor(actor_user_id);'),
 ('public.save_managed_sponsorship(uuid,jsonb)','if not exists(select 1 from public.profiles profile where profile.id=actor_user_id and profile.active and profile.role::text=''ADMIN'') then raise exception ''FORBIDDEN''; end if;','perform public.lock_featured_actor(actor_user_id);'),
 ('public.disable_managed_sponsorship(uuid,uuid)','if not exists(select 1 from public.profiles profile where profile.id=actor_user_id and profile.active and profile.role::text=''ADMIN'') then raise exception ''FORBIDDEN''; end if;','perform public.lock_featured_actor(actor_user_id);')
 ) patches(signature,before_text,after_text) loop
   definition:=pg_get_functiondef(signature::regprocedure);
   if strpos(definition,before_text)=0 or strpos(substr(definition,strpos(definition,before_text)+length(before_text)),before_text)>0 then
     raise exception 'FEATURED_PERMISSION_PATCH_PRECONDITION: %',signature;
   end if;
   execute replace(definition,before_text,after_text);
 end loop;
end $patch$;

-- Dedicated settings projection and command never expose or change access/billing controls.
create function public.managed_featured_controls(actor_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.can_manage_featured(actor_user_id) then raise exception 'FORBIDDEN';end if;
 return (select jsonb_build_object('featured_mode',featured_mode,'featured_target_count',featured_target_count) from public.platform_controls where singleton);
end $$;
create function public.save_managed_featured_controls(actor_user_id uuid,command jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare mode_value text:=command->>'mode';count_value integer;
begin
 perform public.lock_featured_actor(actor_user_id);
 if command->>'section' is distinct from 'FEATURED' then raise exception 'FORBIDDEN';end if;
 begin count_value:=(command->>'target_count')::integer;exception when others then raise exception 'INVALID_PLATFORM_CONTROLS';end;
 if mode_value is null or mode_value not in ('AUTO','MANUAL') or count_value is null or count_value not between 1 and 12 then raise exception 'INVALID_PLATFORM_CONTROLS';end if;
 update public.platform_controls set featured_mode=mode_value,featured_target_count=count_value,updated_at=now(),updated_by=actor_user_id where singleton;
 insert into public.audit_logs(actor_user_id,action,entity_type,details)
 values(actor_user_id,'FEATURED_CONTROLS_UPDATED','platform_controls',jsonb_build_object('mode',mode_value,'targetCount',count_value));
 return public.managed_featured_controls(actor_user_id);
end $$;
create function public.prepare_managed_featured_days(actor_user_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 perform public.lock_featured_actor(actor_user_id);
 result:=public.generate_managed_featured_days();
 insert into public.audit_logs(actor_user_id,action,entity_type,details)
 values(actor_user_id,'FEATURED_PREPARE_REQUESTED','platform_controls',jsonb_build_object('ok',result->'ok','busy',coalesce(result->'busy','false'::jsonb)));
 return result;
end $$;
revoke all on function public.can_manage_featured(uuid),public.lock_featured_actor(uuid),public.managed_featured_controls(uuid),public.save_managed_featured_controls(uuid,jsonb),public.prepare_managed_featured_days(uuid) from public,anon,authenticated;
grant execute on function public.can_manage_featured(uuid),public.lock_featured_actor(uuid),public.managed_featured_controls(uuid),public.save_managed_featured_controls(uuid,jsonb),public.prepare_managed_featured_days(uuid) to service_role;
