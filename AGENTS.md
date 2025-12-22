## 🔒 Core Guidelines for Frontend Agents

Agents building the Next.js dApp MUST follow these principles.

### 1. Specification-driven delivery
- `docs/SPEC.md` is the single source of truth for UX, flows, and supported interactions.
- Do not invent protocol behavior or extra features; if something is unclear, add a TODO requesting clarification instead of guessing.

### 2. Wallet and security hygiene
- Never handle private keys or seed phrases; rely on audited wallet connectors only.
- Do not persist secrets (RPC keys, signatures, addresses) beyond what the app needs to function.
- Validate all user inputs before signing or sending transactions; block obviously bad data (expired quotes, empty addresses, malformed hex).
- Guard against XSS/CSRF by avoiding `dangerouslySetInnerHTML` and untrusted rendering; keep dependencies minimal and pinned.

### 3. Protocol correctness
- Preserve on-chain semantics: use the exact EIP-712 domain/type data defined in the contracts when building or verifying quotes.
- Respect contract validation rules (expiry/deadline checks, min collateral, nonce uniqueness hints) in UI copy and client-side checks.
- Do not mutate the meaning of RFQ/offer/loan terms; surface contract errors clearly instead of changing inputs silently.

### 4. Testing expectations
- Add meaningful tests (unit or integration) for critical formatting/parsing (quote hashing, calldata construction) and transaction flows.
- Prefer deterministic fixtures over live RPC calls; mock providers where possible.

### 5. UX clarity and safety
- Keep flows explicit: show network/chain, token addresses, fee previews, and required approvals before sending a transaction.
- Fail gracefully with actionable messages; never leave users unsure whether a transaction was sent.

### 6. Operational constraints
- Keep the app deterministic at build time (no required runtime fetches from untrusted origins).
- Avoid adding analytics/telemetry or external calls unless explicitly requested.

### 7. UI toolkit
- Use Material UI components for UI (https://mui.com/material-ui/llms.txt). Prefer existing MUI patterns over custom styling except where the spec demands bespoke layouts.

### 8. Tooling
- Use `pnpm` for all package management commands (install, add, remove). Do not use npm or yarn.
- After any code changes, run: `pnpm build`, `pnpm exec tsc --noEmit`, and `pnpm lint` (resolve lint path issues if Next.js CLI complains). Do not skip these checks before handing off work.

### 🚫 Agents MUST NOT
- Store or display private keys, or auto-send transactions without explicit user confirmation.
- Alter contract ABIs or addresses without SPEC approval.
- Add hidden protocol changes (auto-rollovers, extra settlement logic, implicit slippage handling).

### 📍 Final reminder

The agent’s job in `frontend/` is to **implement the documented dApp flows safely and faithfully to `docs/SPEC.md` and the on-chain contracts**, not to redesign the product or protocol.
