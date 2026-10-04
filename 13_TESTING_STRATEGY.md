# Testing Strategy

## 1. Tooling

Recommended:

- Foundry `forge test`
- Foundry fuzz testing
- Foundry invariant testing
- optional Anvil integration scripts
- frontend unit/component tests
- Playwright only after core flows work

## 2. Unit-test groups

### MockTBILL

Test:

- eligible mint
- ineligible mint if enforced
- eligible transfer
- transfer to ineligible recipient reverts
- vault must be eligible
- admin access

### ComplianceRegistry

Test:

- admin update
- unauthorized update
- per-asset eligibility separation

### RWARegistry

Test:

- register asset
- invalid LTV relationship
- invalid oracle-age relationship
- disable borrowing
- disable asset
- unauthorized configuration

### Oracle

Test:

- normal price
- zero price
- future timestamp
- invalid status
- stale status

### Risk engine

Test exact arithmetic for:

- raw value
- every BPS factor
- freshness boundaries
- borrow capacity
- liquidation capacity
- HF with zero debt
- HF = 1 boundary
- decimal conversions

### Credit vault

Test:

- deposit
- unsupported asset
- ineligible deposit
- borrow under limit
- borrow exactly at limit
- borrow one unit above limit
- repay partial
- repay full
- safe withdrawal
- unsafe withdrawal
- stale oracle
- paused borrowing
- liquidation transitions

### Liquidity vault

Test:

- ERC-4626 share math
- multiple lenders
- authorized draw
- unauthorized draw
- repayment
- available-liquidity max withdrawal
- share value after interest

## 3. Fuzz tests

Fuzz:

- collateral amounts
- prices
- LTV values within valid range
- debt
- oracle age

Properties:

```text
borrowCapacity <= effectiveCollateral
liquidationCapacity <= effectiveCollateral
effectiveCollateral <= rawCollateralValue
increasing debt never increases health factor
decreasing NAV never increases health factor
increasing haircut never increases borrow capacity
```

## 4. Invariants

Recommended invariants:

### INV-01

Credit vault cannot create MockUSDC.

### INV-02

Total recorded debt equals or is reconciled with liquidity-vault outstanding borrow accounting.

### INV-03

A borrower cannot withdraw collateral and leave an unsafe active position.

### INV-04

A position in liquidation cannot borrow.

### INV-05

Only authorized protocol contract can draw lender liquidity.

### INV-06

ERC-4626 shares cannot redeem more economic assets than the holder owns.

### INV-07

MockTBILL cannot transfer to an ineligible address.

## 5. Scenario tests

### Scenario A — happy path

```text
lender supplies
borrower gets MockTBILL
borrower allowlisted
vault allowlisted
borrower deposits
borrower borrows
time advances
borrower repays
borrower withdraws
```

### Scenario B — stale oracle

```text
healthy position
advance oracle age
freshness falls
borrow capacity falls
new borrow eventually disabled
```

### Scenario C — NAV shock

```text
healthy position
NAV falls
HF < 1
liquidation initiated
settlement operator settles
position closes
```

### Scenario D — liquidity shortage

```text
lender supplies small amount
borrower has high collateral capacity
borrow exceeds pool cash
transaction reverts with InsufficientLiquidity
```

## 6. Decimal tests

Specifically test:

```text
MockUSDC = 6 decimals
MockTBILL = 18 decimals
price = 18 decimals
```

Include low-value and one-unit edge cases.

## 7. Fork tests

Optional only.

If testing a live reference oracle on Arbitrum One:

- pin a block
- verify ABI
- use read-only calls
- never make the MVP dependent on fork tests passing against changing production state

## 8. Coverage target

Prioritize branch coverage of financial and authorization paths over a vanity number.

Before demo, every function that moves value must have:

- success test
- authorization failure test
- key boundary failure test
