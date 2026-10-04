# Oracle Design

## 1. Why RWA pricing differs

A tokenized fund can use NAV-per-token rather than a constantly traded DEX price.

YieldLine therefore needs both:

- a value
- evidence of when that value was last updated

## 2. Normalized oracle API

```solidity
function latestPrice(address asset)
    external
    view
    returns (
        uint256 price,      // 1e18 USD
        uint256 updatedAt,
        bool valid
    );
```

## 3. MVP mock oracle

`MockRWAOracle` lets an authorized demo operator update:

- price
- timestamp
- validity

Suggested methods:

```solidity
setPrice(asset, price, updatedAt)
setValid(asset, bool)
```

For safer demo ergonomics, expose:

```solidity
setCurrentPrice(asset, price)
```

which uses `block.timestamp`.

A separate method can intentionally simulate staleness.

## 4. Validation

Reject or mark invalid when:

- price is zero
- timestamp is zero
- timestamp is in the future
- source reports invalid
- returned data cannot be decoded

## 5. Staleness

Registry provides:

- `maxOracleAge`
- `hardStaleAge`

Risk engine computes the freshness factor.

Avoid putting asset-specific stale thresholds inside the oracle adapter.

## 6. Read-only OpenEden reference

OpenEden documents an onchain TBILL price oracle and describes TBILL price as NAV per token.

Workshop integration options:

### Option A — safest

Read live values only in the frontend and display them as production reference data.

### Option B — adapter experiment

Build a read-only adapter against the documented contract ABI on a fork or production RPC.

Do not make production borrowing depend on an ABI assumption you have not verified.

## 7. Testing oracle failure

Required cases:

1. normal fresh price
2. boundary at `maxOracleAge`
3. linearly stale price
4. boundary at `hardStaleAge`
5. zero price
6. future timestamp
7. invalid flag
8. stale oracle while user has no debt
9. stale oracle while user has debt
10. NAV decreases sharply

## 8. Price manipulation model

The mock oracle is admin-controlled and therefore not manipulation-resistant.

Production requirements would include:

- authenticated source
- source-specific guardrails
- value deviation checks
- delayed or multi-source validation where appropriate
- emergency pause
- transparent source metadata

## 9. Oracle metadata for UI

Expose enough information to render:

```text
NAV
last updated
age
freshness factor
status
source
```

Suggested status mapping:

```text
FRESH
DEGRADED
HARD_STALE
INVALID
```
