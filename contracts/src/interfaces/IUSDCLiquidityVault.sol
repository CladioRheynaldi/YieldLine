// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IUSDCLiquidityVault {
    function lendTo(address receiver, uint256 assets) external;
    function recordRepayment(uint256 assets) external;
    function recognizeBadDebt(uint256 assets) external;
    function availableLiquidity() external view returns (uint256);
    function totalBorrowed() external view returns (uint256);
    function utilizationBps() external view returns (uint256);
}
