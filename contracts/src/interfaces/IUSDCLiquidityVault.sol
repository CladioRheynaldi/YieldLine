// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IUSDCLiquidityVault {
    function accrueInterest() external returns (uint256);
    function debtForShares(uint256 shares) external view returns (uint256);
    function sharesForDebt(uint256 assets) external view returns (uint256);
    function previewRepayment(uint256 shares, uint256 amount)
        external view returns (uint256 paid, uint256 sharesBurned);
    function lendTo(address receiver, uint256 assets) external returns (uint256 shares);
    function recordRepayment(uint256 assets, uint256 sharesBurned) external;
    function recognizeBadDebt(uint256 sharesBurned) external returns (uint256 loss);
    function availableLiquidity() external view returns (uint256);
    function totalBorrowed() external view returns (uint256);
    function utilizationBps() external view returns (uint256);
    function borrowRateBps() external view returns (uint256);
    function supplyRateBps() external view returns (uint256);
}
