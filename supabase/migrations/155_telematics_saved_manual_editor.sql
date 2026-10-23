-- FEAT-GPS-001. Return the saved manual point only in the existing, owner-scoped
-- private Fleet projection. No public/private-recipient projection is changed.
begin;
do $saved_manual_editor$
declare definition text;before_fragment text:=$before$'selectedAt',coalesce(s.selected_at,'1970-01-01'::timestamptz)),$before$;
after_fragment text:=$after$'selectedAt',coalesce(s.selected_at,'1970-01-01'::timestamptz),
   'manualPoint',case when s.source='MANUAL' then jsonb_build_object('latitude',s.manual_latitude,'longitude',s.manual_longitude) else null end),$after$;
begin
 select pg_get_functiondef('public.telematics_workspace(uuid,integer)'::regprocedure) into definition;
 if strpos(definition,after_fragment)>0 then return;end if;
 if strpos(definition,before_fragment)=0 or
  (length(definition)-length(replace(definition,before_fragment,'')))/length(before_fragment)<>1
  then raise exception 'TELEMATICS_WORKSPACE_EDITOR_ANCHOR_DRIFT';end if;
 execute replace(definition,before_fragment,after_fragment);
end $saved_manual_editor$;
commit;
