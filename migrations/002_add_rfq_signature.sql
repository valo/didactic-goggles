alter table rfqs
  add column if not exists borrower_signature text;

create index if not exists idx_rfqs_borrower_expiry on rfqs (borrower, expiry);
