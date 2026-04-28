# FreelanceChain

[![CI](https://github.com/reymarkjpanes/freelancechain/actions/workflows/ci.yml/badge.svg)](https://github.com/reymarkjpanes/freelancechain/actions/workflows/ci.yml)
[![Deploy](https://github.com/reymarkjpanes/freelancechain/actions/workflows/deploy.yml/badge.svg)](https://github.com/reymarkjpanes/freelancechain/actions/workflows/deploy.yml)

Peer-to-peer freelance escrow payments on Stellar, built with Soroban smart contracts.

> 🚀 **Live App:** [https://frontend-nu-pearl-3s0nq0wsv5.vercel.app](https://frontend-nu-pearl-3s0nq0wsv5.vercel.app)

---

## App Preview

![FreelanceChain — Dark glassmorphism UI with escrow workflow](images/app-ui-preview.png)

*Landing page showing the Connect Wallet, Create Job, and Load Existing Job sections on the Stellar Testnet.*

---

## Mobile Responsive Design

The UI is fully responsive and adapts gracefully to mobile viewports:

![FreelanceChain — Mobile responsive view on iPhone](images/mobile-responsive-view.png)

*Mobile view (375×812) — cards stack vertically, typography scales, and all interactive elements remain accessible on small screens.*

---

## CI/CD Pipeline

Automated CI/CD runs on every push and pull request via **GitHub Actions**:

| Workflow | Trigger | What it does |
|---|---|---|
| **CI** (`ci.yml`) | Push / PR to `main`, `master`, `develop` | Builds Soroban contract, runs tests, checks formatting, lints + builds Next.js frontend |
| **Deploy** (`deploy.yml`) | Push to `main` (frontend changes) | Deploys frontend to Vercel (requires `VERCEL_TOKEN` secret) |

![CI/CD pipeline — GitHub Actions passing](images/ci-cd-pipeline.png)

*GitHub Actions dashboard showing the CI pipeline passing (green ✅) after iterative fixes.*

---

## Problem

A Filipino freelancer doing graphic design for an overseas client has no guarantee of payment after delivering work. The client either pays upfront and risks getting ghosted, or the freelancer works for free hoping they'll be paid. Neither party has leverage.

## Solution

FreelanceChain locks XLM into a Soroban smart contract the moment a job is created. The freelancer submits work, the client approves — and payment releases automatically on-chain. No middleman, no delays, no trust required. Just cryptographic certainty.

---

## Demo Flow

1. **Connect Wallet** — Click "Connect Wallet" → Freighter extension connects on Testnet
2. **Create Job** — Enter freelancer's Stellar address, XLM amount, and job description → Click "+ Create Job" → Ops account registers job on-chain and returns a **Job ID**
3. **Load Existing Job** *(alternative to step 2)* — Enter a Job ID to resume an in-progress escrow
4. **Fund Escrow** *(Client)* — Client signs via Freighter → XLM locked in smart contract
5. **Submit Work** *(Freelancer)* — Freelancer signs → milestone marked as submitted
6. **Approve & Release** *(Client)* — Client approves → payment auto-releases to freelancer (minus 2.5% platform fee)

All confirmed transactions link to [Stellar Expert testnet explorer](https://stellar.expert/explorer/testnet).

### ⚠️ Important Usage Notes

- **Do not refresh the browser** during an active escrow flow. The app stores the current job session in memory — refreshing the page will clear it. If you accidentally refresh, use **Load Existing Job** with the saved Job ID to resume exactly where you left off.
- **Testing both roles (Client & Freelancer):** Since each escrow step requires a different wallet, you have two options:
  1. **Two browsers** — Open the app in Chrome (Client wallet) and Firefox/Edge (Freelancer wallet) side by side. Both can load the same Job ID.
  2. **Single browser** — Disconnect the current wallet, switch to the other account in Freighter, reconnect, and use **Load Existing Job** to pick up the flow from the other party's perspective.
- **After the other party acts**, use **Load Existing Job** with the same Job ID to see the updated on-chain status (e.g., after the client funds, the freelancer loads the job to see it's now "Funded").

---

## Architecture

```
Next.js 16 (App Router)
  ├─ /api/create-job       ← Ops account signs create_job (server-side)
  ├─ /api/build-xdr        ← Builds unsigned XDR for user-signed actions
  ├─ /api/submit-tx        ← Submits signed XDR to Stellar RPC
  └─ /api/get-job          ← Reads on-chain job state (view call)

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
1. User clicks action button in the UI
2. GET  /api/build-xdr  → server builds + simulates → returns unsigned XDR
3. Freighter wallet signs XDR locally (private key never leaves device)
4. POST /api/submit-tx  → submits signed XDR to Stellar testnet RPC
5. UI polls for confirmation → shows tx hash + explorer link
```

---

## Project Structure

```
freelancechain/
├─ contracts/
│   └─ freelance_escrow/
│       ├─ src/
│       │   ├─ lib.rs              # Soroban escrow contract (9 functions)
│       │   └─ test.rs             # 15 test cases
│       ├─ Cargo.toml
│       └─ Makefile
├─ frontend/
│   ├─ app/
│   │   ├─ page.tsx                # Main UI page
│   │   ├─ layout.tsx              # Root layout
│   │   ├─ globals.css             # Tailwind styles
│   │   ├─ components/
│   │   │   ├─ WalletConnect.tsx   # Freighter wallet integration
│   │   │   ├─ JobForm.tsx         # Job creation form
│   │   │   ├─ EscrowFlow.tsx      # Fund → Submit → Approve flow
│   │   │   └─ TxStatus.tsx        # Transaction status display
│   │   └─ api/
│   │       ├─ create-job/route.ts # Server-side job creation
│   │       ├─ build-xdr/route.ts  # XDR builder for wallet signing
│   │       ├─ submit-tx/route.ts  # Signed XDR submission
│   │       └─ get-job/route.ts    # On-chain state reader
│   ├─ package.json
│   ├─ next.config.ts
│   └─ .env.local.example
├─ Cargo.toml                     # Workspace root
├─ DEPLOY.md                      # Step-by-step deployment guide
└─ README.md
```

---

## Smart Contract

### Contract ID (Deployed on Stellar Testnet)

```
CB6EX6RFBNMGUZUHZOY5KA5I4PKMK4OLV4ICVDJ4SZP4GMHS44B4RBJD
```

| Explorer | Link |
|---|---|
| **Stellar Lab** | [View on Stellar Lab](https://lab.stellar.org/r/testnet/contract/CB6EX6RFBNMGUZUHZOY5KA5I4PKMK4OLV4ICVDJ4SZP4GMHS44B4RBJD) |
| **Stellar Expert** | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CB6EX6RFBNMGUZUHZOY5KA5I4PKMK4OLV4ICVDJ4SZP4GMHS44B4RBJD) |

#### Deployed Contract Screenshots

**Stellar Expert** — contract overview with transaction history:

![Deployed FreelanceChain contract on Stellar Expert](images/stellar-expert-contract.png)

**Stellar Lab** — contract explorer showing contract spec and storage:

![Deployed FreelanceChain contract on Stellar Lab](images/stellar-lab-contract.png)

### Previously Deployed (Prototype)

```
CBPXD4WLBHOQAX3YRI3Y55LE57ERDT57SLSBP32VFEQNL66PN7MAT26X
```

**Stellar Lab:** [View on Stellar Lab](https://lab.stellar.org/r/testnet/contract/CBPXD4WLBHOQAX3YRI3Y55LE57ERDT57SLSBP32VFEQNL66PN7MAT26X)

### Contract Functions

| Function | Caller | Description |
|---|---|---|
| `initialize(admin, fee_bps)` | Admin | One-time setup, sets platform fee |
| `create_job(job_id, client, freelancer, amount, token)` | Platform (ops) | Registers escrow job on-chain |
| `fund_job(job_id, caller, amount)` | Client | Locks XLM into the contract |
| `submit_milestone(job_id, milestone_id, caller)` | Freelancer | Marks milestone as submitted |
| `approve_milestone(job_id, milestone_id, caller)` | Client | Releases payment to freelancer |
| `get_job(job_id)` | Anyone | Read-only: returns full job state |
| `get_fee()` | Anyone | Read-only: returns current fee rate |
| `get_admin()` | Anyone | Read-only: returns admin address |
| `update_platform_fee(new_fee)` | Admin | Updates global fee (does not affect live jobs) |

### Escrow Status Lifecycle

```
Open ──────→ Funded ──────→ InProgress ──────→ Completed
(create_job)  (fund_job)   (submit_milestone)  (approve_milestone)
                                                 ├─ Net amount → Freelancer
                                                 └─ Platform fee → Admin
```

### Contract Properties

| Property | Description |
|---|---|
| **Conservation of funds** | `net_to_freelancer + platform_fee == funded_amount` always |
| **Fee snapshot** | Fee rate is locked at `create_job` — changing global fee doesn't affect live jobs |
| **Authorization** | Each action requires the correct party's wallet signature (`require_auth()`) |
| **No panics** | All functions return `Result<T, ContractError>` |
| **Events** | Every state change emits an on-chain event |

---

## Stellar Features Used

| Feature | Usage |
|---|---|
| Soroban smart contracts | Escrow logic — lock funds, milestone tracking, auto-release |
| XLM (native asset) | Payment settlement via SEP-41 token interface |
| `require_auth()` | Wallet-based authorization for every state-changing action |
| On-chain events | Audit trail for job creation, funding, submission, approval |
| Persistent storage | Per-job state keyed by `job_id` |

---

## Prerequisites

**For the smart contract:**
- [Rust](https://rustup.rs/) (latest stable) + `wasm32v1-none` target
- [Stellar CLI v25+](https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli)
- Stellar testnet account funded via Friendbot

**For the frontend:**
- Node.js 20+
- [Freighter wallet](https://www.freighter.app/) browser extension, set to **Testnet**
- Testnet XLM (for gas fees)

---

## Quick Start (Reviewers)

> **The contract is already deployed on testnet.** You do NOT need Rust or Stellar CLI to run the frontend. Just clone, configure, and run.

```bash
# 1. Clone the repo
git clone https://github.com/reymarkjpanes/freelancechain.git
cd freelancechain

# 2. Configure environment
cd frontend
cp .env.local.example .env.local
# The .env.local.example is pre-filled with the deployed contract ID
# and testnet ops account — ready to use out of the box.

# 3. Install and run
npm install --force
npm run dev
# → http://localhost:3000
```

**Requirements:** Node.js 20+ and the [Freighter wallet](https://www.freighter.app/) browser extension set to **Testnet**.

> **Note:** `npm install --force` is needed because `@creit.tech/stellar-wallets-kit` has a peer dependency on React 18, but this project uses React 19. The `--force` flag bypasses this — everything works fine.

---

## Setup (Full Deploy from Scratch)

> Only follow these steps if you want to deploy your own instance of the smart contract. If you just want to run the frontend against the existing deployed contract, use the [Quick Start](#quick-start-reviewers) section above.

### 1. Smart Contract — Build & Test

```bash
# Install wasm target
rustup target add wasm32v1-none

# Generate and fund an ops account on testnet
stellar keys generate ops --network testnet
stellar keys fund ops --network testnet

# Build and test
cd contracts/freelance_escrow
cargo test            # All tests must pass
stellar contract build  # Produces .wasm in target/
```

### 2. Smart Contract — Deploy to Testnet

```bash
# Deploy (inside contracts/freelance_escrow/)
stellar contract deploy \
  --wasm ../../target/wasm32v1-none/release/freelance_escrow.wasm \
  --source ops \
  --network testnet

# → Outputs CONTRACT_ID (save this)

# Initialize the contract with 2.5% fee
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source ops \
  --network testnet \
  -- initialize \
  --admin $(stellar keys address ops) \
  --fee_basis_points 250

# Verify — should return 250
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- get_fee
```

### 3. Frontend — Configure & Run

```bash
cd frontend
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your own values:

```env
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
ESCROW_CONTRACT_ADDRESS=<CONTRACT_ID>          # from deploy step
OPS_ACCOUNT_PUBLIC_KEY=<ops public key>        # stellar keys address ops
OPS_ACCOUNT_SECRET_KEY=<ops secret key>        # stellar keys secret ops
XLM_TOKEN_ADDRESS=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
PLATFORM_FEE_BASIS_POINTS=250
```

```bash
npm install --force
npm run dev
# → http://localhost:3000
```

---

## Sample CLI Invocations

```bash
# Create a test job (10 XLM = 100,000,000 stroops)
stellar contract invoke \
  --id CB6EX6RFBNMGUZUHZOY5KA5I4PKMK4OLV4ICVDJ4SZP4GMHS44B4RBJD \
  --source ops \
  --network testnet \
  -- create_job \
  --job_id "demo_001" \
  --client $(stellar keys address ops) \
  --freelancer <FREELANCER_ADDRESS> \
  --total_amount 100000000 \
  --token_address CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC

# Read job state
stellar contract invoke \
  --id CB6EX6RFBNMGUZUHZOY5KA5I4PKMK4OLV4ICVDJ4SZP4GMHS44B4RBJD \
  --network testnet \
  -- get_job \
  --job_id "demo_001"

# Check platform fee
stellar contract invoke \
  --id CB6EX6RFBNMGUZUHZOY5KA5I4PKMK4OLV4ICVDJ4SZP4GMHS44B4RBJD \
  --network testnet \
  -- get_fee
```

---

## Security Notes & Architecture Defenses

This project implements multiple layers of security to protect both the platform and its users:

- **Private Key Isolation:** `OPS_ACCOUNT_SECRET_KEY` lives only in `.env.local` (server-side). It is **never** exposed to the browser.
- **Client-Side Signing:** The Freighter wallet signs XDR locally — private keys never leave the user's device.
- **Strict Authorization (`require_auth`):** Every state-changing contract function validates the caller's identity via Soroban's `require_auth()`. This includes `create_job` (which ensures only the platform Ops admin can create jobs).
- **Anti-Spoofing (Token Validation):** The frontend API (`/api/get-job`) strictly validates that the token address returned by the contract matches the expected XLM token address. If a hacker attempts to spoof a job with a worthless custom token, the API explicitly blocks it.
- **Anti-Spam (Rate Limiting):** The `/api/create-job` endpoint includes an IP-based rate limiter (max 3 jobs per minute) to prevent Denial of Service (DoS) attacks from draining the Ops account's transaction fee XLM.
- **No panics:** All smart contract functions return structured `Result<T, ContractError>` instead of panicking, preventing contract halts.

---

## Target Users

Freelancers and clients in the Philippines and Southeast Asia who need a trustless way to handle project payments. Whether it's a web developer in Manila working for a startup in Singapore, or a graphic designer in Cebu contracted by a company in Lisbon—FreelanceChain removes the payment risk.

---

## Why Stellar

Stellar offers sub-cent transaction fees (~$0.00001), 5-second finality, and native smart contract support via Soroban. Unlike Ethereum L2s or Solana, Stellar is purpose-built for financial transactions and remittances. Soroban contracts are written in Rust, compiled to WebAssembly, and deployed on a stable, low-cost network.

---

## Built With

- [Soroban SDK](https://crates.io/crates/soroban-sdk) — Smart contract development
- [Next.js 16](https://nextjs.org/) — Frontend framework (App Router)
- [@stellar/stellar-sdk](https://github.com/stellar/js-stellar-sdk) — Transaction building and RPC
- [@creit.tech/stellar-wallets-kit](https://github.com/Creit-Tech/Stellar-Wallets-Kit) — Freighter wallet integration
- [Tailwind CSS](https://tailwindcss.com/) — Styling

---

## Submission Checklist (Stellar Journey to Mastery)

| Requirement | Status |
|---|---|
| Public GitHub repository | ✅ [reymarkjpanes/freelancechain](https://github.com/reymarkjpanes/freelancechain) |
| README with complete documentation | ✅ This file |
| Minimum 8+ meaningful commits | ✅ 26 commits |
| Live demo link | ✅ [frontend-nu-pearl-3s0nq0wsv5.vercel.app](https://frontend-nu-pearl-3s0nq0wsv5.vercel.app) |
| Screenshot: mobile responsive view | ✅ [See above](#mobile-responsive-design) |
| Screenshot/badge: CI/CD pipeline | ✅ [See above](#cicd-pipeline) |
| Contract address | ✅ `CB6EX6RFBNMGUZUHZOY5KA5I4PKMK4OLV4ICVDJ4SZP4GMHS44B4RBJD` |
| CI/CD running | ✅ GitHub Actions — CI + Deploy workflows |
| Mobile responsive | ✅ Tailwind responsive classes + tested on 375px viewport |
| Production-ready | ✅ Deployed on Vercel with Soroban testnet integration |

---

## License

MIT
