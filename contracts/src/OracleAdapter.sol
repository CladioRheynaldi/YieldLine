// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IRWAOracle } from "./interfaces/IRWAOracle.sol";

contract OracleAdapter is AccessControl, IRWAOracle {
    bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE");

    mapping(address asset => address source) private _sources;

    event OracleSourceUpdated(address indexed asset, address indexed source);

    error OracleNotConfigured();
    error ZeroAddress();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ADMIN_ROLE, admin);
    }

    function setSource(address asset, address source) external onlyRole(ORACLE_ADMIN_ROLE) {
        if (asset == address(0) || source == address(0)) revert ZeroAddress();
        _sources[asset] = source;
        emit OracleSourceUpdated(asset, source);
    }

    function sourceFor(address asset) external view returns (address) {
        return _sources[asset];
    }

    function latestPrice(address asset) external view returns (PriceData memory data) {
        address source = _sources[asset];
        if (source == address(0)) revert OracleNotConfigured();

        data = IRWAOracle(source).latestPrice(asset);
        if (data.price == 0 || data.updatedAt == 0 || data.updatedAt > block.timestamp) {
            data.valid = false;
        }
    }
}
