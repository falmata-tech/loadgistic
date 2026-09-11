-- Account-free Assisted matching conversations, kept separate from authenticated member support.

create table if not exists public.guest_support_conversations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_digest text not null,
  phone text,
  assigned_agent_user_id uuid references public.profiles(id) on delete set null,
  status text not null check (status in ('WAITING','OPEN','CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  assigned_at timestamptz,
  guest_last_read_at timestamptz,
  agent_last_read_at timestamptz,
  closed_at timestamptz,
  closed_by_user_id uuid references public.profiles(id)
);
create unique index if not exists guest_support_email_open_idx
  on public.guest_support_conversations(email_digest) where status in ('WAITING','OPEN');
create index if not exists guest_support_queue_idx
  on public.guest_support_conversations(status,created_at,id);

create table if not exists public.guest_support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.guest_support_conversations(id) on delete cascade,
  sender_kind text not null check (sender_kind in ('GUEST','TEAM')),
  sender_user_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists guest_support_messages_idx
  on public.guest_support_messages(conversation_id,created_at desc,id desc);

create table if not exists public.guest_support_attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.guest_support_conversations(id) on delete cascade,
  message_id uuid not null references public.guest_support_messages(id) on delete cascade,
  file_path text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

create table if not exists public.guest_support_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.guest_support_conversations(id) on delete cascade,
  actor_user_id uuid references public.profiles(id),
  event_type text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table public.guest_support_conversations enable row level security;
alter table public.guest_support_messages enable row level security;
alter table public.guest_support_attachments enable row level security;
alter table public.guest_support_events enable row level security;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('support-attachment','support-attachment',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

comment on table public.guest_support_conversations is
  'Private Assisted matching conversations. No browser-direct policy; all access passes through signed guest sessions or assigned support authorization.';
