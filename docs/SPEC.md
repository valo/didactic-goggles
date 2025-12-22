# Zero Loans Frontend (Next.js) — Product Spec

## Overview

This dApp lets borrowers publish RFQs and lenders respond with signed offers that open zero-cost collateralized loans using the on-chain `RFQRouter`/`LoanVault` contracts. A backend stores RFQs/offers and enforces anti-spam balance checks before persisting them.

Personas:
- **Borrowers:** draft and sign RFQs; later open loans with lender offers.
- **Lenders:** browse valid RFQs, set call prices, sign offers, and optionally fund.

## Scope
- Wallet connect / chain awareness (single chain).
- Borrower RFQ creation with required signature, default 1h expiry, backend persistence, and collateral balance check.
- Lender offer flow: list valid RFQs, set call price, sign offers, backend debt balance check.
- Helpers: fee preview, hash previews, validation, token allowance helpers.
- Persistence via backend DB; optional local caches. JSON import/export removed.

Out of scope: on-chain indexing, analytics, off-chain order books, auto-matching, new settlement logic.

## Configuration
- `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_ROUTER_ADDRESS`.
- `NEXT_PUBLIC_ASSETS`: JSON array of { symbol, debtToken, collateralToken, oracleAdapter }.
- `NEXT_PUBLIC_DEBT_TOKENS`: JSON array of allowed debt tokens { symbol, address } (e.g., USDC, USDT).
- `NEXT_PUBLIC_API_BASE`: backend base URL for RFQ/offer CRUD/listing.
- Optional: explorer base URL, token metadata overrides.

## Key Data Shapes
- **RFQ Request (borrower-signed, server-stored):**
  - `borrower`, `debtToken`, `collateralToken` (from allowed lists).
  - `principal`, `repaymentAmount` (= principal, 0% APR), `minCollateralAmount`.
  - `expiry` = now + 1 hour by default (minimum); may allow longer presets.
  - `callStrike`: omitted (set by lender).
  - `oracleAdapter`: from collateral config; `oracleData`: hex; `refiData`: hex/empty.
  - `metadata`: label/notes; `rfqId`; `oracleDataHash`; `refiConfigHash`.
  - `rfqSignature`: borrower EIP-712 signature over the RFQ payload (without callStrike).
  - Server checks before saving: valid signature, expiry in future (>=1h), borrower collateral balance >= `minCollateralAmount`.
- **LoanQuote (lender-signed offer):**
  - Fields per `RFQRouter.LoanQuote`; both `callStrike` and `putStrike` set by lender (put must be lower than call).
  - `signature`: EIP-712 per router domain.
  - Server checks before saving/displaying: valid signature, not expired, lender debt balance covers `principal` (+fee).
- **Loan Execution Payload:** `{ quote, signature, collateralAmount, oracleData, refiData }` with `collateralAmount >= quote.minCollateralAmount`.

## Contract Interactions
- Reads: `previewFee`, `computeOracleDataHash`, `computeRefiConfigHash`, `getQuoteDigest` (optional).
- Writes:
  - Borrower: `approve` collateral, `openLoan(quote, collateralAmount, oracleData, refiData, signature)`.
  - Lender helper: `approve` debt token for router (principal + underwriting fee).
- Refinance eligibility is only in play when the settlement price ends up between `putStrike` and `callStrike`; if the oracle price is above `callStrike`, no refi is allowed and the lender receives the residual collateral to cover the call payoff.

## Global UX Rules
- Show connected chain/router; block actions on wrong chain.
- Validate: non-zero addresses/amounts; expiry/deadline future; repayment == principal; collateralAmount >= min; oracle/refi hashes match; signatures valid.
- Call price set only by lender.
- Always show underwriting fee preview.
- No JSON import/export; rely on backend listings and local cache.

## Flows

### 1) Connect Wallet
- Support injected wallets; display chain/account; allow “Switch network”.

### 2) Borrower — Create RFQ
- Form for debt token, collateral, principal, min collateral, maturity preset (default 1h), oracle/refi data; callStrike hidden (set by lender).
- Auto-fill borrower, repayment=principal, oracle adapter from config.
- On submit: validate inputs; borrower signs RFQ; app checks collateral balance >= minCollateralAmount; send to backend to store (returns rfqId). Cache locally for quick recall.

### 3) Lender — Browse & Sign Offer
- Fetch table of valid RFQs from backend (non-expired, signed, balance-checked).
- Select RFQ; set `callStrike` and `putStrike` (put strictly lower than call); enter `deadline`/`nonce`; optionally edit principal/repayment if RFQ allows editable terms.
- Show fee preview; verify hashes; sign offer (EIP-712). Backend validates lender debt balance before storing/displaying offer. Optionally trigger debt token approval.

### 4) Borrower — Open Loan
- Select offer for own RFQ (from backend/cache). Verify signature client-side.
- Enter collateralAmount (>= min). Check allowances; offer approve flow.
- Preflight: expiry/deadline future, hashes match, correct chain/router.
- Call `openLoan`; show pending/mined; display vault address; cache receipt.

## Validation & Error Handling
- Friendly errors for RPC/revert/signature failures.
- Prevent double submits with loading states.
- No silent coercion of financial inputs.

## Persistence
- Backend DB: RFQs (borrower-signed, collateral-checked) and offers (lender-signed, debt-checked).
- Local cache: recent RFQs/offers/receipts for convenience. JSON import/export removed.

## Lender Safety / Spam Mitigation
- RFQs require borrower signature and collateral balance check before storage.
- Backend prunes expired RFQs and rejects invalid hashes/amounts.
- Lenders see only validated RFQs; offers require lender debt balance check before persistence.
- UI remains spec-driven; no auto-sign or auto-approve; chain/router always visible.

## Non-Goals / Restrictions
- No auto price fetching beyond provided oracleData.
- No background polling of external APIs beyond backend fetches.
- No auto-matching or batch settlement controls.
