-- Native, text-only customer support with least-loaded assignment.

alter type public.user_role add value if not exists 'SUPPORT';

create table if not exists public.support_agent_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  active boolean not null default true,
  available boolean not null default true,
  max_open_conversations integer not null default 3 check(max_open_conversations between 1 and 20),
  last_assigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_agent_user_id uuid references public.profiles(id) on delete set null,
  category text not null check(category in ('ACCOUNT','PAYMENT','VERIFICATION','LOAD_TRACKING','CAPACITY','OTHER')),
  status text not null default 'WAITING' check(status in ('WAITING','OPEN','CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  assigned_at timestamptz,
  customer_last_read_at timestamptz,
  agent_last_read_at timestamptz,
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  check(
    (status='WAITING' and assigned_agent_user_id is null)
    or (status='OPEN' and assigned_agent_user_id is not null)
    or status='CLOSED'
  )
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.support_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists support_one_open_per_customer_idx
  on public.support_conversations(customer_user_id)
  where status in ('WAITING','OPEN');
create index if not exists support_queue_idx
  on public.support_conversations(status,last_message_at desc,id);
create index if not exists support_agent_open_idx
  on public.support_conversations(assigned_agent_user_id,status,last_message_at desc);
create index if not exists support_customer_history_idx
  on public.support_conversations(customer_user_id,updated_at desc);
create index if not exists support_messages_recent_idx
  on public.support_messages(conversation_id,created_at desc,id);
create index if not exists support_events_conversation_idx
  on public.support_events(conversation_id,created_at,id);

alter table public.support_agent_profiles enable row level security;
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_events enable row level security;

create policy "support agents read own profile"
  on public.support_agent_profiles for select
  using (
    user_id=auth.uid()
    or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text='ADMIN')
  );

create policy "support administrators manage profiles"
  on public.support_agent_profiles for all
  using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text='ADMIN'))
  with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text='ADMIN'));

create policy "support participants read conversations"
  on public.support_conversations for select
  using (
    customer_user_id=auth.uid()
    or assigned_agent_user_id=auth.uid()
    or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text='ADMIN')
  );

create policy "members start support conversations"
  on public.support_conversations for insert
  with check (
    customer_user_id=auth.uid()
    and assigned_agent_user_id is null
    and status='WAITING'
    and exists(
      select 1 from public.profiles p
      where p.id=auth.uid() and p.active=true
        and p.role::text in ('SHIPPER','RECEIVER','TRANSPORTER','DRIVER')
    )
  );

create policy "support participants read messages"
  on public.support_messages for select
  using (
    exists(
      select 1 from public.support_conversations c
      where c.id=conversation_id and (
        c.customer_user_id=auth.uid()
        or c.assigned_agent_user_id=auth.uid()
        or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text='ADMIN')
      )
    )
  );

create policy "support participants send messages"
  on public.support_messages for insert
  with check (
    sender_user_id=auth.uid()
    and exists(
      select 1 from public.support_conversations c
      where c.id=conversation_id and c.status<>'CLOSED'
        and (c.customer_user_id=auth.uid() or c.assigned_agent_user_id=auth.uid())
    )
  );

create policy "support administrators read events"
  on public.support_events for select
  using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text='ADMIN'));

-- Assignment, claiming, closing, rate limiting, and agent availability remain
-- server-side transactional operations. The browser never receives service keys.
