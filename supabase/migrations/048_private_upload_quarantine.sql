-- BASE-DEP-001 / FEAT-GST-001 / FEAT-TRK-001
-- Untrusted uploads enter this server-only private bucket before a clean
-- scanner verdict permits copying into a purpose-specific private bucket.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'private-upload-quarantine',
  'private-upload-quarantine',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;
