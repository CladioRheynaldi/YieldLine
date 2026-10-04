# RWA Registry

## Purpose

`RWARegistry` is the source of truth for how YieldLine treats each supported collateral asset.

It separates:

- asset-specific policy
- risk calculations
- custody/accounting

## Asset configuration

Recommended fields:

| Field | Meaning |
|---|---|
| `oracle` | normalized price/NAV source |
| `complianceAdapter` | eligibility source |
| `baseLtvBps` | starting borrowing ratio |
| `liquidationLtvBps` | threshold used for liquidation |
| `liquidityFactorBps` | haircut for realizable liquidity |
| `settlementFactorBps` | haircut for redemption/settlement friction |
| `maxOracleAge` | time after which freshness haircut begins |
| `hardStaleAge` | time after which new borrowing is disabled |
| `redemptionDelay` | informational/risk parameter |
| `supplyCap` | maximum accepted collateral |
| `permissioned` | whether eligibility checks apply |
| `borrowingEnabled` | asset-specific borrow switch |
| `enabled` | global asset state |

## Example MVP MockTBILL configuration

Illustrative only:

```text
baseLtvBps          7500
liquidationLtvBps   8200
liquidityFactorBps  9000
settlementFactorBps 9500
maxOracleAge        24 hours
hardStaleAge        72 hours
redemptionDelay     1 day
permissioned        true
borrowingEnabled    true
enabled             true
```

These are **demo parameters**, not production recommendations.

## Validation rules

At configuration time enforce:

```text
baseLtvBps < liquidationLtvBps <= 10000
liquidityFactorBps <= 10000
settlementFactorBps <= 10000
maxOracleAge < hardStaleAge
oracle != address(0)
asset != address(0)
```

For a permissioned asset:

```text
complianceAdapter != address(0)
```

## Supply caps

A collateral cap limits protocol concentration.

When adding collateral:

```text
existing collateral
+ deposit
<= supply cap
```

For MVP, total collateral can be tracked in the credit vault and checked against registry config.

## Configuration updates

Events must include old/new values or emit the full new configuration.

Suggested event:

```solidity
event AssetConfigUpdated(
    address indexed asset,
    bytes32 indexed configHash
);
```

A more verbose event is easier for indexing but costs more gas.

## Production governance

Post-MVP:

- risk changes through a timelock
- emergency disable remains fast
- material LTV increases delayed
- oracle changes delayed
- role separation between risk and emergency admin
