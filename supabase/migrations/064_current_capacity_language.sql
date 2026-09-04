-- Keep already-created managed programme copy aligned with the current public
-- application language without replacing administrator-authored introductions.
update public.featured_provider_days
set public_introduction=replace(public_introduction,'Truck Market','Open capacity'),
    updated_at=now()
where public_introduction like '%Truck Market%';
