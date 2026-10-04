// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IRWARegistry {
    struct AssetConfig {
        address oracle;
        address complianceAdapter;
        uint16 baseLtvBps;
        uint16 liquidationLtvBps;
        uint16 liquidityFactorBps;
        uint16 settlementFactorBps;
        uint32 maxOracleAge;
        uint32 hardStaleAge;
        uint32 redemptionDelay;
        uint128 supplyCap;
        bool permissioned;
        bool borrowingEnabled;
        bool enabled;
    }

    function getAssetConfig(address asset) external view returns (AssetConfig memory);
}
