// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IRWAOracle } from "../interfaces/IRWAOracle.sol";

contract MockRWAOracle is AccessControl, IRWAOracle {
    bytes32 public constant ORACLE_UPDATER_ROLE = keccak256("ORACLE_UPDATER_ROLE");

    mapping(address asset => PriceData) private _prices;

    event OracleUpdated(address indexed asset, uint256 price, uint256 updatedAt, bool valid);

    error InvalidPrice();
    error InvalidTimestamp();
    error ZeroAddress();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_UPDATER_ROLE, admin);
    }

    function setPrice(address asset, uint256 price, uint256 updatedAt)
        external
        onlyRole(ORACLE_UPDATER_ROLE)
    {
        if (asset == address(0)) revert ZeroAddress();
        if (price == 0) revert InvalidPrice();
        if (updatedAt == 0 || updatedAt > block.timestamp) revert InvalidTimestamp();
        _prices[asset] = PriceData({ price: price, updatedAt: updatedAt, valid: true });
        emit OracleUpdated(asset, price, updatedAt, true);
    }

    function setCurrentPrice(address asset, uint256 price) external onlyRole(ORACLE_UPDATER_ROLE) {
        if (asset == address(0)) revert ZeroAddress();
        if (price == 0) revert InvalidPrice();
        _prices[asset] = PriceData({ price: price, updatedAt: block.timestamp, valid: true });
        emit OracleUpdated(asset, price, block.timestamp, true);
    }

    function setValid(address asset, bool valid) external onlyRole(ORACLE_UPDATER_ROLE) {
        PriceData storage data = _prices[asset];
        data.valid = valid;
        emit OracleUpdated(asset, data.price, data.updatedAt, valid);
    }

    function latestPrice(address asset) external view returns (PriceData memory) {
        return _prices[asset];
    }
}
