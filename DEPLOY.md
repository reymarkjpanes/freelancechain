# Deployment Guide — FreelanceChain

> **Context:** The old prototype contract  
> `CBPXD4WLBHOQAX3YRI3Y55LE57ERDT57SLSBP32VFEQNL66PN7MAT26X`  
> has a different interface and cannot be used with the new frontend.  
> Follow these steps to deploy the rewritten contract and go live.

---

## Prerequisites

```bash
# 1. Rust + wasm target
rustup target add wasm32v1-none

# 2. Stellar CLI (latest)
cargo install --locked stellar-cli --features opt
# or: brew install stellar-cli  (macOS)

# 3. Verify
stellar --version
```

---

## Step 1 — Create & Fund an Ops Account

```bash
# Generate
stellar keys generate ops --network testnet

# Fund via Friendbot
stellar keys fund ops --network testnet

# Note your addresses — you'll need these
stellar keys address ops          # → public key (OPS_ACCOUNT_PUBLIC_KEY)
stellar keys show ops --network testnet  # → secret key (OPS_ACCOUNT_SECRET_KEY)
```

---

## Step 2 — Build & Test the Contract

```bash
cd contracts/freelance_escrow

# Run all 11 tests
cargo test

# Build the .wasm
stellar contract build

# Confirm the .wasm exists
ls -lh target/wasm32v1-none/release/freelance_escrow.wasm
```

All tests must pass before deploying.

---

## Step 3 — Deploy to Testnet

```bash
# Deploy (still inside contracts/freelance_escrow/)
stellar contract deploy \
  --wasm target/wasm32v1-none/release/freelance_escrow.wasm \
  --source ops \
  --network testnet

# → Outputs a new contract ID like:
#   CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
#   Save this — it is your NEW_CONTRACT_ID
```

Or with the Makefile shorthand:

```bash
make deploy SECRET=$(stellar keys show ops --network testnet)
```

---

## Step 4 — Initialize the Contract

```bash
stellar contract invoke \
  --id <NEW_CONTRACT_ID> \
  --source ops \
  --network testnet \
  -- initialize \
  --admin $(stellar keys address ops) \
  --fee_basis_points 250
```

Makefile shorthand:

```bash
make init \
  CONTRACT=<NEW_CONTRACT_ID> \
  ADMIN=$(stellar keys address ops) \
  SECRET=$(stellar keys show ops --network testnet)
```

Verify it worked — should return `250`:

```bash
stellar contract invoke \
  --id <NEW_CONTRACT_ID> \
  --network testnet \
  -- get_fee
```

---

## Step 5 — Get the Native XLM Token Address

```bash
stellar contract id asset \
  --network testnet \
  --asset native

# → Typically: CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

---

## Step 6 — Configure the Frontend

```bash
cd ../../frontend
cp .env.local.example .env.local
```

Edit `.env.local` and fill in:

```bash
ESCROW_CONTRACT_ADDRESS=<NEW_CONTRACT_ID>       # from Step 3
OPS_ACCOUNT_PUBLIC_KEY=<ops public key>         # from Step 1
OPS_ACCOUNT_SECRET_KEY=<ops secret key>         # from Step 1
XLM_TOKEN_ADDRESS=<xlm token address>           # from Step 5
```

---

## Step 7 — Run the Frontend

```bash
npm install
npm run dev
# → http://localhost:3000
```

---

## Step 8 — Verify in Stellar Lab

Open your new contract in Stellar Lab:

```
https://lab.stellar.org/r/testnet/contract/<NEW_CONTRACT_ID>
```

You should see these functions in the contract spec:
- `initialize`
- `create_job`
- `fund_job`
- `submit_milestone`
- `approve_milestone`
- `get_job`
- `get_fee`
- `get_admin`
- `update_platform_fee`

---

## Quick Smoke Test (CLI)

```bash
# Create a test job
stellar contract invoke \
  --id <NEW_CONTRACT_ID> \
  --source ops \
  --network testnet \
  -- create_job \
  --job_id "smoke_001" \
  --client $(stellar keys address ops) \
  --freelancer $(stellar keys address ops) \
  --total_amount 10000000 \
  --token_address <XLM_TOKEN_ADDRESS>

# Read it back
stellar contract invoke \
  --id <NEW_CONTRACT_ID> \
  --network testnet \
  -- get_job \
  --job_id "smoke_001"
```

---

## Summary

| Old Contract (prototype) | New Contract (rewrite) |
|--------------------------|------------------------|
| `CBPXD4WLBHOQAX3YRI3Y55LE57ERDT57SLSBP32VFEQNL66PN7MAT26X` | Your new ID from Step 3 |
| `create_job`, `approve_and_release` | Full 6-function escrow flow |
| Single global job | Per-job storage keyed by `job_id` |
| No fee logic | 250 bps fee with snapshot |
| Panics on errors | `Result<T, ContractError>` everywhere |
