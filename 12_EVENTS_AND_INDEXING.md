# Events and Indexing

## 1. MVP approach

Do not require a database to build the first working version.

Use:

- direct contract reads for current state
- event logs for recent activity

## 2. Events

Core event set:

```text
CollateralDeposited
CollateralWithdrawn
Borrowed
Repaid
InterestAccrued
BorrowRateUpdated
RepaymentRecorded
BadDebtRecognized
LiquidationInitiated
LiquidationSettled
AssetConfigUpdated
EligibilityUpdated
OracleUpdated
LiquiditySupplied
LiquidityWithdrawn
```

ERC-4626 already emits standard `Deposit` and `Withdraw` events.

## 3. Frontend recent activity

Use viem to query logs:

```text
current wallet
+
credit vault address
+
deployment block
```

Display:

```text
Deposit 100 MockTBILL
Borrow 50 MockUSDC
Repay 10 MockUSDC
```

## 4. When an indexer becomes necessary

Add an indexer if you need:

- all users
- TVL history
- historical NAV chart
- liquidation analytics
- protocol-wide utilization history
- portfolio across many collateral types

## 5. Suggested indexed entities

```text
Account
Position
CollateralAsset
Borrow
Repayment
Liquidation
VaultSnapshot
OracleSnapshot
```

## 6. Optional SQL schema

If a simple backend/indexer is used:

```text
positions
- chain_id
- borrower
- asset
- collateral_amount
- debt_amount
- status
- updated_block

events
- tx_hash
- log_index
- block_number
- block_timestamp
- event_type
- borrower
- asset
- amount
- metadata_json

market_snapshots
- timestamp
- asset
- nav
- oracle_updated_at
- total_collateral
- total_debt
- utilization
```

Use `(tx_hash, log_index)` as idempotency key.

## 7. Reorg handling

For a workshop testnet indexer:

- process confirmations conservatively
- make writes idempotent
- be able to replay from deployment block

Do not treat a custom database as authoritative over onchain state.

## 8. Source of truth

Always:

```text
contracts = source of truth
index = derived read model
frontend cache = disposable
```

## 9. Interest read model

Debt grows between events. Query current debt and the current borrow index when rendering a position; a cached last-event debt value becomes stale even without a transaction.

`InterestAccrued(index, receivables)` records a checkpoint. `BorrowRateUpdated(rateBps, utilization)` records the rate used for the next economic interval. The supplied ABIs contain the exact signatures.
