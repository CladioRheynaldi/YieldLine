// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { RWACreditVault } from "../src/RWACreditVault.sol";
import { YieldLineFixture } from "./YieldLineFixture.sol";

contract InterestAccountingTest is YieldLineFixture {
    address private constant BORROWER_TWO = address(0x2002);

    function _debt() private view returns (uint256) {
        return creditVault.currentDebt(BORROWER, address(tbill));
    }

    function _pay(uint256 amount) private returns (uint256 paid) {
        vm.startPrank(BORROWER);
        usdc.approve(address(creditVault), type(uint256).max);
        paid = creditVault.repay(address(tbill), amount);
        vm.stopPrank();
    }

    function _secondBorrow(uint256 amount) private {
        compliance.setEligibility(address(tbill), BORROWER_TWO, true);
        tbill.mint(BORROWER_TWO, 100_000e18);
        vm.startPrank(BORROWER_TWO);
        tbill.approve(address(creditVault), type(uint256).max);
        creditVault.depositCollateral(address(tbill), 100_000e18);
        creditVault.borrow(address(tbill), amount);
        vm.stopPrank();
    }

    function _settle(uint256 proceeds) private {
        usdc.mint(LIQUIDATOR, proceeds);
        vm.startPrank(LIQUIDATOR);
        usdc.approve(address(creditVault), proceeds);
        creditVault.settleLiquidation(BORROWER, address(tbill), proceeds);
        vm.stopPrank();
    }

    function testDocumentedOneYearAccountingExample() public {
        _openDocumentedPosition();
        assertEq(liquidityVault.borrowRateBps(), 700, "50% utilization => 7%");
        assertEq(liquidityVault.supplyRateBps(), 350, "indicative supply APR 3.5%");
        uint256 supply = usdc.totalSupply();
        uint256 shares = liquidityVault.balanceOf(LENDER);
        vm.warp(START_TIME + 365 days);
        assertEq(_debt(), 53_500e6, "principal + 3500 interest");
        assertEq(liquidityVault.totalBorrowed(), 53_500e6, "same receivable");
        assertEq(liquidityVault.availableLiquidity(), 50_000e6, "cash does not grow");
        assertEq(liquidityVault.totalAssets(), 103_500e6, "cash + current debt");
        assertApproxEq(liquidityVault.convertToAssets(shares), 103_500e6, 1, "share yield");
        assertEq(liquidityVault.balanceOf(LENDER), shares, "no unbacked share mint");
        assertEq(usdc.totalSupply(), supply, "no synthetic USDC mint");
        assertEq(liquidityVault.maxWithdraw(LENDER), 50_000e6, "cash cap");
        assertEq(creditVault.getPosition(BORROWER, address(tbill)).debtAmount, _debt(), "live position read");
        assertEq(creditVault.getAccountRisk(BORROWER, address(tbill)).debtValue, _debt() * 1e12, "risk uses live debt");
    }

    function testSameBlockAndNoBorrowingEarnNoInterest() public {
        _supply(LENDER, 100_000e6);
        vm.warp(START_TIME + 365 days);
        liquidityVault.accrueInterest();
        assertEq(liquidityVault.totalAssets(), 100_000e6, "no borrower no earnings");
        _depositCollateral(100_000e18);
        sourceOracle.setCurrentPrice(address(tbill), NAV);
        _borrow(50_000e6);
        uint256 debt = _debt();
        liquidityVault.accrueInterest();
        liquidityVault.accrueInterest();
        assertEq(_debt(), debt, "same block checkpoint idempotent");
    }

    function testPermissionlessCheckpointsDoNotCompound() public {
        _openDocumentedPosition();
        for (uint256 day = 1; day <= 365; ++day) {
            vm.warp(START_TIME + day * 1 days);
            liquidityVault.accrueInterest();
        }
        assertEq(_debt(), 53_500e6, "caller frequency cannot compound");
    }

    function testPartialRepaymentPreservesEarnedAssets() public {
        _openDocumentedPosition();
        vm.warp(START_TIME + 365 days);
        uint256 assetsBefore = liquidityVault.totalAssets();
        uint256 paid = _pay(20_000e6);
        assertEq(paid, 20_000e6, "exact payable debt reduction");
        assertEq(_debt(), 33_500e6, "interest included before payment");
        assertEq(liquidityVault.availableLiquidity(), 70_000e6, "payment now liquid");
        assertEq(liquidityVault.totalAssets(), assetsBefore, "cash replaces receivable");
        assertEq(liquidityVault.totalBorrowed(), _debt(), "single position reconciles");
        assertEq(liquidityVault.borrowRateBps(), 558, "rate repriced after repayment");
    }

    function testRepayAllClearsAccruedDebtAndStopsEarnings() public {
        _openDocumentedPosition();
        vm.warp(START_TIME + 365 days);
        usdc.mint(BORROWER, 3_500e6);
        vm.startPrank(BORROWER);
        usdc.approve(address(creditVault), type(uint256).max);
        uint256 paid = creditVault.repayAll(address(tbill));
        creditVault.withdrawCollateral(address(tbill), 100_000e18);
        vm.stopPrank();
        assertEq(paid, 53_500e6, "repayAll covers principal and interest");
        assertEq(_debt(), 0, "no remaining debt dust");
        assertEq(liquidityVault.totalDebtShares(), 0, "no remaining shares");
        assertEq(liquidityVault.totalAssets(), 103_500e6, "realized earnings");
        vm.warp(block.timestamp + 365 days);
        assertEq(liquidityVault.totalAssets(), 103_500e6, "no ghost accrual");
    }

    function testOverpaymentCappedAtCurrentDebt() public {
        _openDocumentedPosition();
        vm.warp(START_TIME + 365 days);
        usdc.mint(BORROWER, 100_000e6);
        assertEq(_pay(type(uint256).max), 53_500e6, "only current debt paid");
        assertEq(usdc.balanceOf(BORROWER), 96_500e6, "excess retained");
    }

    function testLateLenderCannotCaptureEarlierInterest() public {
        _openDocumentedPosition();
        vm.warp(START_TIME + 365 days);
        usdc.mint(LENDER_TWO, 103_500e6);
        uint256 beforeValue = liquidityVault.convertToAssets(liquidityVault.balanceOf(LENDER));
        uint256 quoted = liquidityVault.previewDeposit(103_500e6);
        uint256 secondShares = _supply(LENDER_TWO, 103_500e6);
        assertEq(secondShares, quoted, "deposit preview agrees");
        assertApproxEq(liquidityVault.convertToAssets(secondShares), 103_500e6, 1, "pays current share price");
        assertApproxEq(liquidityVault.convertToAssets(liquidityVault.balanceOf(LENDER)), beforeValue, 1, "first earnings preserved");
        assertEq(liquidityVault.borrowRateBps(), 506, "deposit lowers utilization");
    }

    function testMintUsesAccruedAssetPrice() public {
        _openDocumentedPosition();
        vm.warp(START_TIME + 365 days);
        uint256 shares = 10_000e9;
        uint256 assets = liquidityVault.previewMint(shares);
        usdc.mint(LENDER_TWO, assets);
        vm.startPrank(LENDER_TWO);
        usdc.approve(address(liquidityVault), assets);
        assertEq(liquidityVault.mint(shares, LENDER_TWO), assets, "mint preview agrees");
        vm.stopPrank();
        assertEq(liquidityVault.balanceOf(LENDER_TWO), shares, "exact requested shares");
        assertApproxEq(liquidityVault.convertToAssets(shares), assets, 1, "ceil funding floor redemption");
    }

    function testWithdrawalRepricesFutureRateAfterAccrual() public {
        _openDocumentedPosition();
        vm.warp(START_TIME + 365 days);
        vm.prank(LENDER);
        liquidityVault.withdraw(25_000e6, LENDER, LENDER);
        assertEq(_debt(), 53_500e6, "withdrawal does not change debt today");
        assertEq(liquidityVault.availableLiquidity(), 25_000e6, "remaining cash");
        assertEq(liquidityVault.borrowRateBps(), 845, "less cash higher APR");
        vm.warp(block.timestamp + 365 days);
        assertEq(_debt(), 58_020_750_000, "future interval uses 8.45%");
    }

    function testMaxRedeemNeverExceedsCashAfterInterest() public {
        _openDocumentedPosition();
        vm.warp(START_TIME + 31 days + 1);
        uint256 cash = liquidityVault.availableLiquidity();
        uint256 shares = liquidityVault.maxRedeem(LENDER);
        uint256 expected = liquidityVault.previewRedeem(shares);
        assertLe(expected, cash, "no ceiling overdraw");
        vm.prank(LENDER);
        assertEq(liquidityVault.redeem(shares, LENDER, LENDER), expected, "maxRedeem executable");
        assertEq(liquidityVault.availableLiquidity(), cash - expected, "only funded cash exits");
    }

    function testBorrowAfterTimeUsesAccruedDebt() public {
        _openDocumentedPosition();
        vm.warp(START_TIME + 365 days);
        sourceOracle.setCurrentPrice(address(tbill), NAV);
        vm.prank(BORROWER);
        vm.expectRevert(RWACreditVault.InsufficientCollateral.selector);
        creditVault.borrow(address(tbill), 14_000e6);
        // Principal-only accounting would have incorrectly allowed 64,000.
        assertEq(_debt(), 53_500e6, "failed borrow preserves accrued debt");
        _borrow(1_000e6);
        assertApproxEq(_debt(), 54_500e6, 1, "new principal added at current index");
        assertApproxEq(liquidityVault.totalAssets(), 103_500e6, 1, "loan does not mint yield");
    }

    function testCollateralWithdrawalChecksAccruedDebt() public {
        _openDocumentedPosition();
        vm.warp(START_TIME + 365 days);
        sourceOracle.setCurrentPrice(address(tbill), NAV);
        vm.prank(BORROWER);
        vm.expectRevert(RWACreditVault.UnsafeWithdrawal.selector);
        creditVault.withdrawCollateral(address(tbill), 22_000e18);
        // Remaining 78k collateral supports principal, but not accrued debt.
    }

    function testPendingLiquidationContinuesAccruingAndCuresInFull() public {
        _openDocumentedPosition();
        sourceOracle.setCurrentPrice(address(tbill), 0.3e18);
        creditVault.initiateLiquidation(BORROWER, address(tbill));
        vm.warp(START_TIME + 365 days);
        usdc.mint(BORROWER, 3_500e6);
        vm.startPrank(BORROWER);
        usdc.approve(address(creditVault), type(uint256).max);
        assertEq(creditVault.repayAll(address(tbill)), 53_500e6, "pending interest repaid");
        vm.stopPrank();
        assertEq(uint256(_status()), uint256(RWACreditVault.PositionStatus.ACTIVE), "full cure");
        assertEq(liquidityVault.totalBadDebt(), 0, "no artificial loss");
    }

    function testInterestAloneCanCreateLiquidationEligibility() public {
        _openDocumentedPosition();
        // Liquidation value exceeds initial 50k debt but is below 53.5k.
        sourceOracle.setCurrentPrice(address(tbill), 0.75e18);
        assertFalse(creditVault.getAccountRisk(BORROWER, address(tbill)).liquidatable, "initially healthy");
        vm.warp(START_TIME + 365 days);
        sourceOracle.setCurrentPrice(address(tbill), 0.75e18);
        assertTrue(creditVault.getAccountRisk(BORROWER, address(tbill)).liquidatable, "interest makes unhealthy");
        creditVault.initiateLiquidation(BORROWER, address(tbill));
    }

    function testDeferredSettlementRecognizesAccruedBadDebt() public {
        _openDocumentedPosition();
        sourceOracle.setCurrentPrice(address(tbill), 0.3e18);
        creditVault.initiateLiquidation(BORROWER, address(tbill));
        vm.warp(START_TIME + 365 days);
        _settle(40_000e6);
        assertEq(_debt(), 0, "all position debt removed");
        assertEq(liquidityVault.totalBorrowed(), 0, "all receivables removed");
        assertEq(liquidityVault.totalBadDebt(), 13_500e6, "interest in shortfall");
        assertEq(liquidityVault.totalAssets(), 90_000e6, "cash remaining after loss");
    }

    function testDeferredSettlementSurplusUsesCurrentDebt() public {
        _openDocumentedPosition();
        sourceOracle.setCurrentPrice(address(tbill), 0.3e18);
        creditVault.initiateLiquidation(BORROWER, address(tbill));
        vm.warp(START_TIME + 365 days);
        _settle(60_000e6);
        assertEq(usdc.balanceOf(BORROWER), 56_500e6, "6500 surplus after accrued debt");
        assertEq(liquidityVault.totalAssets(), 103_500e6, "interest paid in cash");
        assertEq(liquidityVault.totalBadDebt(), 0, "fully covered");
    }

    function testTwoBorrowersDoNotPayInterestBeforeTheirLoan() public {
        _openDocumentedPosition();
        vm.warp(START_TIME + 365 days);
        sourceOracle.setCurrentPrice(address(tbill), NAV);
        uint256 first = _debt();
        _secondBorrow(20_000e6);
        uint256 second = creditVault.currentDebt(BORROWER_TWO, address(tbill));
        assertEq(_debt(), first, "first debt unchanged at second origination");
        assertApproxEq(second, 20_000e6, 1, "second owes no historical interest");
        uint256 aggregate = liquidityVault.totalBorrowed();
        assertLe(aggregate, first + second, "aggregate backed by borrower debts");
        assertLe(first + second - aggregate, 1, "two-loan rounding at most one micro-USDC");
        vm.warp(block.timestamp + 30 days);
        first = _debt();
        second = creditVault.currentDebt(BORROWER_TWO, address(tbill));
        aggregate = liquidityVault.totalBorrowed();
        assertLe(aggregate, first + second, "live aggregate remains backed");
        assertLe(first + second - aggregate, 1, "rounding bounded");
        usdc.mint(BORROWER_TWO, second);
        vm.startPrank(BORROWER_TWO);
        usdc.approve(address(creditVault), type(uint256).max);
        creditVault.repayAll(address(tbill));
        vm.stopPrank();
        assertEq(liquidityVault.totalBorrowed(), first, "other borrower debt survives");
    }

    function testRateCurveAtZeroAndFullUtilization() public {
        assertEq(liquidityVault.borrowRateBps(), 300, "base rate");
        _openDocumentedPosition();
        vm.prank(LENDER);
        liquidityVault.withdraw(50_000e6, LENDER, LENDER);
        assertEq(liquidityVault.utilizationBps(), 10_000, "100% utilization");
        assertEq(liquidityVault.borrowRateBps(), 1_100, "maximum 11%");
        assertEq(liquidityVault.maxWithdraw(LENDER), 0, "no available cash");
    }

    function testFuzzLinearInterest(uint256 elapsed) public {
        elapsed = bound(elapsed, 0, 10 * 365 days);
        _openDocumentedPosition();
        vm.warp(START_TIME + elapsed);
        // Independent rational expectation; any remaining fraction is collectible
        // as at most one MockUSDC base unit (0.000001 USDC).
        uint256 numerator = 50_000e6 * 700 * elapsed;
        uint256 denominator = 10_000 * 365 days;
        uint256 expected = 50_000e6 + (numerator + denominator - 1) / denominator;
        assertEq(_debt(), expected, "linear interest rounds up once");
        assertEq(liquidityVault.totalBorrowed(), expected, "aggregate single loan");
    }

    function testFuzzPartialRepaymentAndRounding(uint256 elapsed, uint256 amount) public {
        elapsed = bound(elapsed, 1, 365 days);
        _openDocumentedPosition();
        vm.warp(START_TIME + elapsed);
        uint256 beforeDebt = _debt();
        amount = bound(amount, 2, 50_000e6);
        uint256 assetsBefore = liquidityVault.totalAssets();
        uint256 paid = _pay(amount);
        assertEq(paid, amount, "requested partial payment exactly retires rounded debt");
        assertEq(_debt(), beforeDebt - paid, "every paid unit retires debt");
        assertEq(liquidityVault.totalAssets(), assetsBefore, "no ghost assets on payment");
    }

    function testOneMicroUsdcLoanFullRepaymentHasNoDust() public {
        _supply(LENDER, 100_000e6);
        _depositCollateral(100_000e18);
        _borrow(1);
        vm.warp(START_TIME + 1);
        assertEq(_debt(), 2, "fractional interest rounded once to base unit");
        usdc.mint(BORROWER, 1);
        assertEq(_pay(type(uint256).max), 2, "tiny loan clears fully");
        assertEq(liquidityVault.totalDebtShares(), 0, "no dust receivable");
    }
}
