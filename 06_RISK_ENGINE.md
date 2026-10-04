# RWA Risk Engine

## 1. Objective

Convert an RWA balance into a conservative borrowing capacity while incorporating risks not captured by spot price alone.

The MVP intentionally uses an explainable deterministic model.

## 2. Units

Recommended standards:

```text
price                 1e18 USD per whole token
BPS denominator       10,000
health factor         1e18
USDC accounting       native 6 decimals internally where appropriate
risk calculations     normalize to 1e18
```

Write helper functions for decimal conversion and test them thoroughly.

## 3. Raw collateral value

For token amount `A`, token decimals `D`, and normalized USD price `P`:

```text
rawCollateralValue =
A × P / 10^D
```

where result is 1e18 USD.

## 4. Freshness factor

Recommended MVP rule:

```text
oracleAge <= maxOracleAge:
    freshness = 10000 bps

maxOracleAge < oracleAge < hardStaleAge:
    freshness declines linearly

oracleAge >= hardStaleAge:
    freshness = 0
    new borrowing disabled
```

Linear interpolation:

```text
elapsed = oracleAge - maxOracleAge
window  = hardStaleAge - maxOracleAge

freshnessBps =
10000 × (window - elapsed) / window
```

Optional: introduce a floor before hard stale. Do not add complexity unless needed.

## 5. Effective collateral value

```text
effectiveCollateral =
rawCollateralValue
× liquidityFactor
× settlementFactor
× freshnessFactor
```

In BPS form:

```text
effectiveCollateral =
rawValue
× liquidityBps / 10000
× settlementBps / 10000
× freshnessBps / 10000
```

Order operations carefully to limit overflow and rounding loss.

## 6. Borrow capacity

```text
borrowCapacity =
effectiveCollateral
× baseLtvBps
/ 10000
```

## 7. Liquidation capacity

```text
liquidationCapacity =
effectiveCollateral
× liquidationLtvBps
/ 10000
```

A position is liquidatable if:

```text
debt > liquidationCapacity
```

## 8. Health factor

Recommended definition:

```text
healthFactor =
liquidationCapacity
/ debt
```

Scaled to `1e18`.

Interpretation:

```text
HF > 1.20  healthy
1.00–1.20  warning
HF < 1.00  liquidatable
```

The UI labels are product choices. The onchain binary liquidation threshold is `1e18`.

If debt is zero:

```text
healthFactor = type(uint256).max
```

or a documented high sentinel.

## 9. Example

Given:

```text
MockTBILL balance      100,000
NAV                    $1.05
raw value              $105,000

liquidity factor       90%
settlement factor      95%
freshness factor       100%
base LTV               75%
liquidation LTV        82%
```

Then:

```text
effective value =
105,000 × .90 × .95
= 89,775

borrow capacity =
89,775 × .75
= 67,331.25

liquidation capacity =
89,775 × .82
= 73,615.50
```

For debt of $50,000:

```text
HF =
73,615.50 / 50,000
≈ 1.47231
```

## 10. Stale-oracle example

If freshness falls to 60%:

```text
effective value =
105,000 × .90 × .95 × .60
= 53,865

borrow capacity =
53,865 × .75
= 40,398.75
```

Existing positions become less safe, but a stale feed should be handled carefully.

### MVP policy

When `oracleAge >= hardStaleAge`:

- new borrowing disabled
- collateral withdrawal disabled if debt exists
- automatic liquidation should **not** rely solely on a completely stale price
- admin/risk state shown clearly

This prevents a dead oracle from blindly triggering destructive liquidation.

## 11. Compliance factor

Do not encode KYC as a numerical score in MVP.

Use:

```text
eligible = true/false
```

If false:

- deposit fails
- borrowing fails
- production transfer may fail anyway

Risk and compliance are separate concepts.

## 12. Risk score in UI

If the frontend displays a 0–100 score, treat it as explanatory analytics rather than the source of onchain LTV.

Preferred:

```text
onchain:
explicit factors and LTV

frontend:
derived labels such as LOW / MEDIUM / HIGH
```

This avoids opaque scoring determining funds.

## 13. Future risk inputs

Post-MVP:

- issuer concentration
- secondary-market depth
- bid/ask spread
- redemption queue depth
- custodian concentration
- reserve attestation freshness
- maturity duration
- depeg exposure
- jurisdiction/compliance constraints
- credit rating inputs
- volatility
- onchain liquidity

Keep these out of the initial contract until each input has a reliable source.
