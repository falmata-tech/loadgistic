-- FEAT-ENT-001 / FEAT-NOT-001. Customer alerts follow actual current membership.
begin;
select pg_advisory_xact_lock(8030165);
do $business_support_alerts$
declare definition text;before_text text:=$before$member_actor:=actor.role in ('DRIVER','TRANSPORTER');$before$;
 after_text text:=$after$member_actor:=actor.role in ('DRIVER','TRANSPORTER') or exists(
   select 1 from public.business_workspace_members business_member
   where business_member.user_id=actor_user_id
    and public.business_workspace_permission(actor_user_id,business_member.workspace_id,'ACCESS'));
$after$;
begin
 definition:=pg_get_functiondef('public.chat_alert_snapshot(uuid,uuid,text)'::regprocedure);
 if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then raise exception 'BUSINESS_SUPPORT_ALERTS_DRIFT'; end if;
 execute replace(definition,before_text,after_text);
end $business_support_alerts$;
notify pgrst,'reload schema';
commit;
