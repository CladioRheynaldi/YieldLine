# Frontend Analytics and Reference Integration

## 1. Product scope

Person 2 connects the dashboard to Person 1's interest-bearing contracts, adds event history and analytics, and provides an independent OpenEden production reference. Arbitrum Sepolia deployment is pending. Configuration and deployment scripts are ready; no new testnet addresses are invented.

## 2. Completed interfaces

| Screen | Implemented behavior |
|---|---|
| Lend | Contract borrow/supply APR, economic pool assets, cash available, debt including interest, share value, maximum withdrawal, personal cash flows and event history |
| Position | Current debt, interest since the last pool rate checkpoint, event-derived gross lifetime interest, borrower and liquidation history |
| Borrow | Existing collateral/borrow/partial-repay/withdraw actions plus full repayment against current accrued debt |
| Markets | OpenEden production NAV and token supply with chain, source, timestamp, stale and unavailable states |
| Admin | Existing mint/compliance/risk/liquidation actions; oracle backdating uses chain time |
| Wallet/actions | Wrong-network protection, rejection and failure messages, simulation, pending confirmation and replacement receipts |

Reads that fail never become a fabricated live zero balance. Writes require a valid deployment, the expected network, a connected wallet and successful protocol reads.

## 3. Contract read agreement

Use the generated ABIs in `packages/shared/src/generated/abis.ts`. Person 1 exposes `currentDebt`, `debtShares`, `borrowRateBps`, `supplyRateBps`, `rateAnchorIndex` and `DEBT_DENOMINATOR`. Pool reads include `totalAssets`, `availableLiquidity`, `totalBorrowed`, `totalBadDebt`, `convertToAssets`, `balanceOf` and `maxWithdraw`.

Protocol reads share a block number refreshed every ten seconds. Oracle age uses that block's timestamp, including when Anvil time is advanced. Amounts remain bigint until display formatting; MockUSDC uses six decimals, MockTBILL eighteen and rates basis points.

## 4. Interest and earnings semantics

Current debt already includes interest. Do not add the interest display to debt again.

Interest since the last pool rate checkpoint compares current debt with debt at the rate anchor. Pool activity can reset this interval; it is not unpaid interest since the original loan.

Gross lifetime borrower interest is reconstructed from Borrowed, Repaid and liquidation transitions, then the difference between the latest recorded debt and current debt. It includes interest previously paid or written off and micro-USDC origination rounding. Incomplete or inconsistent histories show Unavailable.

Lender net result = current share value + cumulative withdrawals − cumulative deposits. Deposits/withdrawals are attributed to the share owner. Net result includes receivables and losses, so it is not guaranteed cash yield. If history is incomplete or shares were transferred, lifetime cash-flow results show Unavailable because this demo has no transferred-share cost basis.

## 5. Event history

The credit vault provides collateral deposits, borrowing, repayments, collateral withdrawals, liquidation initiation and settlement. The liquidity vault provides ERC-4626 deposits, withdrawals and share transfers.

History starts at the deployment block, loads the latest 10,000 blocks first and allows older pages. Requests use 2,000-block chunks, retry smaller ranges for RPC range limits and deduplicate by transaction hash/log index. Confirmed events include amount, UTC time and an explorer link when available. Missing timestamps remain explicitly unavailable.

Loading, empty, incomplete and RPC-error states are distinct. Partial results never qualify as complete analytics. Local Anvil has no public explorer. Rejected and failed wallet requests have no confirmed event and remain in the action form. No indexer or historical price database is implied.

## 6. OpenEden read-only reference

Official address source, checked 2026-10-04: [OpenEden smart contract addresses](https://docs.openeden.com/tbill/smart-contract-addresses). Supported reads were checked against [OpenEden's published contracts](https://github.com/OpenEdenHQ/openeden.vault.audit).

| Field | Arbitrum One reference |
|---|---|
| Chain ID | 42161 |
| TBILL vault | `0xF84D28A8D28292842dD73D1c5F99476A80b6666A` |
| NAV oracle | `0xc0952c8ba068c887B675B4182F3A65420D045F46` |
| Vault reads | symbol, decimals, totalSupply, tbillUsdPriceFeed |
| Oracle reads | decimals, latestRoundData |

The server route `/api/openeden` uses a separate Arbitrum One client. It checks RPC chain, the vault's oracle getter, TBILL symbol, positive NAV, decimal bounds and round timestamps. Data older than 72 hours, or an RPC block lagging wall time by over two minutes, is labelled stale; these are demo display policies, not issuer guarantees.

Successful/stale results are cached for 60 seconds, failures for ten seconds. RPC errors produce Unavailable with no mock substitute. `OPENEDEN_ARBITRUM_RPC_URL` is server-only. No production approval, deposit, borrowing or redemption action exists. Production reference tokens are never used as the user's YieldLine collateral.

## 7. Deployment configuration for later

Copy only frontend variables from `.env.example` into `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_YIELDLINE_NETWORK=arbitrumSepolia
NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
OPENEDEN_ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
```

Keep deployment keys in the deployer's shell or a local ignored environment file used by Foundry. The deploy script runs from `contracts/`; do not assume a repository-root .env is automatically loaded there.

When the funded deployer and demo wallets are ready, export the deployment RPC/key and optional `DEMO_LENDER`/`DEMO_BORROWER`, then run:

```bash
pnpm deploy:sepolia
pnpm deployments:sync
pnpm abis
pnpm build
```

The deploy script writes `deployments/arbitrum-sepolia.json`; sync generates the shared record. Its chain ID must be 421614, deployment block present and all addresses nonzero. The frontend must be restarted/rebuilt after metadata changes. It stays labelled demo when no valid record exists. Old deployments lacking Person 1's reads require fresh deployment because these contracts are not upgradeable.

For Anvil use `NEXT_PUBLIC_YIELDLINE_NETWORK=anvil`, `NEXT_PUBLIC_ANVIL_RPC_URL=http://127.0.0.1:8545`, then deploy with `pnpm deploy:anvil` and restart the frontend.

## 8. Verification

CI installs Node 24, pinned pnpm and Foundry. It runs analytics/reference unit tests, TypeScript, lint, a production build, an isolated Anvil deployment and Chromium browser workflows. Browser tests use an injected EIP-1193 test wallet with real Anvil transactions; they do not automate the MetaMask extension.

```bash
pnpm install --frozen-lockfile
node --test frontend/tests/accounting.test.mjs
pnpm typecheck
pnpm lint
pnpm build
forge test --root contracts
```

Browser tests require a running seeded Anvil and a frontend build configured for Anvil:

```bash
npm install --prefix frontend/tests/browser --ignore-scripts --package-lock=false
cd frontend/tests/browser
npx playwright install chromium
npx playwright test
```

They verify lender supply/withdrawal, collateral deposit/borrow/full repayment/withdrawal after advancing time, actual event history, wrong network, wallet rejection, broadcast failure, pending confirmation and mobile reference separation. Traces/screenshots are retained as CI artifacts.

## 9. Remaining demo validation

After deployment, perform the same borrower/lender flow with the actual MetaMask extension on Arbitrum Sepolia, confirm explorer links and source verification, and test public RPC log availability from the deployment block. Fund the borrower with enough MockUSDC to repay interest. Ensure the admin refreshes the mock oracle after advancing time locally. Public production RPC uptime is external; Unavailable is an expected reference-panel state.
