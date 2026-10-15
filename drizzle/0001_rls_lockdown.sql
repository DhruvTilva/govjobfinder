-- Supabase exposes the public schema through its REST API (PostgREST) to the
-- anon/authenticated roles. GovJobFinder never uses that API: the app and the
-- pipeline connect with a server-side connection string. Enabling RLS without
-- policies makes every table unreadable/unwritable through the public API
-- while the table owner (our connection) is unaffected.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['states','sectors','qualifications','organizations','sources','discoveries','notices','notice_qualifications','notice_revisions','pipeline_runs','pipeline_events','pipeline_requests','admin_users','admin_sessions','rate_limits','audit_log','exams']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
