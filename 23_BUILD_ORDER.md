# Exact Build Order

This is the original implementation sequence. The subsequent Person 1 interest task is documented in [24_INTEREST_ACCOUNTING.md](24_INTEREST_ACCOUNTING.md) and [25_INTEREST_TESTING.md](25_INTEREST_TESTING.md); it is separate from this guide's Phase 1 contract skeleton.

## Phase 1 — Contract skeleton

Create:

```text
MockUSDC.sol
ComplianceRegistry.sol
MockTBILL.sol
MockRWAOracle.sol
RWARegistry.sol
OracleAdapter.sol
RWARiskEngine.sol
USDCLiquidityVault.sol
RWACreditVault.sol
```

Make everything compile before implementing business logic.

## Phase 2 — Permissioned mock asset

Implement and test:

```text
allowlist borrower
allowlist credit vault
mint MockTBILL
borrower -> vault transfer succeeds
borrower -> random wallet transfer fails
```

## Phase 3 — Registry and oracle

Implement:

```text
asset config
config validation
price + timestamp
staleness detection
```

## Phase 4 — Risk math

Implement functions in this order:

```text
rawCollateralValue
freshnessFactorBps
effectiveCollateralValue
borrowCapacity
liquidationCapacity
healthFactor
```

Write exact unit tests immediately after each function.

## Phase 5 — Liquidity

Implement:

```text
ERC-4626 deposit
available liquidity
authorized draw
repayment
borrowed accounting
```

The original build introduced principal accounting here. Person 1 now extends it with the shared interest index and utilization-based APR.

## Phase 6 — Credit

Implement:

```text
depositCollateral
getPosition
borrow
repay
withdrawCollateral
```

Use risk engine for every safety check.

## Phase 7 — Liquidation

Implement:

```text
liquidation check
LIQUIDATION_PENDING
settlement
surplus/bad-debt accounting
```

## Phase 8 — Scenario test

One test must execute:

```text
lender deposits 100k USDC
borrower gets 100k TBILL
NAV = 1.05
borrower deposits
borrower borrows
NAV drops
HF < 1
liquidation begins
settlement completes
```

Do not start frontend until this passes.

## Phase 9 — Frontend

Implement in this order:

```text
network config
wallet
contract reads
market card
lender deposit
borrower deposit
borrow
repay
risk breakdown
simulator
liquidation controls
```

## Phase 10 — Testnet

Deploy to Arbitrum Sepolia.

Seed two demo wallets.

Run the complete demo at least twice from a clean state.

## Phase 11 — Optional polish

Only now add:

```text
live production reference data
charts
indexer
Stylus
```
