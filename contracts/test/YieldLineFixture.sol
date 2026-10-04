// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ComplianceRegistry } from "../src/ComplianceRegistry.sol";
import { MockRWAOracle } from "../src/mocks/MockRWAOracle.sol";
import { MockTBILL } from "../src/mocks/MockTBILL.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { OracleAdapter } from "../src/OracleAdapter.sol";
import { RWARegistry } from "../src/RWARegistry.sol";
import { RWACreditVault } from "../src/RWACreditVault.sol";
import { RWARiskEngine } from "../src/RWARiskEngine.sol";
import { USDCLiquidityVault } from "../src/USDCLiquidityVault.sol";
import { IRWARegistry } from "../src/interfaces/IRWARegistry.sol";
import { TestBase } from "./TestBase.sol";

/// @dev Deploys and wires the full protocol with the documented demo parameters.
abstract contract YieldLineFixture is TestBase {
    address internal constant LENDER = address(0x1001);
    address internal constant BORROWER = address(0x1002);
    address internal constant LIQUIDATOR = address(0x1003);
    address internal constant INELIGIBLE = address(0x1004);
    address internal constant LENDER_TWO = address(0x1005);

    uint256 internal constant START_TIME = 1_750_000_000;
    uint256 internal constant NAV = 1.05e18;

    MockUSDC internal usdc;
    ComplianceRegistry internal compliance;
    MockTBILL internal tbill;
    MockRWAOracle internal sourceOracle;
    OracleAdapter internal oracleAdapter;
    RWARegistry internal registry;
    RWARiskEngine internal riskEngine;
    USDCLiquidityVault internal liquidityVault;
    RWACreditVault internal creditVault;

    function setUp() public virtual {
        vm.warp(START_TIME);

        usdc = new MockUSDC(address(this));
        compliance = new ComplianceRegistry(address(this));
        tbill = new MockTBILL(address(this), compliance);
        sourceOracle = new MockRWAOracle(address(this));
        oracleAdapter = new OracleAdapter(address(this));
        registry = new RWARegistry(address(this));
        riskEngine = new RWARiskEngine(registry);
        liquidityVault = new USDCLiquidityVault(usdc, address(this));
        creditVault = new RWACreditVault(address(this), registry, riskEngine, liquidityVault, usdc);

        liquidityVault.grantRole(liquidityVault.CREDIT_VAULT_ROLE(), address(creditVault));
        creditVault.grantRole(creditVault.LIQUIDATION_OPERATOR_ROLE(), LIQUIDATOR);
        oracleAdapter.setSource(address(tbill), address(sourceOracle));

        compliance.setEligibility(address(tbill), address(creditVault), true);
        compliance.setEligibility(address(tbill), BORROWER, true);

        registry.setAssetConfig(address(tbill), defaultConfig());

        sourceOracle.setCurrentPrice(address(tbill), NAV);
        usdc.mint(LENDER, 100_000e6);
        tbill.mint(BORROWER, 100_000e18);
    }

    function defaultConfig() internal view returns (IRWARegistry.AssetConfig memory) {
        return IRWARegistry.AssetConfig({
            oracle: address(oracleAdapter),
            complianceAdapter: address(compliance),
            baseLtvBps: 7_500,
            liquidationLtvBps: 8_200,
            liquidityFactorBps: 9_000,
            settlementFactorBps: 9_500,
            maxOracleAge: 24 hours,
            hardStaleAge: 72 hours,
            redemptionDelay: 1 days,
            supplyCap: uint128(1_000_000e18),
            permissioned: true,
            borrowingEnabled: true,
            enabled: true
        });
    }

    function _supply(address lender, uint256 amount) internal returns (uint256 shares) {
        vm.startPrank(lender);
        usdc.approve(address(liquidityVault), amount);
        shares = liquidityVault.deposit(amount, lender);
        vm.stopPrank();
    }

    function _depositCollateral(uint256 amount) internal {
        vm.startPrank(BORROWER);
        tbill.approve(address(creditVault), amount);
        creditVault.depositCollateral(address(tbill), amount);
        vm.stopPrank();
    }

    function _borrow(uint256 amount) internal {
        vm.prank(BORROWER);
        creditVault.borrow(address(tbill), amount);
    }

    function _openDocumentedPosition() internal {
        _supply(LENDER, 100_000e6);
        _depositCollateral(100_000e18);
        _borrow(50_000e6);
    }

    function _status() internal view returns (RWACreditVault.PositionStatus) {
        return creditVault.getPosition(BORROWER, address(tbill)).status;
    }
}
