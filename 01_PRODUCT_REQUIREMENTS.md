# Product Requirements Document

## 1. Product

**Name:** YieldLine  
**Category:** RWA / DeFi credit infrastructure  
**Network:** Arbitrum Sepolia for MVP  
**Primary settlement token:** MockUSDC  
**Reference RWA:** OpenEden TBILL model

## 2. Problem

Crypto lending protocols are optimized for assets with liquid, 24/7 markets and permissionless transfers. Tokenized RWAs can instead have NAV-based pricing, allowlisted transfers, delayed redemption, restricted holders, and non-atomic settlement.

A protocol that treats an RWA exactly like ETH risks:

- lending against stale valuations
- assuming collateral can be sold immediately
- sending a restricted asset to an ineligible liquidator
- ignoring issuer redemption windows
- overestimating realizable liquidation value

YieldLine makes those RWA characteristics first-class risk inputs.

## 3. Product goal

Enable an eligible user to deposit a tokenized RWA, obtain a risk-adjusted borrowing limit, and borrow USDC-like liquidity while preserving exposure to the RWA.

## 4. MVP users

### Borrower

Has an eligible RWA and wants liquidity without selling or redeeming it.

Needs to:

- pass the demo compliance check
- deposit supported collateral
- inspect borrow capacity
- borrow MockUSDC
- monitor health
- repay debt
- withdraw collateral

### Lender

Has MockUSDC and wants lending yield.

Needs to:

- deposit MockUSDC into an ERC-4626 vault
- receive vault shares
- view utilization and estimated supply APR
- withdraw available liquidity

### Risk administrator

Configures the workshop protocol.

Needs to:

- register collateral
- set LTV and liquidation parameters
- configure oracle-age thresholds
- pause borrowing
- change mock oracle values for demonstration
- mark deferred liquidation as settled

## 5. Core user stories

### US-01: Deposit collateral

As an eligible borrower, I can deposit supported RWA collateral so that YieldLine can calculate a borrowing limit.

Acceptance criteria:

- unsupported assets revert
- non-compliant accounts revert
- transfer failure reverts
- deposited amount appears in the position
- event is emitted

### US-02: Borrow stablecoin

As a borrower, I can borrow MockUSDC up to my effective borrow capacity.

Acceptance criteria:

- oracle is valid and fresh enough
- protocol is not paused
- resulting health factor remains above minimum
- liquidity vault has sufficient available assets
- debt is recorded
- MockUSDC reaches borrower

### US-03: View RWA-adjusted risk

As a borrower, I can see why effective LTV differs from base LTV.

UI must expose:

- raw collateral value
- base LTV
- liquidity factor
- freshness factor
- settlement factor, if enabled
- effective collateral value
- borrowing capacity
- debt
- health factor

### US-04: Stale oracle protection

As the protocol, I reduce or disable new borrowing when an RWA valuation becomes stale.

Acceptance criteria:

- no dependence on frontend-only logic
- timestamp checked onchain
- stale-state behavior covered by tests
- current position remains queryable

### US-05: Repay

As a borrower, I can repay part or all of my debt.

Acceptance criteria:

- accrued debt is calculated
- principal/debt decreases
- liquidity returns to lender vault
- event emitted

### US-06: Withdraw collateral

As a borrower, I can withdraw collateral if the remaining position stays healthy.

Acceptance criteria:

- withdrawal cannot create an undercollateralized position
- full withdrawal allowed after full repayment
- compliance restrictions enforced when applicable

### US-07: Supply liquidity

As a lender, I can deposit MockUSDC into the liquidity vault.

Acceptance criteria:

- ERC-4626 shares minted correctly
- share accounting remains correct after interest
- withdrawals cannot exceed available liquidity

### US-08: Deferred liquidation

As the protocol, I can transition an unhealthy RWA position into a pending-liquidation state rather than assuming an instant market sale.

Acceptance criteria:

- new borrowing is disabled for the position
- collateral cannot be withdrawn
- liquidation state recorded
- settlement can be completed by authorized demo operator
- any defined surplus is returned or claimable

## 6. MVP features

### P0

- wallet connection
- mock RWA faucet/admin mint
- allowlist
- RWA registry
- NAV oracle with timestamp
- effective LTV calculation
- borrow and repay
- ERC-4626 USDC pool
- health factor
- stale-oracle behavior
- pending-liquidation state
- Arbitrum Sepolia deployment
- basic dashboard

### P1

- utilization-based variable rate
- partial repayment
- partial collateral withdrawal
- lender analytics
- real OpenEden read-only data panel
- transaction history

### P2

- Stylus risk engine
- multiple RWA adapters
- reserve fund
- real compliance adapter
- issuer redemption adapter
- governance
- subgraph/indexer

## 7. Non-functional requirements

### Correctness

All financial arithmetic must:

- use integer fixed-point math
- explicitly document token decimals
- avoid floating-point arithmetic
- define rounding direction
- include boundary tests

### Security

- use checks-effects-interactions
- use reentrancy guards where external token transfers occur
- use safe ERC-20 transfers
- protect admin functions
- pause sensitive actions
- validate oracle timestamps and values

### UX

Users must always be able to distinguish:

- base LTV from effective LTV
- price/NAV from liquidation value
- healthy from warning and liquidation states
- production reference data from mock testnet assets

## 8. Product metrics for demo

The workshop version does not need real TVL metrics. Demonstrate:

- at least one lender
- at least one borrower
- successful collateralized borrow
- stale oracle reducing or disabling borrowing
- NAV drop causing liquidation eligibility
- successful repayment
- deferred liquidation state transition

## 9. Legal/product language

Never imply:

- the mock token is a real Treasury security
- the user owns production TBILL through the mock
- YieldLine is approved by an RWA issuer
- workshop LTVs are production investment recommendations

Use labels such as:

> MockTBILL is a test token that simulates selected properties of a permissioned, NAV-priced RWA for software demonstration purposes.
