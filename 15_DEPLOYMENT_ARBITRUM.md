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
