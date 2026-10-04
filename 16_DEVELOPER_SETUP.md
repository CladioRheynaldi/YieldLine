# Developer Setup

## 1. Prerequisites

Recommended:

```text
Git
Foundry
Node.js 20+
pnpm or npm
a browser wallet
Arbitrum Sepolia test ETH
```

## 2. Repository

Target structure:

```text
yieldline/
├── contracts/
│   ├── foundry.toml
│   ├── src/
│   ├── test/
│   └── script/
├── frontend/
│   ├── app/
│   ├── components/
│   └── lib/
├── packages/
│   └── shared/
└── docs/
```

## 3. Contract project

Example:

```bash
mkdir yieldline
cd yieldline
forge init contracts
```

Install current OpenZeppelin contracts using the package-management approach appropriate to your Foundry version.

## 4. Frontend

Example:

```bash
pnpm create next-app frontend --ts
cd frontend
pnpm add wagmi viem @tanstack/react-query
```

Add wallet-connection library/configuration according to current wagmi documentation.

## 5. Local chain

Run:

```bash
anvil
```

Deploy mocks locally first.

Do not begin with testnet deployment.

## 6. Development sequence

Recommended:

```text
contracts compile
      ↓
risk math unit tests
      ↓
mock token/compliance tests
      ↓
liquidity vault
      ↓
credit vault
      ↓
scenario tests
      ↓
local frontend
      ↓
Arbitrum Sepolia
```

## 7. Shared deployment config

Frontend should import or copy a generated deployment object rather than manually retyping addresses.

Example:

```ts
export const yieldLineDeployment = {
  chainId: 421614,
  creditVault: "0x...",
  liquidityVault: "0x...",
  mockTBILL: "0x...",
  mockUSDC: "0x..."
} as const
```

## 8. ABI workflow

After contract build:

- export required ABIs
- place generated artifacts in `packages/shared`
- import typed ABI in frontend

Avoid maintaining two manually edited ABIs.

## 9. Environment variables

Frontend example:

```text
NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL=
NEXT_PUBLIC_ARBITRUM_ONE_RPC_URL=
```

Contract deployment:

```text
ARBITRUM_SEPOLIA_RPC_URL=
DEPLOYER_PRIVATE_KEY=
```

Never prefix secrets with `NEXT_PUBLIC_`.

## 10. Quality commands

Target scripts:

```text
forge fmt
forge build
forge test
forge test -vvv

pnpm lint
pnpm build
```

## 11. Pre-demo checklist

- clean clone installs
- all tests pass
- frontend production build passes
- testnet contracts reachable
- demo wallets funded
- borrower and vault allowlisted
- oracle fresh
- testnet RPC fallback available if possible
- transaction links open correctly
