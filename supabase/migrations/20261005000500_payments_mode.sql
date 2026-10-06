-- =============================================================================
-- Square test / live mode, switched from the back office. Both credential sets live in the
-- server environment (SQUARE_SANDBOX_* and SQUARE_PRODUCTION_*); this setting picks the one used
-- for new checkout links. Each link keeps the environment it was created in, so payments and
-- refunds made in test mode are still reconciled with the sandbox after switching to live.
-- =============================================================================

alter table public.business_settings
  add column payments_mode text not null default 'sandbox'
    check (payments_mode in ('sandbox', 'production'));

-- Links so far were test payments
alter table public.payment_links
  add column environment text not null default 'sandbox'
    check (environment in ('sandbox', 'production'));

alter table public.payment_links alter column environment drop default;
