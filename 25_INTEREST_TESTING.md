# Interest Accounting Tests

## 1. Purpose

Verify Person 1's deliverables with contract tests, using simulated time rather than waiting in real time.

Tests deploy fresh MockUSDC, MockTBILL, oracle, registry, risk engine, credit vault, and liquidity vault for every fixture. No wallet, RPC key, or testnet funds are required.

## 2. Prerequisites

Install Git, Node.js 22 or later, and Foundry. Foundry provides `forge` and `anvil`. Windows developers can run the commands in WSL.

Official installation guide: [Foundry installation](https://getfoundry.sh/introduction/installation/).

Clone this repository and enter it:

```bash
git clone https://github.com/CladioRheynaldi/YieldLine.git
cd YieldLine
npm install --prefix contracts --ignore-scripts --package-lock=false
```

If already cloned, update the branch before testing. Contract-only installation is sufficient; installing the frontend workspace is optional for these tests.

## 3. Build and run all tests

Run from the repository root:

```bash
forge build --root contracts
forge test --root contracts -vv
```

This runs existing unit and scenario tests, new interest tests, fuzz tests, and invariants.

The configured fuzz tests use 256 inputs. The invariant campaign uses 64 runs with up to 200 actions each.

## 4. Run Person 1 tests only

```bash
forge test --root contracts --match-contract InterestAccountingTest -vv
```

Trace the worked example:

```bash
forge test --root contracts --match-test testDocumentedOneYearAccountingExample -vvvv
```

Trace repayment or liquidation:

```bash
forge test --root contracts --match-test testPartialRepaymentPreservesEarnedAssets -vvvv
forge test --root contracts --match-test testDeferredSettlementRecognizesAccruedBadDebt -vvvv
```

Run the time-varying invariant campaign:

```bash
forge test --root contracts --match-contract YieldLineInvariantTest -vv
```

## 5. What the tests prove

| Requirement | Test |
|---|---|
| 50,000 debt becomes 53,500 after a year at 7% | `testDocumentedOneYearAccountingExample` |
| No borrower means no earned assets | `testSameBlockAndNoBorrowingEarnNoInterest` |
| Repeated checkpoint calls cannot compound interest | `testPermissionlessCheckpointsDoNotCompound` |
| Partial repayment preserves cash-plus-debt assets | `testPartialRepaymentPreservesEarnedAssets` |
| Full repayment clears interest and debt dust | `testRepayAllClearsAccruedDebtAndStopsEarnings` |
| Caller cannot accidentally overpay | `testOverpaymentCappedAtCurrentDebt` |
| Late deposits do not capture previous yield | `testLateLenderCannotCaptureEarlierInterest` |
| ERC-4626 mint pricing includes accrued interest | `testMintUsesAccruedAssetPrice` |
| Withdrawals reprice future borrowing | `testWithdrawalRepricesFutureRateAfterAccrual` |
| Redeem limits cannot overdraw cash | `testMaxRedeemNeverExceedsCashAfterInterest` |
| Borrowing and collateral withdrawal use current debt | `testBorrowAfterTimeUsesAccruedDebt`, `testCollateralWithdrawalChecksAccruedDebt` |
| Pending liquidations accrue and can be cured | `testPendingLiquidationContinuesAccruingAndCuresInFull` |
| Interest alone can cross liquidation threshold | `testInterestAloneCanCreateLiquidationEligibility` |
| Settlement shortfalls and surplus use accrued debt | deferred settlement tests |
| Borrowers do not inherit earlier interest | `testTwoBorrowersDoNotPayInterestBeforeTheirLoan` |
| The rate curve reaches 3% and 11% | `testRateCurveAtZeroAndFullUtilization` |
| Interest and repayment rounding hold across inputs | two interest fuzz tests |
| Tiny loans fully repay without leftover shares | `testOneMicroUsdcLoanFullRepaymentHasNoDust` |
| Debt, collateral, and token supply remain consistent during time changes | `YieldLineInvariantTest` |

## 6. How simulated time works

The worked example calls:

```solidity
vm.warp(START_TIME + 365 days);
```

Foundry immediately changes the test timestamp. Contract reads must then show:

- debt: 53,500 MockUSDC
- cash: 50,000 MockUSDC
- economic assets: 103,500 MockUSDC
- lender claim: approximately 103,500 MockUSDC

Refreshing a NAV oracle is a separate action. Tests that borrow or withdraw after a year refresh the mock NAV to isolate interest behavior from the existing stale-oracle checks. Repayment remains available with a stale oracle.

Tests explicitly mint demo funds when the borrower needs additional cash to pay interest. The lending contracts never mint that cash.

## 7. Export ABIs

After a successful build:

```bash
node scripts/export-abis.mjs
```

Output: `packages/shared/src/generated/abis.ts`.

These ABIs come from compiled Foundry artifacts, not manually edited function lists.

With the full pnpm workspace installed, `pnpm test` and `pnpm abis` provide the same test/export workflow.

## 8. GitHub Actions

Open the repository's [Actions page](https://github.com/CladioRheynaldi/YieldLine/actions) and select **Smart contract tests**.

The workflow installs dependencies, compiles contracts, runs the full test suite, and exports compiled ABIs. Successful runs publish the **compiled-contracts-and-abis** artifact containing Foundry outputs and generated TypeScript ABIs.

For failures, inspect the first failed step. Use the corresponding `--match-test` command locally with `-vvvv` to reproduce its trace.

## 9. Manual local demo

After deploying fresh contracts on Anvil, advance one year using Anvil's JSON-RPC controls:

```bash
cast rpc evm_increaseTime 31536000 --rpc-url http://127.0.0.1:8545
cast rpc evm_mine --rpc-url http://127.0.0.1:8545
```

Read `currentDebt`, `totalBorrowed`, `totalAssets`, and `availableLiquidity`. They update with time without an accrual transaction.

Approve enough MockUSDC for the current debt, then call `repayAll`. Interest needs real mock-token cash, so fund the demo borrower explicitly through the faucet/admin mint.

A year-old NAV will be stale. Refresh the mock oracle before demonstrating a new borrow or collateral withdrawal with remaining debt.

## 10. Verified result

[GitHub Actions run 37200086523](https://github.com/CladioRheynaldi/YieldLine/actions/runs/37200086523) tested contract commit `dcbbc856621be173986ad3915e62b6b4275d6f33`:

- 113 tests passed; zero failed or skipped
- 21 focused interest tests included
- invariant campaign: 64 runs, 12,800 actions, zero handler reverts
- all nine ABIs exported from the compiled Foundry artifacts

The workflow also checks that committed ABIs match a fresh build. Local shell execution in the authoring session was unavailable; the recorded validation ran on GitHub's Ubuntu runner.
