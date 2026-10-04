# YieldLine Pitch

## One sentence

YieldLine is an RWA-native credit layer on Arbitrum that converts tokenized real-world assets into risk-adjusted collateral while accounting for NAV staleness, transfer restrictions, liquidity haircuts, and delayed settlement.

## 30-second pitch

Tokenizing a Treasury fund or another real-world asset does not automatically make it safe DeFi collateral. Unlike ETH, an RWA can have an NAV that updates periodically, restricted transfers, KYC requirements, and a redemption process that takes business-day time rather than one block. YieldLine turns those properties into explicit onchain risk parameters. Borrowers can preserve RWA exposure while accessing USDC liquidity, while lenders fund overcollateralized loans through an ERC-4626 pool.

## 90-second pitch

Most DeFi lending assumes collateral can be priced continuously and liquidated immediately. That model breaks down for many tokenized real-world assets.

YieldLine introduces an RWA-specific collateral layer. Every supported asset has an oracle adapter, compliance adapter, liquidity factor, settlement factor, LTV, and oracle-age policy. The risk engine converts the token balance and NAV into an effective collateral value and borrowing capacity.

If the NAV becomes stale, borrowing power degrades or new borrowing is disabled. If a position becomes unsafe, YieldLine does not assume an unrestricted liquidator can instantly buy the asset. It can move the position into deferred liquidation and wait for a simulated issuer-redemption settlement.

The workshop MVP runs on Arbitrum Sepolia using MockTBILL and MockUSDC. Production RWA contracts can be displayed as read-only reference data without falsely claiming that the prototype is authorized to custody permissioned assets.

The longer-term goal is for YieldLine to become the credit abstraction layer between tokenized assets and Arbitrum DeFi.

## Problem

```text
Tokenized ≠ liquid
Onchain ≠ permissionless
Priced ≠ continuously priced
Redeemable ≠ instantly redeemable
```

## Solution

```text
RWA
 ↓
Registry
 ↓
Oracle + compliance adapters
 ↓
Risk engine
 ↓
Effective collateral value
 ↓
Credit vault
 ↓
USDC liquidity
```

## Differentiation

YieldLine is not simply:

> Aave with a Treasury token.

The differentiated layer is:

- RWA-aware valuation
- staleness-sensitive borrowing power
- restricted-holder awareness
- settlement/liquidity haircuts
- deferred liquidation

## Why Arbitrum

- EVM-compatible smart contracts
- low-cost application execution relative to Ethereum L1
- strong DeFi composability
- existing tokenization/RWA activity
- Arbitrum Sepolia for development
- optional Stylus path for a Rust risk engine

## Business model ideas

Post-MVP:

- protocol spread or origination fee
- risk-infrastructure fee paid by integrated vaults
- institutional private deployments
- issuer integration fees
- premium analytics/risk APIs

None are required for workshop MVP.

## Future vision

```text
OpenEden / Ondo / funds / invoices / commodities
                       ↓
                 YieldLine adapters
                       ↓
         standardized collateral risk API
                       ↓
        lending / treasury / margin / credit
```
