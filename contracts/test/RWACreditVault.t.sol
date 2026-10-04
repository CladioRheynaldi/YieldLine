// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { RWACreditVault } from "../src/RWACreditVault.sol";
import { IRWARegistry } from "../src/interfaces/IRWARegistry.sol";
import { YieldLineFixture } from "./YieldLineFixture.sol";

contract RWACreditVaultTest is YieldLineFixture {
    uint256 private constant CAPACITY = 67_331.25e6;

    function setUp() public override {
        super.setUp();
        _supply(LENDER, 100_000e6);
    }

    // ---------------------------------------------------------------- deposit

    function testDeposit() public {
        _depositCollateral(100_000e18);
        RWACreditVault.Position memory position = creditVault.getPosition(BORROWER, address(tbill));
        assertEq(position.collateralAmount, 100_000e18, "collateral recorded");
        assertEq(uint256(position.status), uint256(RWACreditVault.PositionStatus.ACTIVE), "active");
        assertEq(tbill.balanceOf(address(creditVault)), 100_000e18, "custodied");
        assertEq(creditVault.totalCollateralByAsset(address(tbill)), 100_000e18, "total");
    }

    function testDepositUnsupportedAsset() public {
        vm.prank(BORROWER);
        vm.expectRevert(RWACreditVault.UnsupportedAsset.selector);
        creditVault.depositCollateral(address(usdc), 1e6);
    }

    function testDepositZeroAmount() public {
        vm.prank(BORROWER);
        vm.expectRevert(RWACreditVault.ZeroAmount.selector);
        creditVault.depositCollateral(address(tbill), 0);
    }

    function testIneligibleDeposit() public {
        compliance.setEligibility(address(tbill), BORROWER, false);
        vm.prank(BORROWER);
        vm.expectRevert(RWACreditVault.AccountNotEligible.selector);
        creditVault.depositCollateral(address(tbill), 1e18);
    }

    function testDepositRespectsSupplyCap() public {
        IRWARegistry.AssetConfig memory config = defaultConfig();
        config.supplyCap = 50_000e18;
        registry.setAssetConfig(address(tbill), config);

        vm.startPrank(BORROWER);
        tbill.approve(address(creditVault), 100_000e18);
        vm.expectRevert(RWACreditVault.SupplyCapExceeded.selector);
        creditVault.depositCollateral(address(tbill), 50_000e18 + 1);
        creditVault.depositCollateral(address(tbill), 50_000e18);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------- borrow

    function testBorrowUnderLimit() public {
        _depositCollateral(100_000e18);
        _borrow(50_000e6);
        assertEq(creditVault.getPosition(BORROWER, address(tbill)).debtAmount, 50_000e6, "debt");
        assertEq(usdc.balanceOf(BORROWER), 50_000e6, "received");
    }

    function testBorrowExactlyAtLimit() public {
        _depositCollateral(100_000e18);
        _borrow(CAPACITY);
        assertEq(creditVault.getPosition(BORROWER, address(tbill)).debtAmount, CAPACITY, "at cap");
    }

    function testBorrowOneUnitAboveLimit() public {
        _depositCollateral(100_000e18);
        vm.expectRevert(RWACreditVault.InsufficientCollateral.selector);
        _borrow(CAPACITY + 1);
    }

    function testBorrowWithoutPosition() public {
        vm.expectRevert(RWACreditVault.PositionNotActive.selector);
        _borrow(1e6);
    }

    function testBorrowWithInvalidOracle() public {
        _depositCollateral(100_000e18);
        sourceOracle.setValid(address(tbill), false);
        vm.expectRevert(RWACreditVault.OracleInvalid.selector);
        _borrow(1e6);
    }

    function testBorrowWithHardStaleOracle() public {
        _depositCollateral(100_000e18);
        vm.warp(block.timestamp + 72 hours);
        vm.expectRevert(RWACreditVault.OracleHardStale.selector);
        _borrow(1e6);
    }

    function testBorrowingDisabledInRegistry() public {
        _depositCollateral(100_000e18);
        registry.setBorrowingEnabled(address(tbill), false);
        vm.expectRevert(RWACreditVault.BorrowingDisabled.selector);
        _borrow(1e6);
    }

    function testBorrowAfterEligibilityRevoked() public {
        _depositCollateral(100_000e18);
        compliance.setEligibility(address(tbill), BORROWER, false);
        vm.expectRevert(RWACreditVault.AccountNotEligible.selector);
        _borrow(1e6);
    }

    function testPausedBlocksNewRiskButNotRepayOrWithdraw() public {
        _depositCollateral(100_000e18);
        _borrow(10_000e6);
        creditVault.pause();

        vm.expectRevert(Pausable.EnforcedPause.selector);
        _borrow(1e6);

        vm.prank(BORROWER);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        creditVault.depositCollateral(address(tbill), 1e18);

        vm.startPrank(BORROWER);
        usdc.approve(address(creditVault), 10_000e6);
        creditVault.repayAll(address(tbill));
        creditVault.withdrawCollateral(address(tbill), 100_000e18);
        vm.stopPrank();
    }

    function testOnlyAdminCanPause() public {
        bytes32 role = creditVault.PROTOCOL_ADMIN_ROLE();
        vm.prank(BORROWER);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, BORROWER, role
            )
        );
        creditVault.pause();
    }

    // ---------------------------------------------------------------- repay / withdraw

    function testRepayPartialAndFull() public {
        _depositCollateral(100_000e18);
        _borrow(50_000e6);

        vm.startPrank(BORROWER);
        usdc.approve(address(creditVault), 50_000e6);
        creditVault.repay(address(tbill), 20_000e6);
        assertEq(creditVault.getPosition(BORROWER, address(tbill)).debtAmount, 30_000e6, "partial");

        uint256 paid = creditVault.repay(address(tbill), 1_000_000e6);
        vm.stopPrank();
        assertEq(paid, 30_000e6, "overpayment capped at debt");
        assertEq(creditVault.getPosition(BORROWER, address(tbill)).debtAmount, 0, "full");
    }

    function testRepayWithNoDebt() public {
        _depositCollateral(100_000e18);
        vm.prank(BORROWER);
        vm.expectRevert(RWACreditVault.ZeroAmount.selector);
        creditVault.repay(address(tbill), 1e6);
    }

    function testSafeWithdrawal() public {
        _depositCollateral(100_000e18);
        _borrow(50_000e6);
        // 50,000 debt needs 50,000 / (1.05 × 0.9 × 0.95 × 0.75) ≈ 74,262 mTBILL.
        vm.prank(BORROWER);
        creditVault.withdrawCollateral(address(tbill), 25_000e18);
        assertEq(tbill.balanceOf(BORROWER), 25_000e18, "withdrawn");
    }

    function testUnsafeWithdrawal() public {
        _depositCollateral(100_000e18);
        _borrow(50_000e6);
        vm.prank(BORROWER);
        vm.expectRevert(RWACreditVault.UnsafeWithdrawal.selector);
        creditVault.withdrawCollateral(address(tbill), 26_000e18);
    }

    function testWithdrawMoreThanDeposited() public {
        _depositCollateral(10e18);
        vm.prank(BORROWER);
        vm.expectRevert(RWACreditVault.InsufficientCollateral.selector);
        creditVault.withdrawCollateral(address(tbill), 11e18);
    }

    function testHardStaleBlocksWithdrawalWithDebt() public {
        _depositCollateral(100_000e18);
        _borrow(1e6);
        vm.warp(block.timestamp + 72 hours);
        vm.prank(BORROWER);
        vm.expectRevert(RWACreditVault.OracleHardStale.selector);
        creditVault.withdrawCollateral(address(tbill), 1e18);
    }

    function testDebtFreeWithdrawalIgnoresOracle() public {
        _depositCollateral(100_000e18);
        vm.warp(block.timestamp + 72 hours);
        vm.prank(BORROWER);
        creditVault.withdrawCollateral(address(tbill), 100_000e18);
        assertEq(uint256(_status()), uint256(RWACreditVault.PositionStatus.CLOSED), "closed");
    }

    function testClosedPositionCanReopen() public {
        _depositCollateral(1e18);
        vm.prank(BORROWER);
        creditVault.withdrawCollateral(address(tbill), 1e18);
        _depositCollateral(1e18);
        assertEq(uint256(_status()), uint256(RWACreditVault.PositionStatus.ACTIVE), "reopened");
    }

    // ---------------------------------------------------------------- liquidation

    function _shockAndInitiate() private {
        _depositCollateral(100_000e18);
        _borrow(50_000e6);
        sourceOracle.setCurrentPrice(address(tbill), 0.6e18);
        creditVault.initiateLiquidation(BORROWER, address(tbill));
    }

    function _settle(uint256 amount) private {
        usdc.mint(LIQUIDATOR, amount);
        vm.startPrank(LIQUIDATOR);
        usdc.approve(address(creditVault), amount);
        creditVault.settleLiquidation(BORROWER, address(tbill), amount);
        vm.stopPrank();
    }

    function testHealthyPositionNotLiquidatable() public {
        _depositCollateral(100_000e18);
        _borrow(50_000e6);
        vm.expectRevert(RWACreditVault.NotLiquidatable.selector);
        creditVault.initiateLiquidation(BORROWER, address(tbill));
    }

    function testInvalidOracleCannotLiquidate() public {
        _depositCollateral(100_000e18);
        _borrow(50_000e6);
        sourceOracle.setCurrentPrice(address(tbill), 0.6e18);
        sourceOracle.setValid(address(tbill), false);
        vm.expectRevert(RWACreditVault.NotLiquidatable.selector);
        creditVault.initiateLiquidation(BORROWER, address(tbill));
    }

    function testPendingPositionIsLocked() public {
        _shockAndInitiate();

        vm.expectRevert(RWACreditVault.PositionNotActive.selector);
        _borrow(1e6);

        vm.prank(BORROWER);
        vm.expectRevert(RWACreditVault.PositionInLiquidation.selector);
        creditVault.withdrawCollateral(address(tbill), 1e18);

        vm.prank(BORROWER);
        vm.expectRevert(RWACreditVault.PositionInLiquidation.selector);
        creditVault.depositCollateral(address(tbill), 1e18);

        vm.expectRevert(RWACreditVault.PositionNotActive.selector);
        creditVault.initiateLiquidation(BORROWER, address(tbill));
    }

    function testFullRepaymentCuresPendingLiquidation() public {
        _shockAndInitiate();

        vm.startPrank(BORROWER);
        usdc.approve(address(creditVault), 50_000e6);
        creditVault.repayAll(address(tbill));
        vm.stopPrank();

        assertEq(uint256(_status()), uint256(RWACreditVault.PositionStatus.ACTIVE), "cured");

        vm.prank(LIQUIDATOR);
        vm.expectRevert(RWACreditVault.PositionNotInLiquidation.selector);
        creditVault.settleLiquidation(BORROWER, address(tbill), 0);

        vm.prank(BORROWER);
        creditVault.withdrawCollateral(address(tbill), 100_000e18);
        assertEq(tbill.balanceOf(BORROWER), 100_000e18, "collateral kept");
    }

    function testPartialRepaymentStaysPending() public {
        _shockAndInitiate();
        vm.startPrank(BORROWER);
        usdc.approve(address(creditVault), 10_000e6);
        creditVault.repay(address(tbill), 10_000e6);
        vm.stopPrank();
        assertEq(
            uint256(_status()),
            uint256(RWACreditVault.PositionStatus.LIQUIDATION_PENDING),
            "still pending"
        );
    }

    function testSettlementWithSurplus() public {
        _shockAndInitiate();
        _settle(60_000e6);
        assertEq(usdc.balanceOf(BORROWER), 60_000e6, "borrowed 50k + 10k surplus");
        assertEq(liquidityVault.totalBadDebt(), 0, "no bad debt");
        assertEq(liquidityVault.totalAssets(), 100_000e6, "lenders whole");
    }

    function testSettlementWithBadDebt() public {
        _shockAndInitiate();
        _settle(35_000e6);
        assertEq(liquidityVault.totalBadDebt(), 15_000e6, "shortfall recognized");
        assertEq(liquidityVault.totalBorrowed(), 0, "receivable written off");
        assertEq(usdc.balanceOf(BORROWER), 50_000e6, "no surplus");
    }

    function testOnlyOperatorCanSettle() public {
        _shockAndInitiate();
        bytes32 role = creditVault.LIQUIDATION_OPERATOR_ROLE();
        vm.prank(BORROWER);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, BORROWER, role
            )
        );
        creditVault.settleLiquidation(BORROWER, address(tbill), 0);
    }

    function testSettleRequiresPending() public {
        _depositCollateral(100_000e18);
        vm.prank(LIQUIDATOR);
        vm.expectRevert(RWACreditVault.PositionNotInLiquidation.selector);
        creditVault.settleLiquidation(BORROWER, address(tbill), 0);
    }

    // ---------------------------------------------------------------- fuzz

    function testFuzzBorrowNeverExceedsCapacity(uint256 collateral, uint256 amount) public {
        collateral = bound(collateral, 1e18, 100_000e18);
        amount = bound(amount, 1, 100_000e6);
        _depositCollateral(collateral);

        uint256 capacity = creditVault.getAccountRisk(BORROWER, address(tbill)).borrowCapacity;
        if (amount * 1e12 > capacity) {
            vm.expectRevert(RWACreditVault.InsufficientCollateral.selector);
            _borrow(amount);
        } else {
            _borrow(amount);
            assertLe(
                creditVault.getAccountRisk(BORROWER, address(tbill)).debtValue,
                capacity,
                "within capacity"
            );
        }
    }

    function testFuzzWithdrawalNeverLeavesUnsafePosition(uint256 debt, uint256 amount) public {
        debt = bound(debt, 1, 67_000e6);
        amount = bound(amount, 1, 100_000e18);
        _depositCollateral(100_000e18);
        _borrow(debt);

        vm.prank(BORROWER);
        try creditVault.withdrawCollateral(address(tbill), amount) { } catch { }

        RWACreditVault.Position memory position = creditVault.getPosition(BORROWER, address(tbill));
        assertLe(
            position.debtAmount * 1e12,
            creditVault.getAccountRisk(BORROWER, address(tbill)).borrowCapacity,
            "INV-03"
        );
    }
}
