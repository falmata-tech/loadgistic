-- Stop new consumers first. This removes only the private editor projection;
-- saved manual coordinates, source, privacy, assignments and history survive.
begin;
do $saved_manual_editor_rollback$
declare definition text;before_fragment text:=$before$'selectedAt',coalesce(s.selected_at,'1970-01-01'::timestamptz)),$before$;
after_fragment text:=$after$'selectedAt',coalesce(s.selected_at,'1970-01-01'::timestamptz),
   'manualPoint',case when s.source='MANUAL' then jsonb_build_object('latitude',s.manual_latitude,'longitude',s.manual_longitude) else null end),$after$;
begin
 select pg_get_functiondef('public.telematics_workspace(uuid,integer)'::regprocedure) into definition;
 if strpos(definition,before_fragment)>0 then return;end if;
 if strpos(definition,after_fragment)=0 or
  (length(definition)-length(replace(definition,after_fragment,'')))/length(after_fragment)<>1
  then raise exception 'TELEMATICS_WORKSPACE_EDITOR_ANCHOR_DRIFT';end if;
 execute replace(definition,after_fragment,before_fragment);
end $saved_manual_editor_rollback$;
commit;
