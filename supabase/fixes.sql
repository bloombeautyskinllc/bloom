-- One-off fix (2026-09-29): a local job-worker address was written to the hosted project by
-- mistake. Remove it only if it points to this machine; configure the real one after deploying.
delete from vault.secrets
where name in ('bloom_app_url', 'bloom_jobs_secret')
  and exists (
    select 1 from vault.decrypted_secrets
    where name = 'bloom_app_url' and decrypted_secret ~ '(host\.docker\.internal|localhost|127\.0\.0\.1)'
  );
