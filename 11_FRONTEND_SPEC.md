# Frontend Specification

## 1. Stack

Recommended:

- Next.js
- TypeScript
- wagmi
- viem
- WalletConnect/injected wallet support
- Tailwind CSS
- TanStack Query if useful

## 2. Pages

```text
/
├── dashboard
├── borrow
├── lend
├── markets
├── position
└── admin-simulator
```

A workshop MVP may combine dashboard, borrow, and position.

## 3. Global header

Display:

- YieldLine
- current chain
- wallet
- navigation
- protocol pause indicator

If wrong network:

> Switch to Arbitrum Sepolia

## 4. Dashboard

Cards:

```text
My collateral
My debt
Borrow capacity
Health factor
Wallet MockUSDC
Wallet MockTBILL
```

Risk panel:

```text
NAV
oracle age
oracle status
base LTV
liquidity factor
settlement factor
freshness factor
effective LTV
```

## 5. Borrow flow

### Step 1 — eligibility

Display:

```text
Demo eligibility
Eligible / Not eligible
```

If not eligible, admin simulator can allowlist the demo wallet.

### Step 2 — deposit

Inputs:

- collateral amount
- wallet balance
- approve button
- deposit button

Preview:

- collateral USD value
- new borrow capacity

### Step 3 — borrow

Input MockUSDC amount.

Live preview:

```text
Debt before
Debt after
Health factor before
Health factor after
Available liquidity
```

Disable transaction if local simulation predicts revert.

Onchain contract remains final authority.

## 6. Lend page

Display:

```text
Total supplied
Available liquidity
Borrowed
Utilization
Estimated borrow APR
Estimated supply APR
```

Actions:

- deposit MockUSDC
- withdraw/redeem shares

## 7. Markets page

For MockTBILL:

```text
Asset                MockTBILL
Model                Tokenized Treasury simulation
Price type           NAV
NAV                   $X
Oracle status         Fresh
Base LTV              X%
Effective LTV         X%
Redemption delay      1 day simulated
Permissioned          Yes
```

Optional production-reference card:

```text
OpenEden TBILL
Network: Arbitrum One
Source: official contract/oracle
Mode: read-only reference
```

Never visually merge the mock position and production asset balance.

## 8. Position page

Display:

- collateral amount
- collateral raw value
- effective collateral value
- debt
- accrued debt
- borrow capacity
- liquidation threshold
- health factor
- position status

Actions:

- add collateral
- borrow
- repay
- withdraw

## 9. Risk simulator

Admin-only workshop screen.

Controls:

```text
Mock NAV
Oracle timestamp/age
Oracle valid toggle
Wallet eligibility
Borrowing enabled
```

Scenario presets:

```text
Healthy
Oracle degraded
Oracle hard stale
NAV shock
Liquidation
```

This dramatically improves demo reliability.

## 10. Liquidation UI

State progression:

```text
ACTIVE
WARNING
LIQUIDATION PENDING
SETTLED/CLOSED
```

Explain:

> RWA collateral may require issuer redemption or an eligible counterparty. YieldLine therefore models liquidation as deferred settlement rather than assuming an instant DEX sale.

## 11. Transaction UX

For each write:

1. simulate contract call if possible
2. request wallet signature
3. show pending transaction
4. link to Arbitrum Sepolia explorer
5. refetch affected state
6. show success/error

## 12. Error mapping

Convert contract errors into readable text.

Examples:

```text
AccountNotEligible
→ This wallet is not eligible for the selected mock RWA.

OracleHardStale
→ The RWA valuation is too old for new borrowing.

InsufficientCollateral
→ This borrow would move the position beyond its borrowing limit.

InsufficientLiquidity
→ The lending pool does not currently have enough available USDC.
```

## 13. Visual priorities

The most important visual is:

```text
BASE LTV
    ↓
RWA RISK ADJUSTMENTS
    ↓
EFFECTIVE BORROWING POWER
```

The second most important is health-factor response when NAV/oracle status changes.

## 14. Responsive target

Desktop first for workshop presentation.

Minimum acceptable mobile support:

- cards stack cleanly
- transaction buttons remain accessible
- no horizontal overflow in core flows
