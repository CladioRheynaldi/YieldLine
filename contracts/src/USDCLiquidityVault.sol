// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ERC4626 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IUSDCLiquidityVault } from "./interfaces/IUSDCLiquidityVault.sol";

contract USDCLiquidityVault is ERC4626, AccessControl, ReentrancyGuard, IUSDCLiquidityVault {
    using SafeERC20 for IERC20;

    bytes32 public constant CREDIT_VAULT_ROLE = keccak256("CREDIT_VAULT_ROLE");
    uint256 public constant BPS = 10_000;

    uint256 public totalBorrowed;
    uint256 public totalBadDebt;

    event LiquidityDrawn(address indexed receiver, uint256 assets, uint256 borrowedAfter);
    event RepaymentRecorded(uint256 assets, uint256 borrowedAfter);
    event BadDebtRecognized(uint256 assets, uint256 borrowedAfter, uint256 badDebtAfter);

    error InsufficientLiquidity();
    error InvalidAccountingAmount();
    error ZeroAddress();

    constructor(IERC20 asset_, address admin)
        ERC20("YieldLine MockUSDC Vault Share", "ylmUSDC")
        ERC4626(asset_)
    {
        if (address(asset_) == address(0) || admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function totalAssets() public view override returns (uint256) {
        return availableLiquidity() + totalBorrowed;
    }

    function availableLiquidity() public view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    function utilizationBps() external view returns (uint256) {
        uint256 economicAssets = totalAssets();
        return economicAssets == 0 ? 0 : Math.mulDiv(totalBorrowed, BPS, economicAssets);
    }

    function lendTo(address receiver, uint256 assets)
        external
        onlyRole(CREDIT_VAULT_ROLE)
        nonReentrant
    {
        if (receiver == address(0)) revert ZeroAddress();
        if (assets > availableLiquidity()) revert InsufficientLiquidity();

        totalBorrowed += assets;
        IERC20(asset()).safeTransfer(receiver, assets);
        emit LiquidityDrawn(receiver, assets, totalBorrowed);
    }

    function recordRepayment(uint256 assets) external onlyRole(CREDIT_VAULT_ROLE) {
        if (assets > totalBorrowed) revert InvalidAccountingAmount();
        totalBorrowed -= assets;
        emit RepaymentRecorded(assets, totalBorrowed);
    }

    function recognizeBadDebt(uint256 assets) external onlyRole(CREDIT_VAULT_ROLE) {
        if (assets > totalBorrowed) revert InvalidAccountingAmount();
        totalBorrowed -= assets;
        totalBadDebt += assets;
        emit BadDebtRecognized(assets, totalBorrowed, totalBadDebt);
    }

    function maxWithdraw(address owner) public view override returns (uint256) {
        return Math.min(super.maxWithdraw(owner), availableLiquidity());
    }

    function maxRedeem(address owner) public view override returns (uint256) {
        return Math.min(super.maxRedeem(owner), previewWithdraw(availableLiquidity()));
    }

    function _decimalsOffset() internal pure override returns (uint8) {
        return 3;
    }
}
