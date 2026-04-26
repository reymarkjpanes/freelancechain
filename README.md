# FreelanceChain — Trustless Escrow on Stellar Soroban

A hackathon demo of a **peer-to-peer freelance escrow** built on [Stellar Soroban](https://developers.stellar.org/docs/build/smart-contracts/overview).  
A Client locks XLM into a smart contract; when they approve the Freelancer's work, payment releases automatically — no middleman, no trust required.

---

## Architecture

```
Next.js 15 (App Router)
  ├─ /api/create-job      ← Ops account signs create_job (server-side)
  ├─ /api/build-xdr       ← Builds unsigned XDR for user-signed actions
  ├─ /api/submit-tx       ← Submits signed XDR to Stellar RPC
  └─ /api/get-job         ← Reads on-chain job state (view call)

Soroban Smart Contract (Rust)
  ├─ initialize(admin, fee_bps)
  ├─ create_job(job_id, client, freelancer, amount, token)
  ├─ fund_job(job_id, caller, amount)            ← client signs
  ├─ submit_milestone(job_id, milestone, caller) ← freelancer signs
  ├─ approve_milestone(job_id, milestone, caller)← client signs → pays out
  └─ get_job(job_id)                             ← read-only
```

### XDR Signing Flow (fund / submit / approve)
```
1. User clicks action
2. GET /api/build-xdr  → returns unsigned XDR
3. Freighter wallet signs XDR locally
4. POST /api/submit-tx → submits to Stellar testnet
5. UI polls for confirmation + shows tx hash
```

---

## Project Structure

```
freelancechain/
├─ contracts/
│   └─ freelance_escrow/
│       ├─ src/
│       │   ├─ lib.rs       ← Contract logic
│       │   └─ test.rs      ← 11 test cases
│       ├─ Cargo.toml
│       └─ Makefile
├─ frontend/
│   ├─ app/
│   │   ├─ page.tsx
│   │   ├─ layout.tsx
│   │   ├─ globals.css
│   │   ├─ components/
│   │   │   ├─ WalletConnect.tsx
│   │   │   ├─ JobForm.tsx
│   │   │   ├─ EscrowFlow.tsx
│   │   │   └─ TxStatus.tsx
│   │   └─ api/
│   │       ├─ create-job/route.ts
│   │       ├─ build-xdr/route.ts
│   │       ├─ submit-tx/route.ts
│   │       └─ get-job/route.ts
│   ├─ package.json
│   ├─ next.config.ts
│   └─ .env.local.example
└─ Cargo.toml              ← Workspace root
```

---

## Phase 1 — Deploy the Contract

### Prerequisites
- [Rust](https://rustup.rs/) + `wasm32v1-none` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli)

```bash
# Install wasm target
rustup target add wasm32v1-none

# Generate and fund an ops account on testnet
stellar keys generate ops --network testnet
stellar keys fund ops --network testnet
```

### Build & Test
```bash
cd contracts/freelance_escrow
cargo test          # All tests must pass
make build          # Produces .wasm in target/
```

### Deploy
```bash
# Deploy contract
make deploy SECRET=$(stellar keys show ops --network testnet)

# Note the CONTRACT_ID printed, then initialize:
make init \
  CONTRACT=<CONTRACT_ID> \
  ADMIN=$(stellar keys address ops) \
  SECRET=$(stellar keys show ops --network testnet)

# Verify
make verify CONTRACT=<CONTRACT_ID>
# → should return 250 (the fee in basis points)
```

---

## Phase 2 — Run the Frontend

### Prerequisites
- Node.js 20+
- [Freighter wallet](https://www.freighter.app/) browser extension, set to **Testnet**

### Setup
```bash
cd frontend
npm install

cp .env.local.example .env.local
# Edit .env.local and fill in:
#   ESCROW_CONTRACT_ADDRESS  ← from deploy step above
#   OPS_ACCOUNT_PUBLIC_KEY   ← stellar keys address ops
#   OPS_ACCOUNT_SECRET_KEY   ← stellar keys show ops --network testnet
```

### Run
```bash
npm run dev
# → http://localhost:3000
```

---

## Demo Flow

Run two browser windows — one acting as **Client**, one as **Freelancer**.

| Step | Who | Action |
|------|-----|--------|
| 1 | Both | Connect Freighter wallet (Testnet) |
| 2 | Client | Fill in freelancer address + XLM amount → Create Job |
| 3 | Client | Click "Fund Escrow" → sign in Freighter → XLM locked on-chain |
| 4 | Freelancer | Click "Submit Work" → sign in Freighter → milestone marked Submitted |
| 5 | Client | Click "Approve & Release" → sign → payment auto-transfers to freelancer |

All confirmed transactions link to [Stellar Expert testnet explorer](https://stellar.expert/explorer/testnet).

---

## Contract Properties

| Property | Description |
|----------|-------------|
| **Conservation of funds** | `net_to_freelancer + platform_fee == funded_amount` always |
| **Fee snapshot** | Fee rate is locked at `create_job` — changing global fee doesn't affect live jobs |
| **Authorization** | Each action requires the correct party's wallet signature (`require_auth()`) |
| **No panics** | All functions return `Result<T, ContractError>` |
| **Events** | Every state change emits an on-chain event |

---

## Security Notes

- `OPS_ACCOUNT_SECRET_KEY` lives only in `.env.local` (server-side). It is **never** exposed to the browser bundle.
- The Freighter wallet signs XDR locally — private keys never leave the user's device.
- Never commit `.env.local` to git (it's in `.gitignore`).

---

## Built With

- [Soroban SDK](https://crates.io/crates/soroban-sdk)
- [Next.js 15](https://nextjs.org/)
- [@creit-tech/stellar-wallets-kit](https://github.com/Creit-Tech/Stellar-Wallets-Kit)
- [@stellar/stellar-sdk](https://github.com/stellar/js-stellar-sdk)
- [Tailwind CSS](https://tailwindcss.com/)
