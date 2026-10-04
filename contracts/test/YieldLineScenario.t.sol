// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { MockTBILL } from "../src/mocks/MockTBILL.sol";
import { RWACreditVault } from "../src/RWACreditVault.sol";
import { USDCLiquidityVault } from "../src/USDCLiquidityVault.sol";
import { IRWARiskEngine } from "../src/interfaces/IRWARiskEngine.sol";
import { YieldLineFixture } from "./YieldLineFixture.sol";

contract YieldLineScenarioTest is YieldLineFixture {
    function testDocumentedRiskExample() public view {
        IRWARiskEngine.RiskResult memory risk =
            riskEngine.evaluate(BORROWER, address(tbill), 100_000e18, 50_000e6);

        assertEq(risk.rawCollateralValue, 105_000e18, "raw value");
        assertEq(risk.effectiveCollateralValue, 89_775e18, "effective value");
        assertEq(risk.borrowCapacity, 67_331.25e18, "borrow capacity");
        assertEq(risk.liquidationCapacity, 73_615.5e18, "liquidation capacity");
        assertEq(risk.healthFactor, 1.47231e18, "health factor");
        assertTrue(risk.oracleValid, "fresh oracle is valid");
        assertTrue(risk.canBorrow, "fresh eligible account should borrow");
        assertFalse(risk.liquidatable, "documented position should be healthy");
    }

    /// Scenario A — happy path.
    function testScenarioHappyPath() public {
        _supply(LENDER, 100_000e6);
        _depositCollateral(100_000e18);
        _borrow(50_000e6);

        vm.warp(block.timestamp + 12 hours);

        vm.startPrank(BORROWER);
        usdc.approve(address(creditVault), 50_000e6);
        creditVault.repayAll(address(tbill));
        creditVault.withdrawCollateral(address(tbill), 100_000e18);
        vm.stopPrank();

        RWACreditVault.Position memory position = creditVault.getPosition(BORROWER, address(tbill));
        assertEq(uint256(position.status), uint256(RWACreditVault.PositionStatus.CLOSED), "closed");
        assertEq(tbill.balanceOf(BORROWER), 100_000e18, "collateral returned");
        assertEq(liquidityVault.totalBorrowed(), 0, "no receivable");
        assertEq(liquidityVault.availableLiquidity(), 100_000e6, "cash restored");

        vm.prank(LENDER);
        liquidityVault.withdraw(100_000e6, LENDER, LENDER);
        assertEq(usdc.balanceOf(LENDER), 100_000e6, "lender fully unwound");
    }

    /// Scenario B — stale oracle degrades, then disables, borrowing.
    function testScenarioStaleOracle() public {
        _openDocumentedPosition();

        IRWARiskEngine.RiskResult memory fresh =
            creditVault.getAccountRisk(BORROWER, address(tbill));

        vm.warp(block.timestamp + 48 hours);
        IRWARiskEngine.RiskResult memory degraded =
            creditVault.getAccountRisk(BORROWER, address(tbill));
        assertEq(degraded.freshnessFactorBps, 5_000, "halfway through the stale window");
        assertLe(degraded.borrowCapacity, fresh.borrowCapacity, "capacity falls with age");
        assertTrue(degraded.canBorrow, "degraded oracle still permits bounded borrowing");

        vm.expectRevert(RWACreditVault.InsufficientCollateral.selector);
        _borrow(1_000e6);

        vm.warp(START_TIME + 72 hours);
        IRWARiskEngine.RiskResult memory stale =
            creditVault.getAccountRisk(BORROWER, address(tbill));
        assertEq(stale.freshnessFactorBps, 0, "hard stale");
        assertFalse(stale.canBorrow, "hard stale blocks borrowing");
        assertFalse(stale.liquidatable, "stale data alone never liquidates");

        vm.expectRevert(RWACreditVault.OracleHardStale.selector);
        _borrow(1e6);

        vm.expectRevert(RWACreditVault.NotLiquidatable.selector);
        creditVault.initiateLiquidation(BORROWER, address(tbill));

        sourceOracle.setCurrentPrice(address(tbill), NAV);
        _borrow(1_000e6);
    }

    /// Scenario C — NAV shock, deferred liquidation, settlement.
    function testScenarioNavShockSettlement() public {
        _openDocumentedPosition();

        assertEq(usdc.balanceOf(BORROWER), 50_000e6, "borrower receives liquidity");

        sourceOracle.setCurrentPrice(address(tbill), 0.6e18);
        IRWARiskEngine.RiskResult memory shocked =
            creditVault.getAccountRisk(BORROWER, address(tbill));
        assertTrue(shocked.liquidatable, "NAV shock should cross liquidation threshold");
        assertLe(shocked.healthFactor, 1e18, "HF below one");

        creditVault.initiateLiquidation(BORROWER, address(tbill));
        assertEq(
            uint256(_status()),
            uint256(RWACreditVault.PositionStatus.LIQUIDATION_PENDING),
            "pending status"
        );

        usdc.mint(LIQUIDATOR, 50_000e6);
        vm.startPrank(LIQUIDATOR);
        usdc.approve(address(creditVault), 50_000e6);
        creditVault.settleLiquidation(BORROWER, address(tbill), 50_000e6);
        vm.stopPrank();

        RWACreditVault.Position memory closed = creditVault.getPosition(BORROWER, address(tbill));
        assertEq(uint256(closed.status), uint256(RWACreditVault.PositionStatus.CLOSED), "closed");
        assertEq(closed.debtAmount, 0, "debt cleared");
        assertEq(closed.collateralAmount, 0, "collateral settled");
        assertEq(liquidityVault.totalBorrowed(), 0, "vault receivable cleared");
        assertEq(liquidityVault.totalAssets(), 100_000e6, "lenders made whole");
        assertEq(tbill.balanceOf(address(creditVault)), 0, "collateral redeemed");
        assertEq(creditVault.totalCollateralByAsset(address(tbill)), 0, "collateral accounting");
    }

    /// Scenario D — borrow larger than pool cash.
    function testScenarioLiquidityShortage() public {
        _supply(LENDER, 10_000e6);
        _depositCollateral(100_000e18);

        vm.expectRevert(USDCLiquidityVault.InsufficientLiquidity.selector);
        _borrow(20_000e6);

        _borrow(10_000e6);
        assertEq(liquidityVault.utilizationBps(), 10_000, "fully utilized");
        assertEq(liquidityVault.maxWithdraw(LENDER), 0, "no cash to withdraw");
    }

    function testPermissionedTransferRejectsIneligibleRecipient() public {
        vm.prank(BORROWER);
        vm.expectRevert(abi.encodeWithSelector(MockTBILL.AccountNotEligible.selector, INELIGIBLE));
        tbill.transfer(INELIGIBLE, 1e18);
    }
}
