# Backlog

## P0 — Required MVP

- [ ] MockUSDC
- [ ] MockTBILL with permissioned transfer behavior
- [ ] ComplianceRegistry
- [ ] MockRWAOracle
- [ ] RWARegistry
- [ ] OracleAdapter
- [ ] RWARiskEngine
- [ ] USDCLiquidityVault
- [ ] RWACreditVault
- [ ] deposit collateral
- [ ] borrow
- [ ] repay
- [ ] withdraw
- [ ] health factor
- [ ] stale oracle handling
- [ ] pending liquidation
- [ ] mock settlement
- [ ] Arbitrum Sepolia deploy script
- [ ] frontend wallet connection
- [ ] borrower dashboard
- [ ] lender dashboard
- [ ] admin simulator
- [ ] scenario test suite

## P1 — Strong demo enhancements

- [ ] variable utilization-based APR
- [ ] interest index
- [ ] partial collateral withdrawal
- [ ] transaction history from events
- [ ] production OpenEden read-only panel
- [ ] explorer links
- [ ] risk breakdown visualization
- [ ] one-click demo scenario presets
- [ ] contract source verification

## P2 — Protocol improvements

- [ ] insurance reserve
- [ ] bad-debt resolution policy
- [ ] timelock
- [ ] multisig administration
- [ ] permissioned liquidation market
- [ ] redemption adapter
- [ ] multiple collateral assets
- [ ] per-asset debt ceilings
- [ ] borrower-level exposure caps
- [ ] protocol fee
- [ ] utilization kink curve
- [ ] indexer/subgraph
- [ ] historical risk charts

## P3 — Arbitrum-native extensions

- [ ] Rust Stylus implementation of risk engine
- [ ] compare gas/cost against Solidity engine
- [ ] reusable Stylus risk library

## P4 — Institutional architecture

- [ ] issuer integration framework
- [ ] real compliance registry adapters
- [ ] legal-transfer eligibility workflow
- [ ] reserve-attestation adapter
- [ ] redemption queue telemetry
- [ ] custodian-risk metadata
- [ ] asset-specific liquidation handlers
- [ ] risk governance process

## Research questions

- How should lender withdrawals be queued when most USDC is borrowed?
- Should deferred liquidations freeze debt interest?
- Who bears NAV movement during the redemption interval?
- Should settlement factors depend dynamically on queue depth?
- How should bad debt be allocated?
- Can an RWA issuer provide an approved liquidation/redemption contract for protocols?
- Which production RWAs expose sufficiently reliable onchain NAV timestamps?
- Which RWA token standards expose holder eligibility consistently?
