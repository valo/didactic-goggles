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
```

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

## Lint / Typecheck
```
pnpm exec tsc --noEmit
pnpm lint   # note: Next lint CLI may require running from repo root
```

## Notes
- Uses wagmi/viem with injected wallet connector; ensure your wallet is on `NEXT_PUBLIC_CHAIN_ID`.
- UI flows and data handling are defined in `docs/SPEC.md`.
