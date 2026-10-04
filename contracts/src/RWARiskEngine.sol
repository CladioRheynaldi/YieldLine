// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { IComplianceAdapter } from "./interfaces/IComplianceAdapter.sol";
import { IRWAOracle } from "./interfaces/IRWAOracle.sol";
import { IRWARegistry } from "./interfaces/IRWARegistry.sol";
import { IRWARiskEngine } from "./interfaces/IRWARiskEngine.sol";

contract RWARiskEngine is IRWARiskEngine {
    uint256 public constant BPS = 10_000;
    uint256 public constant WAD = 1e18;
    uint256 public constant USDC_TO_WAD = 1e12;

    IRWARegistry public immutable registry;

    error ZeroAddress();
    error UnsupportedTokenDecimals(uint8 decimals);

    constructor(IRWARegistry registry_) {
        if (address(registry_) == address(0)) revert ZeroAddress();
        registry = registry_;
    }

    function rawCollateralValue(address asset, uint256 amount, uint256 price)
        public
        view
        returns (uint256)
    {
        uint8 decimals = IERC20Metadata(asset).decimals();
        if (decimals > 36) revert UnsupportedTokenDecimals(decimals);
        return Math.mulDiv(amount, price, 10 ** decimals);
    }

    function freshnessFactorBps(uint256 updatedAt, uint32 maxOracleAge, uint32 hardStaleAge)
        public
        view
        returns (uint256)
    {
        if (updatedAt == 0 || updatedAt > block.timestamp) return 0;
        uint256 age = block.timestamp - updatedAt;
        if (age <= maxOracleAge) return BPS;
        if (age >= hardStaleAge) return 0;

        uint256 window = hardStaleAge - maxOracleAge;
        uint256 elapsed = age - maxOracleAge;
        return Math.mulDiv(BPS, window - elapsed, window);
    }

    function evaluate(address borrower, address asset, uint256 collateralAmount, uint256 debtAmount)
        external
        view
        returns (RiskResult memory result)
    {
        IRWARegistry.AssetConfig memory config = registry.getAssetConfig(asset);
        if (!config.enabled || config.oracle == address(0)) return result;

        bool validPrice;
        {
            IRWAOracle.PriceData memory priceData = IRWAOracle(config.oracle).latestPrice(asset);
            result.price = priceData.price;
            validPrice = priceData.valid && priceData.price > 0 && priceData.updatedAt != 0
                && priceData.updatedAt <= block.timestamp;
            result.oracleValid = validPrice;
            if (validPrice) {
                result.freshnessFactorBps = freshnessFactorBps(
                    priceData.updatedAt, config.maxOracleAge, config.hardStaleAge
                );
                result.rawCollateralValue =
                    rawCollateralValue(asset, collateralAmount, priceData.price);
            }
        }

        result.effectiveCollateralValue = _effectiveCollateral(
            result.rawCollateralValue,
            config.liquidityFactorBps,
            config.settlementFactorBps,
            result.freshnessFactorBps
        );
        result.borrowCapacity = Math.mulDiv(result.effectiveCollateralValue, config.baseLtvBps, BPS);
        result.liquidationCapacity =
            Math.mulDiv(result.effectiveCollateralValue, config.liquidationLtvBps, BPS);
        result.debtValue = debtAmount * USDC_TO_WAD;
        result.healthFactor = result.debtValue == 0
            ? type(uint256).max
            : Math.mulDiv(result.liquidationCapacity, WAD, result.debtValue);

        bool eligible = !config.permissioned
            || IComplianceAdapter(config.complianceAdapter).isEligible(asset, borrower);
        result.canBorrow =
            config.borrowingEnabled && eligible && validPrice && result.freshnessFactorBps > 0;
        result.liquidatable = validPrice && result.freshnessFactorBps > 0
            && result.debtValue > result.liquidationCapacity;
    }

    function _effectiveCollateral(
        uint256 rawValue,
        uint16 liquidityFactorBps,
        uint16 settlementFactorBps,
        uint256 freshnessBps
    ) private pure returns (uint256 value) {
        value = Math.mulDiv(rawValue, liquidityFactorBps, BPS);
        value = Math.mulDiv(value, settlementFactorBps, BPS);
        value = Math.mulDiv(value, freshnessBps, BPS);
    }
}
