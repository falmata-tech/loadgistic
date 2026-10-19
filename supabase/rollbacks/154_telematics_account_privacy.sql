-- Pending cleanup receipts and privacy shutdown must not be undone by rollback.
-- Use a separately reviewed forward repair; retain job/audit state and backups.
do $$begin raise exception 'TELEMATICS_PRIVACY_FORWARD_REPAIR_REQUIRED';end$$;
