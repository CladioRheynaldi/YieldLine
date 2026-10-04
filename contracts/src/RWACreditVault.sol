// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IComplianceAdapter } from "./interfaces/IComplianceAdapter.sol";
import { IRWARegistry } from "./interfaces/IRWARegistry.sol";
import { IRWARiskEngine } from "./interfaces/IRWARiskEngine.sol";
import { IUSDCLiquidityVault } from "./interfaces/IUSDCLiquidityVault.sol";

interface IBurnableCollateral {
    function burn(uint256 amount) external;
}

contract RWACreditVault is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant PROTOCOL_ADMIN_ROLE = keccak256("PROTOCOL_ADMIN_ROLE");
    bytes32 public constant LIQUIDATION_OPERATOR_ROLE = keccak256("LIQUIDATION_OPERATOR_ROLE");
    uint256 public constant USDC_TO_WAD = 1e12;

    enum PositionStatus {
        NONE,
        ACTIVE,
        LIQUIDATION_PENDING,
        CLOSED
    }

    struct Position {
        uint256 collateralAmount;
        uint256 debtAmount;
        PositionStatus status;
    }

    IRWARegistry public immutable registry;
    IRWARiskEngine public immutable riskEngine;
    IUSDCLiquidityVault public immutable liquidityVault;
    IERC20 public immutable settlementToken;

    mapping(address borrower => mapping(address asset => Position)) private _positions;
    mapping(address asset => uint256 amount) public totalCollateralByAsset;

    event CollateralDeposited(address indexed borrower, address indexed asset, uint256 amount);
    event CollateralWithdrawn(address indexed borrower, address indexed asset, uint256 amount);
    event Borrowed(
        address indexed borrower, address indexed asset, uint256 amount, uint256 debtAfter
    );
    event Repaid(
        address indexed borrower, address indexed asset, uint256 amount, uint256 debtAfter
    );
    event LiquidationInitiated(
        address indexed borrower,
        address indexed asset,
        uint256 collateralAmount,
        uint256 debtAmount
    );
    event LiquidationCured(address indexed borrower, address indexed asset);
    event LiquidationSettled(
        address indexed borrower,
        address indexed asset,
        uint256 settlementAmount,
        uint256 debtRepaid,
        uint256 surplus,
        uint256 badDebt
    );

    error UnsupportedAsset();
    error BorrowingDisabled();
    error AccountNotEligible();
    error OracleInvalid();
    error OracleHardStale();
    error InsufficientCollateral();
    error PositionInLiquidation();
    error PositionNotActive();
    error PositionNotInLiquidation();
    error UnsafeWithdrawal();
    error NotLiquidatable();
    error SupplyCapExceeded();
    error ZeroAmount();
    error ZeroAddress();

    constructor(
        address admin,
        IRWARegistry registry_,
        IRWARiskEngine riskEngine_,
        IUSDCLiquidityVault liquidityVault_,
        IERC20 settlementToken_
    ) {
        if (
            admin == address(0) || address(registry_) == address(0)
                || address(riskEngine_) == address(0) || address(liquidityVault_) == address(0)
                || address(settlementToken_) == address(0)
        ) revert ZeroAddress();

        registry = registry_;
        riskEngine = riskEngine_;
        liquidityVault = liquidityVault_;
        settlementToken = settlementToken_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PROTOCOL_ADMIN_ROLE, admin);
        _grantRole(LIQUIDATION_OPERATOR_ROLE, admin);
    }

    function pause() external onlyRole(PROTOCOL_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PROTOCOL_ADMIN_ROLE) {
        _unpause();
    }

    function depositCollateral(address asset, uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();
        IRWARegistry.AssetConfig memory config = _requireSupported(asset);
        _requireEligible(config, asset, msg.sender);
        _requireEligible(config, asset, address(this));

        Position storage position = _positions[msg.sender][asset];
        if (position.status == PositionStatus.LIQUIDATION_PENDING) revert PositionInLiquidation();

        uint256 totalAfter = totalCollateralByAsset[asset] + amount;
        if (config.supplyCap != 0 && totalAfter > config.supplyCap) revert SupplyCapExceeded();

        position.collateralAmount += amount;
        position.status = PositionStatus.ACTIVE;
        totalCollateralByAsset[asset] = totalAfter;

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        emit CollateralDeposited(msg.sender, asset, amount);
    }

    function borrow(address asset, uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();
        IRWARegistry.AssetConfig memory config = _requireSupported(asset);
        if (!config.borrowingEnabled) revert BorrowingDisabled();
        _requireEligible(config, asset, msg.sender);

        Position storage position = _positions[msg.sender][asset];
        if (position.status != PositionStatus.ACTIVE) revert PositionNotActive();

        uint256 debtAfter = position.debtAmount + amount;
        IRWARiskEngine.RiskResult memory risk =
            riskEngine.evaluate(msg.sender, asset, position.collateralAmount, debtAfter);
        if (!risk.oracleValid) revert OracleInvalid();
        if (risk.freshnessFactorBps == 0) revert OracleHardStale();
        if (!risk.canBorrow) revert BorrowingDisabled();
        if (risk.debtValue > risk.borrowCapacity) revert InsufficientCollateral();

        position.debtAmount = debtAfter;
        liquidityVault.lendTo(msg.sender, amount);
        emit Borrowed(msg.sender, asset, amount, debtAfter);
    }

    function repay(address asset, uint256 amount) public nonReentrant returns (uint256 paid) {
        if (amount == 0) revert ZeroAmount();
        Position storage position = _positions[msg.sender][asset];
        if (
            position.status != PositionStatus.ACTIVE
                && position.status != PositionStatus.LIQUIDATION_PENDING
        ) revert PositionNotActive();

        paid = amount > position.debtAmount ? position.debtAmount : amount;
        if (paid == 0) revert ZeroAmount();

        position.debtAmount -= paid;
        if (position.status == PositionStatus.LIQUIDATION_PENDING && position.debtAmount == 0) {
            // A borrower who repays in full before settlement keeps their collateral.
            position.status = PositionStatus.ACTIVE;
            emit LiquidationCured(msg.sender, asset);
        }
        settlementToken.safeTransferFrom(msg.sender, address(liquidityVault), paid);
        liquidityVault.recordRepayment(paid);
        emit Repaid(msg.sender, asset, paid, position.debtAmount);
    }

    function repayAll(address asset) external returns (uint256 paid) {
        paid = repay(asset, _positions[msg.sender][asset].debtAmount);
    }

    function withdrawCollateral(address asset, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        IRWARegistry.AssetConfig memory config = _requireSupported(asset);
        _requireEligible(config, asset, msg.sender);

        Position storage position = _positions[msg.sender][asset];
        if (position.status == PositionStatus.LIQUIDATION_PENDING) revert PositionInLiquidation();
        if (position.status != PositionStatus.ACTIVE) revert PositionNotActive();
        if (amount > position.collateralAmount) revert InsufficientCollateral();

        uint256 collateralAfter = position.collateralAmount - amount;
        if (position.debtAmount != 0) {
            IRWARiskEngine.RiskResult memory risk =
                riskEngine.evaluate(msg.sender, asset, collateralAfter, position.debtAmount);
            if (!risk.oracleValid) revert OracleInvalid();
            if (risk.freshnessFactorBps == 0) revert OracleHardStale();
            if (risk.debtValue > risk.borrowCapacity) revert UnsafeWithdrawal();
        }

        position.collateralAmount = collateralAfter;
        totalCollateralByAsset[asset] -= amount;
        if (collateralAfter == 0 && position.debtAmount == 0) {
            position.status = PositionStatus.CLOSED;
        }

        IERC20(asset).safeTransfer(msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, asset, amount);
    }

    function initiateLiquidation(address borrower, address asset) external {
        Position storage position = _positions[borrower][asset];
        if (position.status != PositionStatus.ACTIVE) revert PositionNotActive();

        IRWARiskEngine.RiskResult memory risk =
            riskEngine.evaluate(borrower, asset, position.collateralAmount, position.debtAmount);
        if (!risk.liquidatable) revert NotLiquidatable();

        position.status = PositionStatus.LIQUIDATION_PENDING;
        emit LiquidationInitiated(borrower, asset, position.collateralAmount, position.debtAmount);
    }

    function settleLiquidation(address borrower, address asset, uint256 settlementAmount)
        external
        onlyRole(LIQUIDATION_OPERATOR_ROLE)
        nonReentrant
    {
        Position storage position = _positions[borrower][asset];
        if (position.status != PositionStatus.LIQUIDATION_PENDING) {
            revert PositionNotInLiquidation();
        }

        uint256 debt = position.debtAmount;
        uint256 collateral = position.collateralAmount;
        uint256 debtRepaid = settlementAmount > debt ? debt : settlementAmount;
        uint256 surplus = settlementAmount > debt ? settlementAmount - debt : 0;
        uint256 badDebt = debt - debtRepaid;

        position.collateralAmount = 0;
        position.debtAmount = 0;
        position.status = PositionStatus.CLOSED;
        totalCollateralByAsset[asset] -= collateral;

        if (settlementAmount != 0) {
            settlementToken.safeTransferFrom(msg.sender, address(this), settlementAmount);
        }
        if (debtRepaid != 0) {
            settlementToken.safeTransfer(address(liquidityVault), debtRepaid);
            liquidityVault.recordRepayment(debtRepaid);
        }
        if (badDebt != 0) liquidityVault.recognizeBadDebt(badDebt);
        if (surplus != 0) settlementToken.safeTransfer(borrower, surplus);
        if (collateral != 0) IBurnableCollateral(asset).burn(collateral);

        emit LiquidationSettled(borrower, asset, settlementAmount, debtRepaid, surplus, badDebt);
    }

    function getPosition(address borrower, address asset) external view returns (Position memory) {
        return _positions[borrower][asset];
    }

    function getAccountRisk(address borrower, address asset)
        external
        view
        returns (IRWARiskEngine.RiskResult memory)
    {
        Position memory position = _positions[borrower][asset];
        return riskEngine.evaluate(borrower, asset, position.collateralAmount, position.debtAmount);
    }

    function _requireSupported(address asset)
        private
        view
        returns (IRWARegistry.AssetConfig memory config)
    {
        config = registry.getAssetConfig(asset);
        if (!config.enabled || config.oracle == address(0)) revert UnsupportedAsset();
    }

    function _requireEligible(
        IRWARegistry.AssetConfig memory config,
        address asset,
        address account
    ) private view {
        if (
            config.permissioned
                && !IComplianceAdapter(config.complianceAdapter).isEligible(asset, account)
        ) revert AccountNotEligible();
    }
}
