-- Private low-rating review with terminal administrator moderation.

alter table public.business_reviews
  add column if not exists status text not null default 'PUBLISHED',
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists review_note text,
  add column if not exists reviewed_at timestamptz;

update public.business_reviews
set status='PUBLISHED'
where status is null or btrim(status)='';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='business_reviews_status_check'
  ) then
    alter table public.business_reviews
      add constraint business_reviews_status_check
      check(status in ('PENDING','PUBLISHED','DISMISSED'));
  end if;
end $$;

create index if not exists business_reviews_status_created_idx
  on public.business_reviews(status,created_at desc);

drop policy if exists "completed participant reviews read" on public.business_reviews;
drop policy if exists "participant review insert" on public.business_reviews;

create policy "published reviewer or admin reviews read"
on public.business_reviews for select using (
  status='PUBLISHED'
  or public.is_org_member(reviewer_organization_id)
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN')
);

create policy "participant review insert"
on public.business_reviews for insert with check (
  created_by=auth.uid()
  and reviewer_organization_id in (
    select organization_id from public.organization_members where user_id=auth.uid()
  )
  and (
    (rating between 4 and 5 and status='PUBLISHED')
    or (rating between 1 and 3 and status='PENDING' and length(btrim(coalesce(note,'')))>0)
  )
  and reviewed_by is null
  and review_note is null
  and reviewed_at is null
  and exists (
    select 1 from public.shipments s
    where s.id=shipment_id
      and s.operational_status='COMPLETED'
      and reviewer_organization_id in (s.shipper_organization_id,s.receiver_organization_id)
      and subject_organization_id in (s.shipper_organization_id,s.receiver_organization_id)
  )
);

create policy "admin reviews pending rating"
on public.business_reviews for update using (
  status='PENDING'
  and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN')
) with check (
  status in ('PUBLISHED','DISMISSED')
  and reviewed_by=auth.uid()
  and reviewed_at is not null
  and length(btrim(coalesce(review_note,'')))>0
  and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='ADMIN')
);
