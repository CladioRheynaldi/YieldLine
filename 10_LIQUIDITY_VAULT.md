# USDC Liquidity Vault

## 1. Purpose

`USDCLiquidityVault` pools MockUSDC from lenders and makes approved liquidity available to the credit vault.

Use ERC-4626 so lender deposits are represented by standardized vault shares.

## 2. Roles

### Lender

Deposits MockUSDC and receives shares.

### Credit vault

Authorized borrower of pooled liquidity at the protocol level.

Individual borrowers never call `lendTo` directly.

## 3. Core accounting

```text
totalAssets
= available USDC
+ outstanding performing loans
+ recognized receivables
- recognized losses
```

Be careful: vanilla ERC-4626 `totalAssets()` must reflect borrowed assets if vault shares are meant to retain their economic value.

For MVP, define this accounting explicitly.

## 4. Available liquidity

```text
availableLiquidity =
MockUSDC.balanceOf(liquidityVault)
```

A lender cannot withdraw more than liquid USDC immediately available.

`maxWithdraw` should reflect this constraint.

## 5. Utilization

```text
utilization =
totalBorrowed
/
(totalBorrowed + availableLiquidity)
```

Scaled in BPS.

Example:

```text
borrowed  = 60,000
available = 40,000
utilization = 60%
```

## 6. Borrow rate

MVP option:

```text
base APR = 3%
slope    = 8%

borrow APR =
base + utilization × slope
```

These are demo parameters.

Alternative:

Use a fixed borrow APR first. This is acceptable if time is short.

## 7. Kink model post-MVP

```text
0% ---------- 80% -------- 100%
 low slope        high slope
```

Use high rates above target utilization to encourage repayment and new deposits.

## 8. Supply rate

Approximation:

```text
supplyAPR =
borrowAPR
× utilization
× (1 - reserveFactor)
```

For MVP frontend analytics only, this can be estimated offchain as long as core balance accounting is onchain.

## 9. Interest distribution

Preferred mechanism:

Borrow interest increases the economic assets of the ERC-4626 vault, increasing the value of each share.

Avoid minting arbitrary yield tokens to lenders.

## 10. Withdrawal liquidity risk

A lender may own economically valuable shares while USDC is currently lent out.

UI should distinguish:

```text
Vault assets
Available liquidity
Utilization
Max withdraw now
```

This is a good teaching point for the workshop.

## 11. Required tests

- first deposit
- multiple depositors
- borrow reduces available cash but not economic total assets
- repayment restores cash
- interest increases share value
- max withdrawal respects liquidity
- no unauthorized `lendTo`
- rounding on small deposits
- full unwind after all loans repaid
