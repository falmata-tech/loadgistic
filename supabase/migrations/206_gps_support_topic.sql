-- FEAT-SUP-001 / FEAT-GPS-001: first-class GPS setup requests.
-- Preserve existing conversations, support assignment, and browser-role denial.
do $guard$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.support_conversations'::regclass
      and conname='support_conversations_category_check'
      and pg_get_constraintdef(oid) like '%LOAD_TRACKING%'
  ) then raise exception 'GPS_SUPPORT_CATEGORY_PRECONDITION'; end if;
end $guard$;

alter table public.support_conversations
  drop constraint support_conversations_category_check;
alter table public.support_conversations
  add constraint support_conversations_category_check
  check (category in ('ACCOUNT','PAYMENT','VERIFICATION','LOAD_TRACKING','CAPACITY','GPS_SETUP','OTHER'));

do $patch$
declare definition text;
  before_text text := '(''ACCOUNT'',''PAYMENT'',''VERIFICATION'',''LOAD_TRACKING'',''CAPACITY'',''OTHER'')';
  after_text text := '(''ACCOUNT'',''PAYMENT'',''VERIFICATION'',''LOAD_TRACKING'',''CAPACITY'',''GPS_SETUP'',''OTHER'')';
begin
  definition:=pg_get_functiondef('public.create_managed_support_conversation(uuid,jsonb)'::regprocedure);
  if strpos(definition,before_text)=0
    or strpos(substr(definition,strpos(definition,before_text)+length(before_text)),before_text)>0
  then raise exception 'GPS_SUPPORT_COMMAND_PRECONDITION'; end if;
  execute replace(definition,before_text,after_text);
end $patch$;
