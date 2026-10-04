# Security Threat Model

## 1. Scope

This document covers the workshop prototype and identifies what would need to change for production.

## 2. Protected assets

- lender MockUSDC
- borrower MockTBILL
- position accounting
- oracle configuration
- risk parameters
- admin permissions

## 3. Threat actors

- malicious borrower
- malicious lender
- compromised admin
- malicious token
- compromised oracle updater
- malicious liquidation operator
- accidental frontend error

## 4. Key threats

### T-01: Reentrancy

Risk:

External token transfers can call untrusted code in unusual ERC-20 implementations.

Controls:

- checks-effects-interactions
- `ReentrancyGuard` on value-moving paths where appropriate
- supported-token allowlist
- SafeERC20

### T-02: Oracle manipulation

Risk:

Inflated NAV allows excess borrowing.

MVP controls:

- admin-only mock updates
- stale checks
- validity checks
- pause

Production controls:

- authenticated oracle
- deviation guards
- robust source process
- potentially multiple sources

### T-03: Stale oracle

Risk:

Old NAV overstates collateral.

Controls:

- `maxOracleAge`
- `hardStaleAge`
- freshness haircut
- disable new borrowing
- avoid automatic stale-price liquidation

### T-04: Admin key compromise

Risk:

Attacker changes LTV/oracle/eligibility.

MVP:

- dedicated test wallet
- minimal funded account
- role separation where practical

Production:

- multisig
- timelock
- monitoring
- emergency roles

### T-05: Incorrect decimal conversion

Risk:

10^12 or 10^18 valuation error.

Controls:

- standard normalized price decimals
- helper library
- exhaustive unit tests
- reject unsupported decimal range if needed

### T-06: Restricted token transfer failure

Risk:

Vault or receiver is not eligible.

Controls:

- compliance checks
- vault allowlisting in mock
- safe transfer failure handling

### T-07: Insolvency from RWA settlement loss

Risk:

Liquidation proceeds are below debt.

Controls:

- conservative haircuts
- explicit bad-debt accounting
- future insurance reserve

### T-08: Lender bank run

Risk:

All lenders try to withdraw while assets are borrowed.

Controls:

- correct `maxWithdraw`
- display liquid vs economic assets
- no promise of immediate withdrawal above available cash

### T-09: Interest accounting drift

Risk:

Debt and liquidity-vault accounting diverge.

Controls:

- single source of debt truth
- invariant tests
- deterministic index math

### T-10: Frontend misrepresentation

Risk:

UI shows incorrect borrowing capacity.

Controls:

- onchain enforcement
- call simulation
- fetch contract-computed risk result
- no frontend-only risk gate

## 5. Solidity checklist

Before deployment:

- custom errors
- access control reviewed
- zero-address checks
- bounded BPS
- timestamp checks
- SafeERC20
- reentrancy review
- pause behavior reviewed
- repayment remains possible in emergency
- liquidation state cannot be bypassed
- rounding direction documented

## 6. Economic checklist

- base LTV below liquidation LTV
- all risk factors <= 100%
- hard stale blocks borrowing
- settlement haircut is not accidentally applied twice
- bad debt cannot disappear from accounting
- vault `totalAssets` includes receivables correctly
- share price cannot be trivially manipulated by donation/first-depositor edge cases

## 7. ERC-4626 concerns

Review:

- inflation/donation attack
- first-deposit rounding
- share/asset conversion rounding
- borrowed-assets accounting
- `maxWithdraw` and `maxRedeem`

Use current OpenZeppelin ERC-4626 implementation and follow its documented behavior rather than hand-writing the standard.

## 8. MVP security disclaimer

The workshop build:

- is unaudited
- uses admin-controlled mock pricing
- uses mock tokens
- is not intended for real funds
- is not an investment product
