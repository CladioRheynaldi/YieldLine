# Liquidation and Settlement

## 1. Principle

RWA collateral may not be instantly swappable.

YieldLine models liquidation as a stateful settlement workflow.

## 2. Position states

Recommended MVP states:

```solidity
enum PositionStatus {
    NONE,
    ACTIVE,
    LIQUIDATION_PENDING,
    CLOSED
}
```

Transition:

```text
NONE -> ACTIVE
ACTIVE -> LIQUIDATION_PENDING
ACTIVE -> CLOSED
LIQUIDATION_PENDING -> CLOSED
LIQUIDATION_PENDING -> ACTIVE   (full repayment before settlement)
```

A position in `LIQUIDATION_PENDING`:

- cannot borrow
- cannot withdraw collateral
- accepts borrower repayment before settlement; repaying the debt in full cures the position
  (`LIQUIDATION_PENDING -> ACTIVE`, event `LiquidationCured`) so collateral is not burned
- continues accruing interest until repayment or settlement
- waits for authorized settlement action

## 3. Liquidation eligibility

```text
price must be valid enough for liquidation policy
healthFactor < 1e18
position status == ACTIVE
debt > 0
```

Important policy:

A **hard-stale** oracle should not automatically force liquidation solely from old data.

Suggested MVP behavior:

- hard stale blocks borrow/unsafe withdrawals
- liquidation initiation requires a valid price
- risk admin may pause

## 4. Initiation

`initiateLiquidation(borrower, asset)`:

1. accrue debt
2. evaluate risk
3. require liquidatable
4. set state to `LIQUIDATION_PENDING`
5. record debt and collateral snapshot if useful
6. emit event

No mock funds have to move offchain.

## 5. Settlement simulation

For workshop purposes, an authorized liquidation operator simulates completion of issuer redemption.

`settleLiquidation(...)` may:

1. receive/provide settlement MockUSDC
2. repay debt to liquidity vault
3. apply demo liquidation cost/penalty
4. return remaining surplus to borrower
5. burn or move mock collateral
6. mark position closed

Keep exact fund flow simple and fully tested.

## 6. Suggested accounting

Let:

```text
S = settlement proceeds in USDC
D = current debt, including interest through settlement
F = liquidation fee/cost (zero in the implemented demo)
```

Then:

```text
debtRepaid = min(S, D)

remaining =
S - debtRepaid

fee =
min(F, remaining)

borrowerSurplus =
remaining - fee
```

If:

```text
S < D
```

there is bad debt. The liquidity vault removes the unpaid debt shares and records the resulting aggregate receivable reduction, including uncollected interest. It does not subtract that loss a second time from assets.

The implemented fund flow and bounded debt rounding are documented in [24_INTEREST_ACCOUNTING.md](24_INTEREST_ACCOUNTING.md).

## 7. Bad debt

MVP recommendation:

- explicitly expose bad debt
- do not hide it through magic minting
- optionally let admin settle it for demonstration

Future protocol options:

- insurance reserve
- first-loss capital
- lender socialization
- junior tranche
- external backstop

## 8. Liquidation buffer

Because settlement can take time, production LTV should reflect:

- expected redemption latency
- NAV movement during delay
- settlement cost
- restricted transferability
- liquidity availability

This is the purpose of the settlement/liquidity factors in the risk model.

## 9. Optional reserve

Post-MVP:

```text
borrow interest
      ↓
protocol fee
      ↓
insurance reserve
```

Reserve can temporarily absorb losses or liquidity gaps.

Do not add it before the core loan flow works.

## 10. Demo sequence

Use the simulator to:

1. start with healthy NAV
2. borrow
3. lower NAV
4. show HF below 1
5. initiate liquidation
6. show `LIQUIDATION_PENDING`
7. settle mock redemption
8. show debt cleared and position closed

This sequence demonstrates the RWA-specific design better than an instant token swap.
