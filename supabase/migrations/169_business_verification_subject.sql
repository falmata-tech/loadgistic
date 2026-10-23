-- FEAT-ENT/VER-001. Commit the additive enum before170 uses the new value.
alter type public.verification_subject_type add value if not exists 'BUSINESS_WORKSPACE';
