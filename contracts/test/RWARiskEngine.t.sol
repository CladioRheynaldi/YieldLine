// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IRWARegistry } from "../src/interfaces/IRWARegistry.sol";
import { IRWARiskEngine } from "../src/interfaces/IRWARiskEngine.sol";
import { YieldLineFixture } from "./YieldLineFixture.sol";

contract RWARiskEngineTest is YieldLineFixture {
    uint32 private constant MAX_AGE = 24 hours;
    uint32 private constant HARD_STALE = 72 hours;

    function _evaluate(uint256 collateral, uint256 debt)
        private
        view
        returns (IRWARiskEngine.RiskResult memory)
    {
        return riskEngine.evaluate(BORROWER, address(tbill), collateral, debt);
    }

    // ---------------------------------------------------------------- exact math

    function testRawValueDecimalNormalization() public view {
        assertEq(riskEngine.rawCollateralValue(address(tbill), 1e18, NAV), NAV, "one token");
        assertEq(riskEngine.rawCollateralValue(address(tbill), 1, NAV), 1, "one wei rounds down");
        assertEq(riskEngine.rawCollateralValue(address(tbill), 0, NAV), 0, "zero amount");
        // A 6-decimal asset is normalized to the same 1e18 USD scale.
        assertEq(riskEngine.rawCollateralValue(address(usdc), 1e6, 1e18), 1e18, "6 decimals");
    }

    function testStaleOracleDocumentedExample() public {
        // 60% freshness: 40% of the 48h window has elapsed after the 24h max age.
        vm.warp(START_TIME + 24 hours + 19.2 hours);
        IRWARiskEngine.RiskResult memory risk = _evaluate(100_000e18, 0);
        assertEq(risk.freshnessFactorBps, 6_000, "freshness");
        assertEq(risk.effectiveCollateralValue, 53_865e18, "effective value");
        assertEq(risk.borrowCapacity, 40_398.75e18, "borrow capacity");
    }

    function testFreshnessBoundaries() public view {
        uint256 t = block.timestamp;
        assertEq(riskEngine.freshnessFactorBps(t, MAX_AGE, HARD_STALE), 10_000, "age zero");
        assertEq(
            riskEngine.freshnessFactorBps(t - MAX_AGE, MAX_AGE, HARD_STALE), 10_000, "at max age"
        );
        assertEq(
            riskEngine.freshnessFactorBps(t - MAX_AGE - 1, MAX_AGE, HARD_STALE),
            9_999,
            "one second past max age"
        );
        assertEq(
            riskEngine.freshnessFactorBps(t - 48 hours, MAX_AGE, HARD_STALE), 5_000, "midpoint"
        );
        assertEq(
            riskEngine.freshnessFactorBps(t - HARD_STALE + 1, MAX_AGE, HARD_STALE),
            0,
            "one second before hard stale rounds to zero"
        );
        assertEq(riskEngine.freshnessFactorBps(t - HARD_STALE, MAX_AGE, HARD_STALE), 0, "hard");
        assertEq(riskEngine.freshnessFactorBps(0, MAX_AGE, HARD_STALE), 0, "never updated");
        assertEq(riskEngine.freshnessFactorBps(t + 1, MAX_AGE, HARD_STALE), 0, "future");
    }

    function testZeroDebtHealthFactorIsMax() public view {
        assertEq(_evaluate(100_000e18, 0).healthFactor, type(uint256).max, "HF sentinel");
    }

    function testHealthFactorOneBoundary() public view {
        // Liquidation capacity is exactly $73,615.50.
        IRWARiskEngine.RiskResult memory atOne = _evaluate(100_000e18, 73_615.5e6);
        assertEq(atOne.healthFactor, 1e18, "HF exactly one");
        assertFalse(atOne.liquidatable, "HF == 1 is not liquidatable");

        IRWARiskEngine.RiskResult memory below = _evaluate(100_000e18, 73_615.500001e6);
        assertTrue(below.liquidatable, "one unit more debt is liquidatable");
    }

    function testInvalidOracleZeroesCapacity() public {
        sourceOracle.setValid(address(tbill), false);
        IRWARiskEngine.RiskResult memory risk = _evaluate(100_000e18, 50_000e6);
        assertFalse(risk.oracleValid, "invalid");
        assertEq(risk.effectiveCollateralValue, 0, "no value from invalid price");
        assertFalse(risk.canBorrow, "cannot borrow");
        assertFalse(risk.liquidatable, "invalid price never liquidates");
    }

    function testIneligibleBorrowerCannotBorrow() public {
        compliance.setEligibility(address(tbill), BORROWER, false);
        IRWARiskEngine.RiskResult memory risk = _evaluate(100_000e18, 0);
        assertFalse(risk.canBorrow, "ineligible");
        assertEq(risk.borrowCapacity, 67_331.25e18, "compliance is not a numeric haircut");
    }

    function testDisabledAssetReturnsEmptyResult() public {
        registry.setAssetEnabled(address(tbill), false);
        IRWARiskEngine.RiskResult memory risk = _evaluate(100_000e18, 50_000e6);
        assertEq(risk.price, 0, "no price");
        assertFalse(risk.canBorrow, "no borrowing");
    }

    // ---------------------------------------------------------------- fuzz properties

    function testFuzzCapacityOrdering(uint256 collateral, uint256 price, uint256 age) public {
        collateral = bound(collateral, 0, 1e30);
        price = bound(price, 1, 1e24);
        age = bound(age, 0, 96 hours);
        sourceOracle.setPrice(address(tbill), price, block.timestamp - age);

        IRWARiskEngine.RiskResult memory risk = _evaluate(collateral, 0);
        assertLe(risk.effectiveCollateralValue, risk.rawCollateralValue, "effective <= raw");
        assertLe(risk.borrowCapacity, risk.effectiveCollateralValue, "borrow <= effective");
        assertLe(risk.liquidationCapacity, risk.effectiveCollateralValue, "liq <= effective");
        assertLe(risk.borrowCapacity, risk.liquidationCapacity, "borrow <= liq");
    }

    function testFuzzMoreDebtNeverRaisesHealth(uint256 collateral, uint256 debt, uint256 extra)
        public
        view
    {
        collateral = bound(collateral, 1e18, 1e30);
        debt = bound(debt, 1, 1e18);
        extra = bound(extra, 0, 1e18);
        assertGe(
            _evaluate(collateral, debt).healthFactor,
            _evaluate(collateral, debt + extra).healthFactor,
            "HF monotonic in debt"
        );
    }

    function testFuzzLowerNavNeverRaisesHealth(uint256 highNav, uint256 drop, uint256 debt) public {
        highNav = bound(highNav, 1e12, 1e24);
        drop = bound(drop, 0, highNav - 1);
        debt = bound(debt, 1, 1e15);

        sourceOracle.setCurrentPrice(address(tbill), highNav);
        uint256 before = _evaluate(100_000e18, debt).healthFactor;
        sourceOracle.setCurrentPrice(address(tbill), highNav - drop);
        uint256 afterDrop = _evaluate(100_000e18, debt).healthFactor;
        assertLe(afterDrop, before, "HF monotonic in NAV");
    }

    function testFuzzLargerHaircutNeverRaisesCapacity(uint16 looseBps, uint16 tighten) public {
        looseBps = uint16(bound(looseBps, 1, 10_000));
        tighten = uint16(bound(tighten, 0, looseBps));

        IRWARegistry.AssetConfig memory config = defaultConfig();
        config.liquidityFactorBps = looseBps;
        registry.setAssetConfig(address(tbill), config);
        uint256 loose = _evaluate(100_000e18, 0).borrowCapacity;

        config.liquidityFactorBps = looseBps - tighten;
        registry.setAssetConfig(address(tbill), config);
        uint256 tight = _evaluate(100_000e18, 0).borrowCapacity;

        assertLe(tight, loose, "haircut monotonic");
    }
}
