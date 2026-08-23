-- FEAT-PRV-001 / BASE-DEP-001: private transporter identity media.
-- The application stores opaque provider-profile references and serves bytes
-- only through its authorized projection. Keep direct browser access denied.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'provider-profile',
  'provider-profile',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;
