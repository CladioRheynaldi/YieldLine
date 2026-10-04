# Architecture Decisions and Assumptions

## ADR-001 — Use MockTBILL for transactional demo

**Decision:** Use a test token that models permissioned transfers and NAV pricing.

**Why:** A production permissioned RWA may require investor onboarding and the YieldLine vault itself may need issuer approval.

**Consequence:** Production RWA data is reference-only until a legitimate integration is established.

## ADR-002 — Deploy MVP to Arbitrum Sepolia

**Decision:** Use chain ID 421614.

**Why:** Full EVM environment without risking real funds.

## ADR-003 — Solidity first

**Decision:** Implement initial contracts in Solidity.

**Why:** Faster workshop delivery, common tooling, easier ERC-20/ERC-4626 integration.

**Future:** Port pure risk engine to Stylus/Rust behind the same interface.

## ADR-004 — Non-upgradeable contracts

**Decision:** Avoid proxies in MVP.

**Why:** Reduce complexity and upgrade-admin risk.

## ADR-005 — Explainable risk model

**Decision:** Use explicit BPS haircuts.

**Why:** Easy to audit, test, and explain.

**Rejected for MVP:** opaque ML risk score.

## ADR-006 — Compliance is binary

**Decision:** `eligible / not eligible`.

**Why:** Compliance status should not be disguised as a numeric credit factor.

## ADR-007 — Stale price blocks new risk

**Decision:** Degrade borrowing capacity with age and disable new borrowing at hard stale.

**Important:** Hard-stale data alone should not trigger automatic liquidation.

## ADR-008 — Deferred liquidation

**Decision:** Model liquidation as pending settlement.

**Why:** Some RWAs cannot be instantly sold or transferred to arbitrary wallets.

## ADR-009 — ERC-4626 lender shares

**Decision:** Use standard vault shares for MockUSDC suppliers.

**Why:** Standard interface and clear lender accounting.

## ADR-010 — No backend required for core MVP

**Decision:** Contract state is queried directly.

**Why:** Reduce moving parts.

**Future:** Add indexer for analytics and history.

## ADR-011 — One collateral asset first

**Decision:** Complete MockTBILL end-to-end before adding another asset.

**Why:** Multi-asset support is valuable only after one complete lifecycle works.

## ADR-012 — Admin simulator is a feature

**Decision:** Include explicit demo controls.

**Why:** The value of YieldLine is easiest to demonstrate through NAV/oracle-state transitions.

The simulator must be clearly labeled as admin/mock functionality.

## Assumptions

MVP assumptions:

- MockUSDC maintains a conceptual $1 value
- MockTBILL NAV comes from admin-controlled mock oracle
- liquidation operator can simulate redemption settlement
- no real KYC occurs
- no real securities are issued or custodied
- one chain only
- all assets are explicitly allowlisted
