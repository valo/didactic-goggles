# Zero Loans Frontend

Next.js + MUI dApp for creating RFQs, signing lender offers, and opening loans against BTC-like collateral using the `RFQRouter`/`LoanVault` contracts.

## Prerequisites
- Node 20+
- pnpm (project uses pnpm; do not use npm/yarn)

## Config
Set environment variables (e.g. in `.env.local`):
```
NEXT_PUBLIC_CHAIN_ID=<target chain id>
NEXT_PUBLIC_RPC_URL=<rpc url>
NEXT_PUBLIC_ROUTER_ADDRESS=<rfq router address>
DATABASE_URL=<postgres connection string>
NEXT_PUBLIC_ASSETS=[{"symbol":"WBTC","debtToken":"...","collateralToken":"...","oracleAdapter":"..."}]
NEXT_PUBLIC_DEBT_TOKENS=[{"symbol":"USDC","address":"..."}]
```
You can copy `.env.example` to `.env` for local development and adjust values.

## Install
```
pnpm install
```

## Run dev server
```
pnpm dev
```
Open http://localhost:3000

## Build
```
pnpm build
pnpm start
```

## Database migrations
- SQL migrations live in `migrations/`.
- Apply pending migrations: `pnpm db:migrate`
- Show status: `pnpm db:migrate:status`
- Uses `DATABASE_URL` to connect to Postgres.

## Docker
- Build image:
  ```
  docker build -t zero-loans-frontend .
  ```
- Run locally (example):
  ```
  docker run --rm -p 3000:3000 \
    -e NEXT_PUBLIC_CHAIN_ID=... \
    -e NEXT_PUBLIC_RPC_URL=... \
    -e NEXT_PUBLIC_ROUTER_ADDRESS=... \
    -e DATABASE_URL=postgresql://zero:zero@localhost:5432/zero_loans \
    zero-loans-frontend
  ```
- Local Postgres for development:
  ```
  docker compose up -d
  ```
  This starts `postgres:16-alpine` with credentials `zero/zero`, database `zero_loans`, exposed on `5432`.

## Lint / Typecheck
```
pnpm exec tsc --noEmit
pnpm lint   # note: Next lint CLI may require running from repo root
```

## Notes
- Uses wagmi/viem with injected wallet connector; ensure your wallet is on `NEXT_PUBLIC_CHAIN_ID`.
- UI flows and data handling are defined in `docs/SPEC.md`.
- Server API routes:
  - `POST /api/rfqs` — upsert RFQ records. Body fields: `rfqId, borrower, debtToken, collateralToken, principal, repaymentAmount, minCollateralAmount, expiry, callStrike, putStrike, oracleAdapter, oracleData, refiData, metadata?`.
  - `POST /api/rfqs/:rfqId/quotes` — create a quote for an RFQ. Body fields: `lender, debtToken, collateralToken, principal, repaymentAmount, minCollateralAmount, expiry, callStrike, putStrike, oracleAdapter, oracleDataHash, refiConfigHash, deadline, nonce, signature`.
  - Both endpoints expect a Postgres instance reachable via `DATABASE_URL` and use simple parameterized inserts with minimal validation. Tables `rfqs` and `quotes` must exist with matching columns.
