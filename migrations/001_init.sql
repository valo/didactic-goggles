create table if not exists rfqs (
  rfq_id text primary key,
  borrower text not null,
  debt_token text not null,
  collateral_token text not null,
  principal text not null,
  repayment_amount text not null,
  min_collateral_amount text not null,
  expiry text not null,
  call_strike text not null,
  put_strike text not null,
  oracle_adapter text not null,
  oracle_data text,
  refi_data text,
  metadata jsonb,
  oracle_data_hash text,
  refi_config_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quotes (
  id serial primary key,
  rfq_id text not null references rfqs(rfq_id) on delete cascade,
  lender text not null,
  debt_token text not null,
  collateral_token text not null,
  principal text not null,
  repayment_amount text not null,
  min_collateral_amount text not null,
  expiry text not null,
  call_strike text not null,
  put_strike text not null,
  oracle_adapter text not null,
  oracle_data_hash text not null,
  refi_config_hash text not null,
  oracle_data text,
  refi_data text,
  deadline text not null,
  nonce text not null,
  signature text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_quotes_rfq_id on quotes(rfq_id);
