# Smart Contract Specification

## 1. Contract set

```text
contracts/src/
├── mocks/
│   ├── MockUSDC.sol
│   ├── MockTBILL.sol
│   └── MockRWAOracle.sol
├── ComplianceRegistry.sol
├── RWARegistry.sol
├── OracleAdapter.sol
├── RWARiskEngine.sol
├── USDCLiquidityVault.sol
└── RWACreditVault.sol
```

Optional post-MVP:

```text
├── InsuranceReserve.sol
├── RedemptionAdapter.sol
└── GovernanceTimelock.sol
```

## 2. `MockUSDC.sol`

Purpose:

- six-decimal ERC-20 test settlement token
- owner/admin faucet or mint function

Requirements:

- `decimals() == 6`
- arbitrary minting only in test/demo context
- clearly named mock token

Suggested roles:

- `DEFAULT_ADMIN_ROLE`
- `MINTER_ROLE`

## 3. `MockTBILL.sol`

Purpose:

Simulate a permissioned RWA.

Requirements:

- ERC-20
- recommended 18 decimals unless integration requirements prefer otherwise
- allowlisted sender and recipient checks
- admin minting
- optional pause

Important:

If transfer restrictions are active, the `RWACreditVault` address must itself be allowlisted before deposits work.

Suggested hook behavior:

```text
mint:
recipient must be eligible

transfer:
sender and recipient must be eligible

burn:
sender must be eligible
```

For demo simplicity, allow minting by admin even if needed for faucet setup, but document the behavior.

## 4. `ComplianceRegistry.sol`

Purpose:

Demo compliance source.

Storage concept:

```solidity
mapping(address asset => mapping(address account => bool)) eligible;
```

Functions:

- `setEligibility(asset, account, bool)`
- `isEligible(asset, account)`

Roles:

- admin/compliance operator

Events:

- `EligibilityUpdated(asset, account, eligible)`

## 5. `RWARegistry.sol`

Purpose:

Store collateral configuration.

Storage:

```solidity
mapping(address asset => AssetConfig)
```

Example configuration fields:

```solidity
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
```

Do not overpack storage prematurely if clarity suffers.

## 6. `OracleAdapter.sol`

Purpose:

Return a normalized USD price and timestamp.

Suggested return:

```solidity
struct PriceData {
    uint256 price;
    uint8 decimals;
    uint256 updatedAt;
    bool valid;
}
```

MVP may standardize output to 18 decimals and omit `decimals` from downstream calculations.

Checks:

- price > 0
- timestamp != 0
- timestamp <= block.timestamp
- source-specific validity

## 7. `RWARiskEngine.sol`

Purpose:

Pure/view risk calculations.

Must not custody funds.

Responsibilities:

- collateral USD value
- oracle freshness factor
- liquidity haircut
- settlement haircut
- effective collateral value
- maximum borrow
- liquidation threshold
- health factor
- borrow eligibility

Prefer deterministic, inspectable formulas.

## 8. `USDCLiquidityVault.sol`

Purpose:

ERC-4626 lender pool.

Asset:

- MockUSDC

Responsibilities:

- lender deposits/withdrawals
- vault share accounting
- controlled borrowing by `RWACreditVault`
- repayment
- available-liquidity reporting
- utilization reporting

Authorization:

Only authorized credit-vault contracts may call liquidity draw/return functions.

## 9. `RWACreditVault.sol`

Purpose:

Borrower position manager and collateral custodian.

Recommended initial rule:

One position per `(borrower, collateralAsset)`.

Storage:

```solidity
struct Position {
    uint256 collateralAmount;
    uint256 debtPrincipal;
    uint256 debtIndexSnapshot;
    PositionStatus status;
}
```

Potential enum:

```solidity
enum PositionStatus {
    NONE,
    ACTIVE,
    LIQUIDATION_PENDING,
    CLOSED
}
```

Core actions:

- deposit collateral
- withdraw collateral
- borrow
- repay
- initiate liquidation
- settle liquidation

## 10. Interest accounting

For the workshop, choose one approach and keep it consistent.

Recommended:

- global borrow index
- debt shares or normalized debt
- update index on state-changing interactions

Simpler fallback:

- calculate simple interest from `lastAccruedAt`

Avoid per-second loops.

## 11. Access control

Suggested roles:

```text
PROTOCOL_ADMIN
RISK_ADMIN
COMPLIANCE_ADMIN
ORACLE_UPDATER   # mock only
LIQUIDATION_OPERATOR
```

For a very small MVP, roles can be consolidated, but names should remain conceptually separate.

## 12. Pausing

Pause at least:

- borrowing
- new collateral deposits
- liquidation settlement if necessary

Repayment should generally remain available while paused.

Collateral withdrawal should only remain available if safe.

## 13. Contract dependency rules

`RWARiskEngine` may read:

- RWARegistry
- Oracle adapter
- compliance adapter if needed

`RWACreditVault` should call the risk engine rather than reimplementing formulas.

`USDCLiquidityVault` should not understand RWA-specific risk.

This separation keeps the lending pool reusable.

## 14. Error style

Use custom errors.

Examples:

```solidity
error UnsupportedAsset();
error BorrowingDisabled();
error AccountNotEligible();
error OracleInvalid();
error OracleHardStale();
error InsufficientCollateral();
error InsufficientLiquidity();
error PositionInLiquidation();
error UnsafeWithdrawal();
```

## 15. Event coverage

Every meaningful state mutation should emit an event.

At minimum:

- collateral deposit/withdrawal
- borrow
- repay
- interest accrual checkpoint if useful
- liquidation initiated/settled
- asset config changed
- eligibility changed
- pause state changed
