# Workshop Demo Script

## Demo objective

In five to seven minutes, prove that YieldLine solves an RWA-specific problem rather than merely cloning a crypto lending protocol.

## Preparation

Before presenting:

```text
Arbitrum Sepolia selected
lender funded
borrower funded with MockTBILL
borrower allowlisted
credit vault allowlisted
liquidity pool seeded
MockTBILL NAV fresh
frontend open
explorer links ready
```

## 1. Opening — 30 seconds

Say:

> Tokenizing an asset is only the first step. Once a real-world asset is onchain, DeFi still has to deal with NAV pricing, restricted transfers, oracle update schedules, and settlement delays. YieldLine is an RWA-native credit layer for Arbitrum that turns those constraints into explicit collateral-risk parameters.

## 2. Show market configuration — 45 seconds

Open MockTBILL market.

Highlight:

```text
NAV
base LTV
liquidity factor
settlement factor
oracle age
effective LTV
permissioned status
```

Say:

> YieldLine does not assume one dollar of RWA value equals one dollar of immediately liquidatable crypto collateral.

## 3. Supply liquidity — 45 seconds

Lender deposits MockUSDC.

Show:

```text
vault liquidity
shares
utilization
```

## 4. Deposit RWA — 45 seconds

Borrower deposits 100,000 MockTBILL.

Show:

```text
raw value
effective collateral value
borrow capacity
```

Explain each haircut.

## 5. Borrow — 45 seconds

Borrow a safe amount of MockUSDC.

Show:

```text
debt
health factor
available borrow
```

Open explorer transaction if useful.

## 6. Oracle degradation — 60 seconds

Open admin simulator.

Move oracle age into degraded range.

Show immediately:

```text
freshness factor ↓
effective collateral ↓
borrow capacity ↓
```

Then make it hard stale.

Show:

```text
new borrowing disabled
```

Say:

> A stale NAV is itself risk. YieldLine does not continue lending as though the valuation were current.

## 7. Restore oracle and shock NAV — 60 seconds

Restore valid/fresh oracle.

Lower NAV until:

```text
HF < 1
```

Show:

```text
LIQUIDATABLE
```

Initiate liquidation.

## 8. Deferred settlement — 60 seconds

Show position status:

```text
LIQUIDATION_PENDING
```

Say:

> A tokenized fund may not be sellable instantly to an arbitrary address. Rather than pretending liquidation happens through an immediate DEX swap, YieldLine models an asynchronous settlement path.

Trigger mock settlement.

Show:

```text
debt repaid
position closed
surplus/bad debt if applicable
```

## 9. Arbitrum connection — 30 seconds

Show deployment network and optionally production reference card.

Say:

> The prototype runs on Arbitrum Sepolia. The architecture is designed around assets already being tokenized on Arbitrum, while the workshop uses mocks for the permissioned custody flow instead of claiming access to institutional assets.

## 10. Closing — 20 seconds

Say:

> YieldLine's product is not just lending. It is the risk and settlement abstraction that can make different classes of tokenized RWAs usable as programmable collateral.

## Backup plan

If testnet RPC fails:

- run same frontend against local Anvil deployment
- show verified testnet deployment addresses separately
- never fake transaction success

If wallet fails:

- have screenshots/video only as backup
- keep Foundry scenario test ready to execute
