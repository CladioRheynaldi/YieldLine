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
    uint256 public constant RAY = 1e27;
    // Debt shares carry 18 extra decimals beyond MockUSDC's 6 decimals.
    uint256 public constant DEBT_DENOMINATOR = RAY * 1e18;
    uint256 public constant YEAR = 365 days;
    uint256 public constant BASE_RATE_BPS = 300;
    uint256 public constant SLOPE_RATE_BPS = 800;
    uint256 public constant RESERVE_FACTOR_BPS = 0;

    uint256 public totalDebtShares;
    uint256 public totalBadDebt;
    uint256 public rateAnchorIndex = RAY;
    uint256 public rateAnchorTimestamp;
    uint256 public borrowRateBps = BASE_RATE_BPS;
    uint256 public lastAccruedIndex = RAY;

    event InterestAccrued(uint256 index, uint256 receivables);
    event BorrowRateUpdated(uint256 rateBps, uint256 utilization);
    event LiquidityDrawn(address indexed receiver, uint256 assets, uint256 borrowedAfter);
    event RepaymentRecorded(uint256 assets, uint256 borrowedAfter);
    event BadDebtRecognized(uint256 assets, uint256 borrowedAfter, uint256 badDebtAfter);

    error InsufficientLiquidity();
    error InvalidAccountingAmount();
    error ZeroAddress();
    error ZeroAmount();

    constructor(IERC20 asset_, address admin)
        ERC20("YieldLine MockUSDC Vault Share", "ylmUSDC") ERC4626(asset_)
    {
        if (address(asset_) == address(0) || admin == address(0)) revert ZeroAddress();
        rateAnchorTimestamp = block.timestamp;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @dev Linear growth within an economic interval. Permissionless checkpoints
    ///      never reset the anchor, so their frequency cannot compound the debt.
    function currentBorrowIndex() public view returns (uint256) {
        return rateAnchorIndex + Math.mulDiv(
            rateAnchorIndex, borrowRateBps * (block.timestamp - rateAnchorTimestamp), BPS * YEAR
        );
    }

    function accrueInterest() public returns (uint256 index) {
        index = currentBorrowIndex();
        if (index != lastAccruedIndex) {
            lastAccruedIndex = index;
            emit InterestAccrued(index, totalBorrowed());
        }
    }

    function debtForShares(uint256 shares) public view returns (uint256) {
        return Math.mulDiv(shares, currentBorrowIndex(), DEBT_DENOMINATOR, Math.Rounding.Ceil);
    }

    function sharesForDebt(uint256 assets) public view returns (uint256) {
        return Math.mulDiv(assets, DEBT_DENOMINATOR, currentBorrowIndex(), Math.Rounding.Ceil);
    }

    function totalBorrowed() public view returns (uint256) {
        return debtForShares(totalDebtShares);
    }

    function totalAssets() public view override returns (uint256) {
        return availableLiquidity() + totalBorrowed();
    }

    function availableLiquidity() public view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    function utilizationBps() public view returns (uint256) {
        uint256 economicAssets = totalAssets();
        return economicAssets == 0 ? 0 : Math.mulDiv(totalBorrowed(), BPS, economicAssets);
    }

    /// @dev Indicative supply APR; unpaid receivables remain subject to default.
    function supplyRateBps() external view returns (uint256) {
        return Math.mulDiv(borrowRateBps, utilizationBps(), BPS);
    }

    /// @dev Pay the exact change in the rounded position debt, up to the caller's
    ///      maximum. This avoids collecting cash that does not reduce debt.
    function previewRepayment(uint256 shares, uint256 amount)
        public view returns (uint256 paid, uint256 sharesBurned)
    {
        uint256 debt = debtForShares(shares);
        if (amount >= debt) return (debt, shares);
        uint256 remainingShares =
            Math.mulDiv(debt - amount, DEBT_DENOMINATOR, currentBorrowIndex());
        sharesBurned = shares - remainingShares;
        paid = debt - debtForShares(remainingShares);
    }

    function lendTo(address receiver, uint256 assets)
        external onlyRole(CREDIT_VAULT_ROLE) nonReentrant returns (uint256 shares)
    {
        if (receiver == address(0)) revert ZeroAddress();
        if (assets == 0) revert ZeroAmount();
        accrueInterest();
        if (assets > availableLiquidity()) revert InsufficientLiquidity();
        shares = sharesForDebt(assets);
        totalDebtShares += shares;
        IERC20(asset()).safeTransfer(receiver, assets);
        _refreshRate();
        emit LiquidityDrawn(receiver, assets, totalBorrowed());
    }

    /// @dev The authorized credit vault transfers repayment cash first, after
    ///      calling accrueInterest, then burns this position's exact debt shares.
    function recordRepayment(uint256 assets, uint256 sharesBurned)
        external onlyRole(CREDIT_VAULT_ROLE) nonReentrant
    {
        accrueInterest();
        uint256 index = currentBorrowIndex();
        if (
            sharesBurned == 0 || sharesBurned > totalDebtShares
                || assets < Math.mulDiv(sharesBurned, index, DEBT_DENOMINATOR)
                || assets > Math.mulDiv(sharesBurned, index, DEBT_DENOMINATOR, Math.Rounding.Ceil)
        ) revert InvalidAccountingAmount();
        totalDebtShares -= sharesBurned;
        _refreshRate();
        emit RepaymentRecorded(assets, totalBorrowed());
    }

    /// @dev Loss is the reduction in aggregate receivables, including interest.
    function recognizeBadDebt(uint256 sharesBurned)
        external onlyRole(CREDIT_VAULT_ROLE) nonReentrant returns (uint256 loss)
    {
        accrueInterest();
        if (sharesBurned == 0 || sharesBurned > totalDebtShares) revert InvalidAccountingAmount();
        uint256 beforeDebt = totalBorrowed();
        totalDebtShares -= sharesBurned;
        loss = beforeDebt - totalBorrowed();
        totalBadDebt += loss;
        _refreshRate();
        emit BadDebtRecognized(loss, totalBorrowed(), totalBadDebt);
    }

    function maxWithdraw(address owner) public view override returns (uint256) {
        return Math.min(_convertToAssets(balanceOf(owner), Math.Rounding.Floor), availableLiquidity());
    }

    function maxRedeem(address owner) public view override returns (uint256) {
        // Floor, rather than previewWithdraw's ceiling, cannot redeem more cash
        // than is available when earned interest changes the share price.
        return Math.min(balanceOf(owner), _convertToShares(availableLiquidity(), Math.Rounding.Floor));
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares)
        internal override nonReentrant
    {
        if (assets == 0 || shares == 0) revert ZeroAmount();
        // Previews already use the live index; checkpointing does not change it.
        accrueInterest();
        super._deposit(caller, receiver, assets, shares);
        _refreshRate();
    }

    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal override nonReentrant
    {
        if (assets == 0 || shares == 0) revert ZeroAmount();
        accrueInterest();
        super._withdraw(caller, receiver, owner, assets, shares);
        _refreshRate();
    }

    function _refreshRate() private {
        rateAnchorIndex = currentBorrowIndex();
        rateAnchorTimestamp = block.timestamp;
        uint256 utilization = utilizationBps();
        borrowRateBps = BASE_RATE_BPS + Math.mulDiv(utilization, SLOPE_RATE_BPS, BPS);
        emit BorrowRateUpdated(borrowRateBps, utilization);
    }

    function _decimalsOffset() internal pure override returns (uint8) {
        return 3;
    }
}
