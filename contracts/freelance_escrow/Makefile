default: build

all: test

test: build
	cargo test

build:
	stellar contract build
	@ls -l target/wasm32v1-none/release/*.wasm

fmt:
	cargo fmt --all

clean:
	cargo clean

# ── Testnet helpers ──────────────────────────────────────────────────────────
# Usage: make deploy SECRET=<your_ops_secret>
deploy:
	stellar contract deploy \
		--wasm target/wasm32v1-none/release/freelance_escrow.wasm \
		--source $(SECRET) \
		--network testnet

# Usage: make init CONTRACT=<id> ADMIN=<address> SECRET=<secret>
init:
	stellar contract invoke \
		--id $(CONTRACT) \
		--source $(SECRET) \
		--network testnet \
		-- initialize \
		--admin $(ADMIN) \
		--fee_basis_points 250

# Usage: make verify CONTRACT=<id>
verify:
	stellar contract invoke \
		--id $(CONTRACT) \
		--network testnet \
		-- get_fee
