# MVP Roadmap

## Goal

Build the smallest complete system that demonstrates:

```text
permissioned RWA
→ risk-adjusted collateral
→ USDC credit
→ RWA-specific stale-price handling
→ deferred liquidation
```

## Milestone 0 — Freeze the model

Deliverables:

- final equations from `06_RISK_ENGINE.md`
- final token decimals
- final position state machine
- one collateral type only

Exit condition:

No unresolved question about basic debt/collateral accounting.

## Milestone 1 — Mocks and registry

Build:

- MockUSDC
- ComplianceRegistry
- MockTBILL
- MockRWAOracle
- RWARegistry

Test:

- restricted transfers
- config validation
- oracle update

Exit condition:

MockTBILL can move borrower → eligible vault and cannot move to an ineligible address.

## Milestone 2 — Risk engine

Build:

- decimal normalization
- freshness factor
- effective collateral
- borrow capacity
- liquidation capacity
- health factor

Exit condition:

All numerical examples in the docs pass as unit tests.

## Milestone 3 — Liquidity vault

Build:

- ERC-4626 deposits
- controlled liquidity draw
- repayment
- utilization

Exit condition:

Lender can deposit, protocol can draw, protocol can repay, lender accounting remains correct.

## Milestone 4 — Credit vault

Build:

- deposit collateral
- borrow
- repay
- withdraw
- status

Exit condition:

End-to-end local happy path passes.

## Milestone 5 — Deferred liquidation

Build:

- liquidation eligibility
- pending status
- settlement
- bad-debt visibility

Exit condition:

NAV-shock scenario closes correctly.

## Milestone 6 — Frontend

Build minimum pages:

- dashboard/borrow
- lend
- admin simulator

Exit condition:

No CLI is required during normal demo except as backup.

## Milestone 7 — Arbitrum Sepolia

- deploy
- configure
- verify
- seed demo accounts
- connect frontend

Exit condition:

Happy path works entirely on Arbitrum Sepolia.

## Milestone 8 — Production reference data

Optional:

- show OpenEden Arbitrum One reference data read-only
- label it clearly

Do only after the full MVP works.

## Stretch 1 — Better interest model

Add utilization-driven rate.

## Stretch 2 — Insurance reserve

Allocate part of borrower interest to a reserve.

## Stretch 3 — Stylus

Port the pure risk engine to Rust using Arbitrum Stylus while keeping the same external interface.

## Stretch 4 — Second collateral

Add a different mock RWA with meaningfully different properties, such as an invoice:

```text
lower LTV
longer redemption delay
larger settlement haircut
```

This demonstrates why an RWA registry matters.

## What to cut first if behind schedule

Cut in this order:

1. live production reference panel
2. variable rate
3. transaction history
4. partial liquidation complexity
5. second collateral
6. indexer
7. Stylus

Do **not** cut:

- oracle staleness
- risk haircuts
- health factor
- compliance mock
- deferred-liquidation state

Those features are the core YieldLine thesis.
