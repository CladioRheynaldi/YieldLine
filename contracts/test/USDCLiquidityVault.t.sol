// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { USDCLiquidityVault } from "../src/USDCLiquidityVault.sol";
import { YieldLineFixture } from "./YieldLineFixture.sol";

contract USDCLiquidityVaultTest is YieldLineFixture {
    function testFirstDepositMintsShares() public {
        uint256 expected = liquidityVault.previewDeposit(100_000e6);
        uint256 shares = _supply(LENDER, 100_000e6);
        assertEq(shares, expected, "preview matches");
        assertEq(liquidityVault.balanceOf(LENDER), shares, "shares minted");
        assertEq(liquidityVault.totalAssets(), 100_000e6, "assets");
        assertEq(liquidityVault.decimals(), 9, "6 + offset 3");
    }

    function testMultipleLendersShareProportionally() public {
        usdc.mint(LENDER_TWO, 50_000e6);
        uint256 first = _supply(LENDER, 100_000e6);
        uint256 second = _supply(LENDER_TWO, 50_000e6);
        assertEq(first, second * 2, "proportional shares");
        assertEq(liquidityVault.convertToAssets(second), 50_000e6, "second lender value");
    }

    function testBorrowReducesCashButNotEconomicAssets() public {
        _openDocumentedPosition();
        assertEq(liquidityVault.availableLiquidity(), 50_000e6, "cash");
        assertEq(liquidityVault.totalBorrowed(), 50_000e6, "receivable");
        assertEq(liquidityVault.totalAssets(), 100_000e6, "economic assets unchanged");
        assertEq(liquidityVault.utilizationBps(), 5_000, "utilization");
    }

    function testMaxWithdrawRespectsLiquidity() public {
        _openDocumentedPosition();
        assertEq(liquidityVault.maxWithdraw(LENDER), 50_000e6, "bounded by cash");
        assertApproxEq(
            liquidityVault.convertToAssets(liquidityVault.maxRedeem(LENDER)),
            50_000e6,
            1,
            "redeem bounded by cash"
        );

        vm.prank(LENDER);
        vm.expectRevert();
        liquidityVault.withdraw(50_000e6 + 1, LENDER, LENDER);

        vm.prank(LENDER);
        liquidityVault.withdraw(50_000e6, LENDER, LENDER);
        assertEq(usdc.balanceOf(LENDER), 50_000e6, "partial exit");
    }

    function testRepaymentRestoresCash() public {
        _openDocumentedPosition();
        vm.startPrank(BORROWER);
        usdc.approve(address(creditVault), 20_000e6);
        creditVault.repay(address(tbill), 20_000e6);
        vm.stopPrank();

        assertEq(liquidityVault.availableLiquidity(), 70_000e6, "cash restored");
        assertEq(liquidityVault.totalBorrowed(), 30_000e6, "receivable reduced");
        assertEq(liquidityVault.totalAssets(), 100_000e6, "economic assets unchanged");
    }

    function testBadDebtReducesShareValue() public {
        _openDocumentedPosition();
        sourceOracle.setCurrentPrice(address(tbill), 0.3e18);
        creditVault.initiateLiquidation(BORROWER, address(tbill));

        usdc.mint(LIQUIDATOR, 40_000e6);
        vm.startPrank(LIQUIDATOR);
        usdc.approve(address(creditVault), 40_000e6);
        creditVault.settleLiquidation(BORROWER, address(tbill), 40_000e6);
        vm.stopPrank();

        assertEq(liquidityVault.totalBadDebt(), 10_000e6, "bad debt visible");
        assertEq(liquidityVault.totalAssets(), 90_000e6, "loss socialized to lenders");
        assertApproxEq(
            liquidityVault.convertToAssets(liquidityVault.balanceOf(LENDER)),
            90_000e6,
            1,
            "lender absorbs loss"
        );
    }

    function testUnauthorizedDraw() public {
        _supply(LENDER, 100_000e6);
        bytes memory expected = abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector,
            BORROWER,
            liquidityVault.CREDIT_VAULT_ROLE()
        );

        vm.prank(BORROWER);
        vm.expectRevert(expected);
        liquidityVault.lendTo(BORROWER, 1e6);

        vm.prank(BORROWER);
        vm.expectRevert(expected);
        liquidityVault.recordRepayment(1e6, 1e6);

        vm.prank(BORROWER);
        vm.expectRevert(expected);
        liquidityVault.recognizeBadDebt(1e6);
    }

    function testAccountingGuards() public {
        _supply(LENDER, 100_000e6);
        liquidityVault.grantRole(liquidityVault.CREDIT_VAULT_ROLE(), address(this));

        vm.expectRevert(USDCLiquidityVault.InvalidAccountingAmount.selector);
        liquidityVault.recordRepayment(1, 1);

        vm.expectRevert(USDCLiquidityVault.InvalidAccountingAmount.selector);
        liquidityVault.recognizeBadDebt(1);

        vm.expectRevert(USDCLiquidityVault.ZeroAddress.selector);
        liquidityVault.lendTo(address(0), 1);
    }

    function testSmallDepositRounding() public {
        usdc.mint(LENDER_TWO, 1);
        uint256 shares = _supply(LENDER_TWO, 1);
        assertGe(shares, 1, "one unit mints shares");
        assertEq(liquidityVault.previewRedeem(shares), 1, "one unit redeemable");
    }

    function testFuzzDepositWithdrawRoundTrip(uint256 amount) public {
        amount = bound(amount, 1, 100_000e6);
        _supply(LENDER, amount);
        uint256 shares = liquidityVault.balanceOf(LENDER);
        vm.prank(LENDER);
        liquidityVault.redeem(shares, LENDER, LENDER);
        assertEq(usdc.balanceOf(LENDER), 100_000e6, "no value created or lost");
    }
}
