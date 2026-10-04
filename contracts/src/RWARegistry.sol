// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IRWARegistry } from "./interfaces/IRWARegistry.sol";

contract RWARegistry is AccessControl, IRWARegistry {
    bytes32 public constant RISK_ADMIN_ROLE = keccak256("RISK_ADMIN_ROLE");
    uint16 public constant BPS = 10_000;

    mapping(address asset => AssetConfig) private _configs;

    event AssetConfigUpdated(address indexed asset, bytes32 indexed configHash);

    error InvalidAddress();
    error InvalidLtv();
    error InvalidFactor();
    error InvalidOracleAges();
    error MissingComplianceAdapter();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RISK_ADMIN_ROLE, admin);
    }

    function setAssetConfig(address asset, AssetConfig calldata config)
        external
        onlyRole(RISK_ADMIN_ROLE)
    {
        if (asset == address(0) || config.oracle == address(0)) revert InvalidAddress();
        if (config.baseLtvBps >= config.liquidationLtvBps || config.liquidationLtvBps > BPS) {
            revert InvalidLtv();
        }
        if (config.liquidityFactorBps > BPS || config.settlementFactorBps > BPS) {
            revert InvalidFactor();
        }
        if (config.maxOracleAge == 0 || config.maxOracleAge >= config.hardStaleAge) {
            revert InvalidOracleAges();
        }
        if (config.permissioned && config.complianceAdapter == address(0)) {
            revert MissingComplianceAdapter();
        }

        _configs[asset] = config;
        emit AssetConfigUpdated(asset, keccak256(abi.encode(config)));
    }

    function setBorrowingEnabled(address asset, bool enabled) external onlyRole(RISK_ADMIN_ROLE) {
        AssetConfig storage config = _configs[asset];
        if (config.oracle == address(0)) revert InvalidAddress();
        config.borrowingEnabled = enabled;
        emit AssetConfigUpdated(asset, keccak256(abi.encode(config)));
    }

    function setAssetEnabled(address asset, bool enabled) external onlyRole(RISK_ADMIN_ROLE) {
        AssetConfig storage config = _configs[asset];
        if (config.oracle == address(0)) revert InvalidAddress();
        config.enabled = enabled;
        emit AssetConfigUpdated(asset, keccak256(abi.encode(config)));
    }

    function getAssetConfig(address asset) external view returns (AssetConfig memory) {
        return _configs[asset];
    }
}
