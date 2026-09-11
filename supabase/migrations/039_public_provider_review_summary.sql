-- Server-only public reputation aggregate for transporter microsites.
-- The application receives only the published count and average, never review-party data.

create or replace function public.public_provider_review_summary(
  requested_organization_id uuid default null,
  requested_provider_profile_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'review_count',count(*)::integer,
    'average_rating',case when count(*)=0 then null else round(avg(review.rating),1) end
  )
  from public.provider_reviews review
  where review.status='PUBLISHED'
    and (
      (requested_organization_id is not null and requested_provider_profile_id is null
        and review.provider_organization_id=requested_organization_id)
      or
      (requested_provider_profile_id is not null and requested_organization_id is null
        and review.provider_profile_id=requested_provider_profile_id)
    )
$$;

revoke all on function public.public_provider_review_summary(uuid,uuid) from public,anon,authenticated;
grant execute on function public.public_provider_review_summary(uuid,uuid) to service_role;
