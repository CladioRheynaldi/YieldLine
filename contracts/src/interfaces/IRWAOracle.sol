// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IRWAOracle {
    struct PriceData {
        uint256 price;
        uint256 updatedAt;
        bool valid;
    }

    function latestPrice(address asset) external view returns (PriceData memory);
}
