# System Architecture

## 1. Overview

YieldLine consists of four logical layers:

1. asset and compliance adapters
2. risk calculation
3. credit and liquidity accounting
4. frontend/read layer

```mermaid
flowchart LR
    subgraph Client
      FE[Next.js App]
      WALLET[Wallet]
    end

    subgraph ArbitrumSepolia[Arbitrum Sepolia]
      CR[ComplianceRegistry]
      RR[RWARegistry]
      OR[MockRWAOracle]
      OA[Oracle Adapter]
      RE[RWARiskEngine]
      CV[RWACreditVault]
      LV[USDCLiquidityVault]
      TB[MockTBILL]
      UC[MockUSDC]
    end

    WALLET --> FE
    FE --> CV
    FE --> LV
    FE --> RR
    FE --> OR

    CV --> RR
    CV --> RE
    CV --> LV
    CV --> TB

    RE --> RR
    RE --> OA
    RE --> CR
    OA --> OR

    LV --> UC
    CV --> UC
```

## 2. Trust boundaries

### Onchain trusted configuration

For the workshop, an administrator controls:

- supported-asset registration
- risk parameters
- mock compliance status
- mock oracle updates
- pause controls
- liquidation settlement

This centralization is intentional for MVP speed and must be displayed in the docs/UI.

### Oracle boundary

The credit system trusts an oracle adapter to provide:

- price
- timestamp
- validity

A non-zero price is not sufficient; timestamp freshness must also be checked.

### Compliance boundary

The protocol trusts the compliance adapter to determine whether an address is eligible for a particular asset.

The workshop adapter is a simple mapping. A production adapter may query an issuer-owned registry.

### External asset boundary

YieldLine cannot assume a production permissioned token is transferable to its vault. Production integration requires issuer-specific eligibility and transfer compatibility.

## 3. Main borrow sequence

```mermaid
sequenceDiagram
    participant B as Borrower
    participant C as CreditVault
    participant R as RiskEngine
    participant O as OracleAdapter
    participant L as LiquidityVault

    B->>C: depositCollateral(asset, amount)
    C->>C: check support/compliance
    C->>C: transferFrom borrower

    B->>C: borrow(asset, amount)
    C->>R: getAccountRisk(borrower, asset)
    R->>O: latestPrice(asset)
    O-->>R: price, updatedAt
    R-->>C: borrowCapacity, health metrics
    C->>C: validate post-borrow health
    C->>L: borrowTo(borrower, amount)
    L-->>B: MockUSDC
```

## 4. Repay sequence

```mermaid
sequenceDiagram
    participant B as Borrower
    participant C as CreditVault
    participant L as LiquidityVault

    B->>C: repay(amount)
    C->>C: accrue interest
    C->>B: transferFrom MockUSDC
    C->>L: returnLiquidity(amount)
    C->>C: reduce debt
```

An implementation may have the vault pull USDC directly into the liquidity vault. Choose one canonical flow and test it.

## 5. Deferred liquidation sequence

```mermaid
stateDiagram-v2
    [*] --> Healthy
    Healthy --> Warning: health factor approaches threshold
    Warning --> Healthy: collateral/debt improves
    Warning --> PendingLiquidation: HF < 1
    Healthy --> PendingLiquidation: HF < 1
    PendingLiquidation --> SettlementPending: liquidation initiated
    SettlementPending --> Settled: mock redemption settled
    Settled --> Closed
```

MVP implementation may collapse `PendingLiquidation` and `SettlementPending` into one state.

## 6. Read-only production reference path

The frontend may show current information from a production RWA contract or official oracle using an RPC read.

```mermaid
flowchart LR
    PROD[Production RWA contracts on Arbitrum One]
    CLIENT[Frontend public client]
    CARD[Live Reference Data card]

    PROD --> CLIENT --> CARD
```

Important:

- no production transactions are required
- production data must be visually labeled as reference data
- the workshop position uses testnet mock assets

## 7. Upgrade strategy

MVP recommendation:

- deploy non-upgradeable contracts
- redeploy when changing implementation
- keep configuration mutable only where necessary

Reason:

Upgrade proxies add storage-layout and admin risk that are unnecessary for a workshop prototype.

## 8. Optional backend

Do not introduce a backend unless needed.

The MVP can read:

- positions from contracts
- events from RPC
- market state from public clients

An indexer becomes useful for:

- transaction history
- aggregate analytics
- many users/assets
- historical risk charts

See `12_EVENTS_AND_INDEXING.md`.

## 9. Arbitrum-specific extension

Post-MVP, `RWARiskEngine` can be moved to a Rust Stylus contract while retaining Solidity vaults. Keep the initial ABI clean so the engine is replaceable through an interface.
