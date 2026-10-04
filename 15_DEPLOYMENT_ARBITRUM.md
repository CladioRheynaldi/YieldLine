# Deployment to Arbitrum Sepolia

## 1. Network

Official Arbitrum Sepolia parameters:

```text
Network: Arbitrum Sepolia
Chain ID: 421614
Currency: SepoliaETH
RPC: https://sepolia-rollup.arbitrum.io/rpc
Explorer: https://sepolia.arbiscan.io
```

Always verify network parameters against official Arbitrum documentation before deployment.

## 2. Deployment order

Recommended:

```text
1. MockUSDC
2. ComplianceRegistry
3. MockTBILL
4. MockRWAOracle
5. OracleAdapter
6. RWARegistry
7. RWARiskEngine
8. USDCLiquidityVault
9. RWACreditVault
10. authorize CreditVault in LiquidityVault
11. register MockTBILL
12. mark CreditVault eligible for MockTBILL
13. configure admin/demo wallet eligibility
14. seed MockUSDC
15. seed MockTBILL
```

## 3. Foundry environment

Example variable names:

```text
ARBITRUM_SEPOLIA_RPC_URL=
DEPLOYER_PRIVATE_KEY=
ARBISCAN_API_KEY=
```

Never commit private keys.

## 4. Foundry configuration

Conceptual `foundry.toml` section:

```toml
[rpc_endpoints]
arbitrum_sepolia = "${ARBITRUM_SEPOLIA_RPC_URL}"
```

Use current Foundry verification configuration for Arbiscan/Etherscan-compatible explorers.

## 5. Deployment script responsibilities

The script should:

- deploy contracts
- wire addresses
- grant roles
- configure one collateral
- print addresses as JSON
- optionally write frontend deployment metadata

Suggested output:

```json
{
  "chainId": 421614,
  "mockUSDC": "0x...",
  "mockTBILL": "0x...",
  "complianceRegistry": "0x...",
  "oracle": "0x...",
  "registry": "0x...",
  "riskEngine": "0x...",
  "liquidityVault": "0x...",
  "creditVault": "0x..."
}
```

## 6. Post-deployment checks

Check:

```text
chain ID correct
admin roles correct
credit vault authorized
mock TBILL vault eligibility true
asset enabled
borrowing enabled
oracle returns expected NAV
oracle timestamp fresh
lender deposit succeeds
borrower deposit succeeds
borrow succeeds
explorer shows contract transactions
```

## 7. Demo seed values

Illustrative:

```text
Lender MockUSDC       100,000
Borrower MockTBILL    100,000
MockTBILL NAV         $1.05
```

Choose values that make calculations easy to explain.

## 8. Production-reference integration

If showing OpenEden production reference data:

- use a separate Arbitrum One public client
- keep it read-only
- clearly label chain/network
- fetch official addresses from current OpenEden documentation
- do not hard-code an address copied from an old workshop slide without re-verifying

## 9. Verification

Verify contracts when possible so workshop reviewers can inspect source.

## 10. Deployment record

After deployment create:

```text
deployments/arbitrum-sepolia.json
```

and record:

- chain ID
- deployment block
- contract addresses
- git commit
- timestamp
- deployer address

Do not store private key material.

## 11. Faucet/gas

Use official or reputable testnet faucet/bridge resources referenced by Arbitrum documentation. Testnet availability changes, so do not make the repository depend on a single faucet URL.

## 12. Run the current repository script

Sepolia deployment remains pending. Receiving Anvil funds does not fund Arbitrum Sepolia. Check the deployer on the target network:

```bash
cast chain-id --rpc-url https://sepolia-rollup.arbitrum.io/rpc
cast balance YOUR_DEPLOYER_ADDRESS --rpc-url https://sepolia-rollup.arbitrum.io/rpc --ether
```

Expected chain ID: 421614. Use a testnet-only deployer. Enter its key locally in Ubuntu/WSL without printing it or putting it in shell history:

```bash
export ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
read -rsp "Testnet deployer private key: " DEPLOYER_PRIVATE_KEY
printf '\n'
export DEPLOYER_PRIVATE_KEY
```

Optional: export `DEMO_LENDER` and `DEMO_BORROWER` with the two wallet addresses before deployment. Without them the script seeds both token balances to the deployer.

First simulate, then deploy without requiring an explorer API key:

```bash
cd contracts
forge script script/DeployYieldLine.s.sol --rpc-url arbitrum_sepolia
forge script script/DeployYieldLine.s.sol --rpc-url arbitrum_sepolia --broadcast
cd ..
node scripts/sync-deployments.mjs
unset DEPLOYER_PRIVATE_KEY
```

The script creates `deployments/arbitrum-sepolia.json` and the sync command updates the shared frontend addresses. Source verification is a separate step; `pnpm deploy:sepolia` already includes `--verify` and requires the configured `ARBISCAN_API_KEY`.

Set `NEXT_PUBLIC_YIELDLINE_NETWORK=arbitrumSepolia` and the public Sepolia RPC in `frontend/.env.local`, then restart or rebuild the frontend. Read [26_FRONTEND_ANALYTICS.md](26_FRONTEND_ANALYTICS.md) for configuration and demo checks.

## 13. Verify Person 1 before deployment

```bash
npm install --prefix contracts --ignore-scripts --package-lock=false
forge test --root contracts --match-contract InterestAccountingTest -vv
forge test --root contracts -vv
```

The focused suite has 21 tests; the complete suite has 113. A passing suite demonstrates the tested accounting behaviors without spending testnet ETH.

For the visual interest demo, start with Anvil: supply 100,000 MockUSDC, borrow 50,000, advance one year, refresh the oracle, inspect current debt and lender assets, mint enough MockUSDC for the interest and repay. Expected debt is about 53,500; economic pool assets about 103,500; available cash before repayment about 50,000. Time travel is available locally, not on public Arbitrum Sepolia.
