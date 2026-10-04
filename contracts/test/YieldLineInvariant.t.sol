// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { MockRWAOracle } from "../src/mocks/MockRWAOracle.sol";
import { MockTBILL } from "../src/mocks/MockTBILL.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { RWACreditVault } from "../src/RWACreditVault.sol";
import { USDCLiquidityVault } from "../src/USDCLiquidityVault.sol";
import { Vm } from "./TestBase.sol";
import { YieldLineFixture } from "./YieldLineFixture.sol";

/// @dev Drives random but valid protocol actions. Failed calls are swallowed so the
///      fuzzer explores states rather than reverting runs.
contract ProtocolHandler {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockUSDC private immutable usdc;
    MockTBILL private immutable tbill;
    MockRWAOracle private immutable oracle;
    USDCLiquidityVault private immutable liquidityVault;
    RWACreditVault private immutable creditVault;
    address private immutable lender;
    address private immutable borrower;

    uint256 public usdcMintedByHandler;

    constructor(
        MockUSDC usdc_,
        MockTBILL tbill_,
        MockRWAOracle oracle_,
        USDCLiquidityVault liquidityVault_,
        RWACreditVault creditVault_,
        address lender_,
        address borrower_
    ) {
        usdc = usdc_;
        tbill = tbill_;
        oracle = oracle_;
        liquidityVault = liquidityVault_;
        creditVault = creditVault_;
        lender = lender_;
        borrower = borrower_;
    }

    function _bound(uint256 value, uint256 min, uint256 max) private pure returns (uint256) {
        return min + (value % (max - min + 1));
    }

    function supply(uint256 amount) external {
        amount = _bound(amount, 1, 50_000e6);
        usdc.mint(lender, amount);
        usdcMintedByHandler += amount;
        vm.startPrank(lender);
        usdc.approve(address(liquidityVault), amount);
        liquidityVault.deposit(amount, lender);
        vm.stopPrank();
    }

    function withdraw(uint256 amount) external {
        amount = _bound(amount, 0, liquidityVault.maxWithdraw(lender));
        if (amount == 0) return;
        vm.prank(lender);
        liquidityVault.withdraw(amount, lender, lender);
    }

    function deposit(uint256 amount) external {
        uint256 balance = tbill.balanceOf(borrower);
        if (balance == 0) return;
        amount = _bound(amount, 1, balance);
        vm.startPrank(borrower);
        tbill.approve(address(creditVault), amount);
        try creditVault.depositCollateral(address(tbill), amount) { } catch { }
        vm.stopPrank();
    }

    function borrow(uint256 amount) external {
        amount = _bound(amount, 1, 80_000e6);
        vm.prank(borrower);
        try creditVault.borrow(address(tbill), amount) { } catch { }
    }

    function repay(uint256 amount) external {
        uint256 debt = creditVault.getPosition(borrower, address(tbill)).debtAmount;
        if (debt == 0) return;
        amount = _bound(amount, 1, debt);
        usdc.mint(borrower, amount);
        usdcMintedByHandler += amount;
        vm.startPrank(borrower);
        usdc.approve(address(creditVault), amount);
        creditVault.repay(address(tbill), amount);
        vm.stopPrank();
    }

    function withdrawCollateral(uint256 amount) external {
        uint256 collateral = creditVault.getPosition(borrower, address(tbill)).collateralAmount;
        if (collateral == 0) return;
        amount = _bound(amount, 1, collateral);
        vm.prank(borrower);
        try creditVault.withdrawCollateral(address(tbill), amount) { } catch { }
    }

    function setNav(uint256 nav) external {
        nav = _bound(nav, 0.2e18, 1.5e18);
        oracle.setCurrentPrice(address(tbill), nav);
    }

    function liquidateAndSettle(uint256 proceeds) external {
        try creditVault.initiateLiquidation(borrower, address(tbill)) { }
        catch {
            return;
        }
        proceeds = _bound(proceeds, 0, 120_000e6);
        usdc.mint(address(this), proceeds);
        usdcMintedByHandler += proceeds;
        usdc.approve(address(creditVault), proceeds);
        creditVault.settleLiquidation(borrower, address(tbill), proceeds);
    }
}

contract YieldLineInvariantTest is YieldLineFixture {
    ProtocolHandler private handler;
    uint256 private initialUsdcSupply;

    function setUp() public override {
        super.setUp();
        handler = new ProtocolHandler(
            usdc, tbill, sourceOracle, liquidityVault, creditVault, LENDER, BORROWER
        );
        usdc.grantRole(usdc.MINTER_ROLE(), address(handler));
        sourceOracle.grantRole(sourceOracle.ORACLE_UPDATER_ROLE(), address(handler));
        creditVault.grantRole(creditVault.LIQUIDATION_OPERATOR_ROLE(), address(handler));
        initialUsdcSupply = usdc.totalSupply();
    }

    function targetContracts() public view returns (address[] memory targets) {
        targets = new address[](1);
        targets[0] = address(handler);
    }

    /// INV-02: credit-vault debt reconciles with the liquidity vault's receivable.
    function invariant_debtReconciles() public view {
        assertEq(
            creditVault.getPosition(BORROWER, address(tbill)).debtAmount,
            liquidityVault.totalBorrowed(),
            "debt == totalBorrowed"
        );
    }

    /// Custodied collateral always matches recorded collateral.
    function invariant_collateralCustody() public view {
        assertEq(
            tbill.balanceOf(address(creditVault)),
            creditVault.totalCollateralByAsset(address(tbill)),
            "custody == accounting"
        );
        assertEq(
            creditVault.getPosition(BORROWER, address(tbill)).collateralAmount,
            creditVault.totalCollateralByAsset(address(tbill)),
            "single borrower"
        );
    }

    /// INV-01: only explicit mints create MockUSDC; the protocol never does.
    function invariant_noUsdcCreatedByProtocol() public view {
        assertEq(
            usdc.totalSupply(),
            initialUsdcSupply + handler.usdcMintedByHandler(),
            "supply == seeded + handler mints"
        );
    }

    /// INV-07: MockTBILL is only ever held by eligible accounts.
    function invariant_tbillHeldByEligibleOnly() public view {
        assertEq(
            tbill.totalSupply(),
            tbill.balanceOf(BORROWER) + tbill.balanceOf(address(creditVault)),
            "no leakage to ineligible holders"
        );
    }

    /// Vault economic assets always cover cash on hand.
    function invariant_totalAssetsCoverCash() public view {
        assertGe(
            liquidityVault.totalAssets(), liquidityVault.availableLiquidity(), "assets >= cash"
        );
    }
}
