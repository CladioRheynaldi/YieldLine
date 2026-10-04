// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IRWARiskEngine {
    struct RiskResult {
        uint256 price;
        uint256 rawCollateralValue;
        uint256 effectiveCollateralValue;
        uint256 borrowCapacity;
        uint256 liquidationCapacity;
        uint256 debtValue;
        uint256 healthFactor;
        uint256 freshnessFactorBps;
        bool oracleValid;
        bool canBorrow;
        bool liquidatable;
    }

    function evaluate(address borrower, address asset, uint256 collateralAmount, uint256 debtAmount)
        external
        view
        returns (RiskResult memory);
}
