# Interest Accounting

## 1. Product

Name: YieldLine

Scope: Person 1 — interest accounting and smart contracts

Network: local Anvil and Arbitrum Sepolia for the MVP

Settlement token: MockUSDC, 6 decimals

Lender shares: ERC-4626 ylmUSDC, 9 decimals

Debt shares: internal accounting units, 24 decimals; these are not transferable tokens.

## 2. Rate model

The deployed demo constants are:

- base APR: 300 BPS, or 3%
- utilization slope: 800 BPS, or 8%
- reserve factor: 0 BPS
- year: 365 days, or 31,536,000 seconds

```text
utilizationBps = floor(currentReceivables × 10,000 / totalAssets)
borrowRateBps = 300 + floor(utilizationBps × 800 / 10,000)
indicativeSupplyRateBps = floor(checkpointBorrowRateBps × liveUtilizationBps / 10,000)
```

Zero utilization gives a 3% borrow APR. Full utilization gives 11%.

Rates are fixed between economic checkpoints. Deposits, mints, withdrawals, redeems, borrowing, repayment, and debt write-offs set the rate for the next interval using the resulting utilization. An oracle update or collateral-only action does not reprice the pool.

The stored `borrowRateBps()` is the rate actually applied to the current interval. Live utilization can change as interest grows, so recomputing the curve offchain between checkpoints can produce a different number. Display the contract rate.

These constants are demo assumptions, not investment recommendations. There is no fee recipient or reserve allocation in this implementation.

## 3. Accrual timing

Within one rate interval:

```text
RAY = 10^27
index(t) = anchorIndex
         + floor(anchorIndex × rateBps × elapsedSeconds / (10,000 × YEAR))
```

Economic checkpoints carry the current index into the next interval. This compounds accrued debt across economic intervals, while growth inside each interval is linear.

Anyone can call `accrueInterest()` to record the current index and emit an event. That call does not change the rate anchor. Repeated calls cannot generate additional compounding, and same-block calls are idempotent.

Borrower reads, account-risk reads, ERC-4626 previews, and `totalAssets()` include current interest even if nobody sends a checkpoint transaction.

The credit vault checkpoints before borrow, repay, collateral withdrawal, liquidation initiation, and liquidation settlement. ERC-4626 deposit/mint and withdraw/redeem share conversions use live debt; their internal hooks checkpoint before moving cash and reprice after the movement.

Interest continues while liquidation is pending. Full repayment before settlement cures the position. Pausing new borrowing does not stop interest or prevent repayment.

## 4. Debt shares and rounding

One shared index serves all positions. A new borrower receives debt shares at the current index and does not inherit interest earned before their loan.

```text
DEBT_DENOMINATOR = RAY × 10^18 = 10^45
newDebtShares = ceil(borrowedUSDCUnits × DEBT_DENOMINATOR / index)
currentDebt = ceil(positionDebtShares × index / DEBT_DENOMINATOR)
aggregateReceivables = ceil(totalDebtShares × index / DEBT_DENOMINATOR)
```

All arithmetic uses Solidity integers and OpenZeppelin `Math.mulDiv`. No floating-point arithmetic is used onchain.

Borrow shares and collectible debt round up. Index growth and utilization round down. Lender conversions retain OpenZeppelin ERC-4626 preview rounding and virtual assets/shares.

For a partial payment, the credit vault calculates remaining shares by rounding down the shares corresponding to `currentDebt - requestedPayment`. It collects the exact decrease in rounded debt, capped by the caller's amount. This can waive a fractional base unit; it never collects cash without reducing the displayed liability. The high precision of debt shares keeps that concession below one MockUSDC base unit for supported demo ranges. Full repayment removes every position debt share.

One base unit is 0.000001 MockUSDC. Origination may round collectible debt up by one base unit. That unit is backed by the borrower's rounded liability.

With N nonzero positions, aggregate rounded receivables are no greater than the sum of rounded position debts; their difference is at most N - 1 base units. Removing a position can shift aggregate rounding by one base unit. The pool uses aggregate receivable reduction for its loss accounting. Liquidation events report the individual position shortfall.

