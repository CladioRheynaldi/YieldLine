// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { MockRWAOracle } from "../src/mocks/MockRWAOracle.sol";
import { OracleAdapter } from "../src/OracleAdapter.sol";
import { IRWAOracle } from "../src/interfaces/IRWAOracle.sol";
import { YieldLineFixture } from "./YieldLineFixture.sol";

/// @dev A source that returns whatever it is told, including malformed data.
contract RawOracleSource is IRWAOracle {
    PriceData private _data;

    function set(uint256 price, uint256 updatedAt, bool valid) external {
        _data = PriceData({ price: price, updatedAt: updatedAt, valid: valid });
    }

    function latestPrice(address) external view returns (PriceData memory) {
        return _data;
    }
}

contract OracleTest is YieldLineFixture {
    function testNormalPrice() public view {
        IRWAOracle.PriceData memory data = oracleAdapter.latestPrice(address(tbill));
        assertEq(data.price, NAV, "price");
        assertEq(data.updatedAt, START_TIME, "timestamp");
        assertTrue(data.valid, "valid");
    }

    function testMockRejectsZeroPriceAndFutureTimestamp() public {
        vm.expectRevert(MockRWAOracle.InvalidPrice.selector);
        sourceOracle.setCurrentPrice(address(tbill), 0);

        vm.expectRevert(MockRWAOracle.InvalidTimestamp.selector);
        sourceOracle.setPrice(address(tbill), NAV, block.timestamp + 1);

        vm.expectRevert(MockRWAOracle.InvalidTimestamp.selector);
        sourceOracle.setPrice(address(tbill), NAV, 0);
    }

    function testBackdatedPriceForSimulator() public {
        sourceOracle.setPrice(address(tbill), 1e18, block.timestamp - 48 hours);
        IRWAOracle.PriceData memory data = oracleAdapter.latestPrice(address(tbill));
        assertEq(data.updatedAt, START_TIME - 48 hours, "backdated timestamp");
    }

    function testInvalidStatusPropagates() public {
        sourceOracle.setValid(address(tbill), false);
        assertFalse(oracleAdapter.latestPrice(address(tbill)).valid, "invalid");
    }

    function testAdapterSanitizesMalformedSource() public {
        RawOracleSource raw = new RawOracleSource();
        oracleAdapter.setSource(address(tbill), address(raw));

        raw.set(0, block.timestamp, true);
        assertFalse(oracleAdapter.latestPrice(address(tbill)).valid, "zero price invalid");

        raw.set(NAV, block.timestamp + 1, true);
        assertFalse(oracleAdapter.latestPrice(address(tbill)).valid, "future timestamp invalid");

        raw.set(NAV, 0, true);
        assertFalse(oracleAdapter.latestPrice(address(tbill)).valid, "zero timestamp invalid");
    }

    function testUnconfiguredAssetReverts() public {
        vm.expectRevert(OracleAdapter.OracleNotConfigured.selector);
        oracleAdapter.latestPrice(address(usdc));
    }

    function testOnlyUpdaterCanSetPrice() public {
        bytes32 role = sourceOracle.ORACLE_UPDATER_ROLE();
        vm.prank(BORROWER);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, BORROWER, role
            )
        );
        sourceOracle.setCurrentPrice(address(tbill), 2e18);
    }

    function testStaleStatusVisibleThroughRiskEngine() public {
        vm.warp(block.timestamp + 72 hours);
        assertTrue(oracleAdapter.latestPrice(address(tbill)).valid, "adapter does not judge age");
        assertEq(
            creditVault.getAccountRisk(BORROWER, address(tbill)).freshnessFactorBps,
            0,
            "risk engine applies age policy"
        );
    }
}
