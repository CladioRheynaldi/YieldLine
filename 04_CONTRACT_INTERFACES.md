# Suggested Contract Interfaces

These are design targets, not copy-paste production contracts.

## 1. Oracle

```solidity
interface IRWAOracle {
    struct PriceData {
        uint256 price;       // standardized to 1e18 USD
        uint256 updatedAt;
        bool valid;
    }

    function latestPrice(address asset)
        external
        view
        returns (PriceData memory);
}
```

## 2. Compliance

```solidity
interface IComplianceAdapter {
    function isEligible(
        address asset,
        address account
    ) external view returns (bool);
}
```

## 3. Registry

```solidity
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

    function getAssetConfig(address asset)
        external
        view
        returns (AssetConfig memory);
}
```

## 4. Risk engine

```solidity
interface IRWARiskEngine {
    struct RiskResult {
        uint256 price;
        uint256 rawCollateralValue;
        uint256 effectiveCollateralValue;
        uint256 borrowCapacity;
        uint256 liquidationCapacity;
        uint256 debtValue;
        uint256 healthFactor;
        uint256 freshnessFactorBps;
        bool oracleValid; // source valid, nonzero price, timestamp not in the future
        bool canBorrow;
        bool liquidatable;
    }

    function evaluate(
        address borrower,
        address asset,
        uint256 collateralAmount,
        uint256 debtAmount
    ) external view returns (RiskResult memory);
}
```

For pre-borrow simulation, either:

- pass hypothetical debt into `evaluate`, or
- expose a dedicated `maxBorrow` function.

## 5. Liquidity vault

```solidity
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
```

Borrowers approve the credit vault. It transfers repayment cash into the liquidity vault and then calls `recordRepayment(assets, sharesBurned)`. All three debt-mutating APIs require the credit-vault role. Debt write-offs remove shares, including accrued interest.

## 6. Credit vault

```solidity
interface IRWACreditVault {
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

    function depositCollateral(address asset, uint256 amount) external;

    function withdrawCollateral(address asset, uint256 amount) external;

    function borrow(address asset, uint256 amount) external;

    function repay(address asset, uint256 amount) external returns (uint256 paid);

    function repayAll(address asset) external returns (uint256 paid);

    function currentDebt(address borrower, address asset) external view returns (uint256);

    function initiateLiquidation(address borrower, address asset) external;

    function settleLiquidation(
        address borrower,
        address asset,
        uint256 settlementAmount
    ) external;

    function getPosition(address borrower, address asset)
        external
        view
        returns (Position memory);
}
```

## 7. Suggested events

```solidity
event CollateralDeposited(
    address indexed borrower,
    address indexed asset,
    uint256 amount
);

event CollateralWithdrawn(
    address indexed borrower,
    address indexed asset,
    uint256 amount
);

event Borrowed(
    address indexed borrower,
    address indexed asset,
    uint256 amount,
    uint256 debtAfter
);

event Repaid(
    address indexed borrower,
    address indexed asset,
    uint256 amount,
    uint256 debtAfter
);

event LiquidationInitiated(
    address indexed borrower,
    address indexed asset,
    uint256 collateralAmount,
    uint256 debtAmount
);

event LiquidationSettled(
    address indexed borrower,
    address indexed asset,
    uint256 settlementAmount,
    uint256 debtRepaid,
    uint256 surplus
);
```

## 8. ABI stability goal

Keep the risk engine behind an interface from day one.

That enables a later migration:

```text
Solidity Risk Engine
        ↓
Rust Stylus Risk Engine
```

without redesigning the credit-vault API.