## 5. Lender accounting

```text
availableLiquidity = MockUSDC.balanceOf(liquidityVault)
totalBorrowed = current aggregate principal-and-interest receivables
totalAssets = availableLiquidity + totalBorrowed
```

Unpaid interest is a borrower liability, not newly minted USDC. It increases the value of existing lender shares.

Repayment converts receivables into cash. It does not add the same interest to assets a second time. A lender depositing later pays the current share price and cannot capture earlier interest.

Bad debt removes outstanding debt shares and reduces receivables immediately. `totalBadDebt` records cumulative gross receivable write-offs, including uncollected interest; it is not subtracted again from `totalAssets()`.

`maxWithdraw` is capped by both the lender's economic claim and vault cash. `maxRedeem` uses a conservative floor conversion of available cash, preventing a ceiling conversion from permitting an unfunded redemption. That conservative bound can leave one base unit of otherwise redeemable cash in the demo's share-price range.

ERC-4626 virtual assets/shares can leave one base unit of rounding dust on a complete lender exit.

## 6. Accounting example

Assume one lender supplies 100,000 MockUSDC and one borrower borrows 50,000. No economic state changes occur during the following year.

| Step | Borrower debt | Vault cash | Receivables | Economic assets |
|---|---:|---:|---:|---:|
| Lender supplies | 0 | 100,000 | 0 | 100,000 |
| Borrower takes loan | 50,000 | 50,000 | 50,000 | 100,000 |
| After 365 days at 7% | 53,500 | 50,000 | 53,500 | 103,500 |
| Borrower repays 20,000 | 33,500 | 70,000 | 33,500 | 103,500 |
| Borrower repays all remaining debt | 0 | 103,500 | 0 | 103,500 |

At origination, utilization is 50%, giving 3% + 50% × 8% = 7% borrow APR. The indicative supply APR is 3.5%.

After one year, the same lender shares represent approximately 103,500 MockUSDC, subject to ERC-4626 rounding. Only 50,000 is available to withdraw before repayment.

The 20,000 partial payment reprices the next interval to 558 BPS (5.58%) after integer rounding. If time advances again before full repayment, additional interest is owed.

For a separate liquidation example, settlement of 40,000 after the first year leaves 13,500 in gross bad debt. Receivables become zero; cash and assets become 90,000. The principal loss is 10,000, and the previously recognized 3,500 interest is also written off.

Settlement of 60,000 instead pays 53,500 debt and returns 6,500 surplus to the borrower.

## 7. Contract integration

Borrower approvals go to `RWACreditVault`. Repayment cash moves directly from borrower to `USDCLiquidityVault`; the credit vault then records payment and burns the exact debt shares.

Read:

- `RWACreditVault.currentDebt(borrower, asset)`
- `RWACreditVault.getPosition(borrower, asset)` for live debt and position status
- `RWACreditVault.getAccountRisk(borrower, asset)` for risk using current debt
- `USDCLiquidityVault.currentBorrowIndex()`
- `USDCLiquidityVault.borrowRateBps()`
- `USDCLiquidityVault.supplyRateBps()`
- `USDCLiquidityVault.totalBorrowed()`
- `USDCLiquidityVault.totalAssets()`
- `USDCLiquidityVault.availableLiquidity()`

Internal APIs changed: `lendTo` returns debt shares; `recordRepayment` takes assets and shares burned; `recognizeBadDebt` takes shares burned and returns the aggregate loss. These are restricted to the credit-vault role.

## 8. Delivery limits

The contracts are non-upgradeable. Existing addresses in deployment JSON files still point to the earlier deployment; redeploy this version and regenerate the deployment mapping and ABIs before using it.

The frontend APR presentation and live polling belong to Person 2's integration task. The new read methods and exported ABIs are provided for that work.

This implementation has automated tests but has not received an independent security audit. The model continues to value pending liquidation debt as a receivable until settlement records a loss.

See [25_INTEREST_TESTING.md](25_INTEREST_TESTING.md) for test commands.
