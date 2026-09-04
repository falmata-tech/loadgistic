-- FEAT-IAM-001 / BASE-SEC-001
-- Profile role and activation are authorization authority. Browser sessions may
-- read their projection, but mutations must pass through managed server RPCs.

drop policy if exists "profiles own update" on public.profiles;
revoke insert,update,delete,truncate,references,trigger on table public.profiles from anon,authenticated;

comment on table public.profiles is
  'Managed identity authority. Browser roles may read authorized rows but cannot directly mutate role, activation, or profile facts.';
