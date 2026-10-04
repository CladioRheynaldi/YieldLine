// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { RWARegistry } from "../src/RWARegistry.sol";
import { IRWARegistry } from "../src/interfaces/IRWARegistry.sol";
import { YieldLineFixture } from "./YieldLineFixture.sol";

contract RWARegistryTest is YieldLineFixture {
    function testRegisteredConfig() public view {
        IRWARegistry.AssetConfig memory config = registry.getAssetConfig(address(tbill));
        assertEq(config.oracle, address(oracleAdapter), "oracle");
        assertEq(config.baseLtvBps, 7_500, "base LTV");
        assertEq(config.liquidationLtvBps, 8_200, "liquidation LTV");
        assertTrue(config.enabled, "enabled");
        assertTrue(config.permissioned, "permissioned");
    }

    function testRejectsBaseLtvAtOrAboveLiquidationLtv() public {
        IRWARegistry.AssetConfig memory config = defaultConfig();
        config.baseLtvBps = config.liquidationLtvBps;
        vm.expectRevert(RWARegistry.InvalidLtv.selector);
        registry.setAssetConfig(address(tbill), config);
    }

    function testRejectsLiquidationLtvAboveOne() public {
        IRWARegistry.AssetConfig memory config = defaultConfig();
        config.liquidationLtvBps = 10_001;
        vm.expectRevert(RWARegistry.InvalidLtv.selector);
        registry.setAssetConfig(address(tbill), config);
    }

    function testRejectsFactorAboveOne() public {
        IRWARegistry.AssetConfig memory config = defaultConfig();
        config.settlementFactorBps = 10_001;
        vm.expectRevert(RWARegistry.InvalidFactor.selector);
        registry.setAssetConfig(address(tbill), config);
    }

    function testRejectsInvalidOracleAges() public {
        IRWARegistry.AssetConfig memory config = defaultConfig();
        config.hardStaleAge = config.maxOracleAge;
        vm.expectRevert(RWARegistry.InvalidOracleAges.selector);
        registry.setAssetConfig(address(tbill), config);

        config = defaultConfig();
        config.maxOracleAge = 0;
        vm.expectRevert(RWARegistry.InvalidOracleAges.selector);
        registry.setAssetConfig(address(tbill), config);
    }

    function testPermissionedAssetNeedsComplianceAdapter() public {
        IRWARegistry.AssetConfig memory config = defaultConfig();
        config.complianceAdapter = address(0);
        vm.expectRevert(RWARegistry.MissingComplianceAdapter.selector);
        registry.setAssetConfig(address(tbill), config);
    }

    function testRejectsMissingOracle() public {
        IRWARegistry.AssetConfig memory config = defaultConfig();
        config.oracle = address(0);
        vm.expectRevert(RWARegistry.InvalidAddress.selector);
        registry.setAssetConfig(address(tbill), config);
    }

    function testDisableBorrowingAndAsset() public {
        registry.setBorrowingEnabled(address(tbill), false);
        assertFalse(registry.getAssetConfig(address(tbill)).borrowingEnabled, "borrowing off");

        registry.setAssetEnabled(address(tbill), false);
        assertFalse(registry.getAssetConfig(address(tbill)).enabled, "asset off");
    }

    function testToggleUnknownAssetReverts() public {
        vm.expectRevert(RWARegistry.InvalidAddress.selector);
        registry.setBorrowingEnabled(address(usdc), true);
    }

    function testUnauthorizedConfiguration() public {
        IRWARegistry.AssetConfig memory config = defaultConfig();
        bytes memory expected = abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector,
            BORROWER,
            registry.RISK_ADMIN_ROLE()
        );

        vm.prank(BORROWER);
        vm.expectRevert(expected);
        registry.setAssetConfig(address(tbill), config);

        vm.prank(BORROWER);
        vm.expectRevert(expected);
        registry.setBorrowingEnabled(address(tbill), false);
    }
}
