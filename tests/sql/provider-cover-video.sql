-- Local tagged demo accounts only. Every change in this exercise rolls back.
begin;
do $test$
declare own record; staff uuid; previous_page jsonb; checked_roles integer:=0; saved uuid;
begin
 for own in
   with owners as (
     select m.user_id,c.organization_id,c.provider_profile_id from company_pages c
       join organization_members m on m.organization_id=c.organization_id and m.membership_role='OWNER'
       where c.published
     union all
     select p.user_id,c.organization_id,c.provider_profile_id from company_pages c
       join provider_profiles p on p.id=c.provider_profile_id where c.published
   )
   select distinct on (o.organization_id is null) o.* from owners o
     join auth.users u on u.id=o.user_id and u.raw_app_meta_data->>'fixture_source'='loadgistic'
     join profiles pr on pr.id=o.user_id and pr.active
     cross join lateral provider_profile_actor_scope(o.user_id) scope
     where scope.workspace_access and not scope.is_company_driver
 loop
   checked_roles:=checked_roles+1;
   previous_page:=provider_profile_workspace(own.user_id);
   saved:=update_provider_profile_page(own.user_id,'{"cover_video_id":"WZMVTHGhlbg"}');
   if saved is distinct from (previous_page->>'id')::uuid or
      public_provider_page_details(own.organization_id,own.provider_profile_id)->>'cover_video_id' is distinct from 'WZMVTHGhlbg'
      then raise exception 'Cover save or public read failed'; end if;
   begin perform update_provider_profile_page(own.user_id,'{"cover_video_id":"invalid"}');
     raise exception 'Invalid video accepted';
   exception when others then if sqlerrm<>'INVALID_COVER_VIDEO' then raise; end if; end;
   perform update_provider_profile_page(own.user_id,'{"cover_video_id":null}');
   if (provider_profile_workspace(own.user_id)-'cover_video_id') is distinct from (previous_page-'cover_video_id')
      or public_provider_page_details(own.organization_id,own.provider_profile_id)->>'cover_video_id' is not null
      then raise exception 'Cover removal changed other profile fields or remained public'; end if;
 end loop;
 if checked_roles<>2 then raise exception 'Two local owner types required'; end if;
 select p.id into strict staff from profiles p join auth.users u on u.id=p.id
    where p.active and p.role='SUPPORT' and u.raw_app_meta_data->>'fixture_source'='loadgistic' limit 1;
 begin perform update_provider_profile_page(staff,'{"cover_video_id":"WZMVTHGhlbg"}');
    raise exception 'Staff unexpectedly changed provider cover';
 exception when others then if sqlerrm not in ('FORBIDDEN','SUBSCRIPTION_ACCESS_REQUIRED') then raise; end if; end;
end $test$;
rollback;
