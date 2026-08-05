-- Progressive Entry: only vendor_id is required to create a draft invoice
-- row; everything else gets filled in over several days as documents
-- arrive. NULL now means "not entered yet" (distinct from a real 0).
alter table public.ap_invoices
  alter column invoice_date   drop not null,
  alter column invoice_number drop not null,
  alter column dpp_amount     drop not null,
  alter column dpp_amount     drop default,
  alter column ppn_amount     drop not null,
  alter column ppn_amount     drop default,
  alter column pph_amount     drop not null,
  alter column pph_amount     drop default,
  alter column total_amount   drop not null,
  alter column total_amount   drop default;
