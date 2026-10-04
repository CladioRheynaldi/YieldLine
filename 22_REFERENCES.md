# References

These links are included to ground the architecture in current official documentation. Re-verify addresses, ABIs, eligibility requirements, fees, and network parameters before production use.

## Arbitrum

### Documentation

https://docs.arbitrum.io/

### Arbitrum bridge quickstart / network parameters

https://docs.arbitrum.io/arbitrum-bridge/quickstart

At the time this documentation pack was prepared, official docs listed:

```text
Arbitrum One chain ID:     42161
Arbitrum Sepolia chain ID: 421614
Arbitrum Sepolia RPC:      https://sepolia-rollup.arbitrum.io/rpc
```

## OpenEden TBILL

### Introduction

https://docs.openeden.com/tbill

OpenEden describes TBILL as exposure to a pool of short-dated U.S. Treasury Bills and USD, with the token backed by fund assets.

### Product structuring

https://docs.openeden.com/tbill/product-structuring

Relevant architecture point:

- TBILL is a permissioned token
- current transfers are limited to whitelisted wallets

### Investor onboarding

https://docs.openeden.com/tbill/investor-onboarding

Relevant architecture point:

- onboarding includes KYC/KYT before wallet whitelisting

### Token price

https://docs.openeden.com/tbill/token-price

Relevant architecture point:

- token price is based on NAV per token
- an onchain price oracle is documented

### Redemptions

https://docs.openeden.com/tbill/redemptions

Relevant architecture point:

- redemption requests enter a FIFO queue
- documentation says redemptions are typically processed on the next U.S. business day

### Smart-contract addresses

https://docs.openeden.com/tbill/smart-contract-addresses

Use this page rather than copying addresses permanently into architectural documentation. Contract deployments may change.

### Trust and transparency

https://docs.openeden.com/tbill/trust-and-transparency

Relevant architecture point:

- reserve/NAV reporting and offchain custody are part of the RWA trust model

## Ethereum token standards

### ERC-20

https://eips.ethereum.org/EIPS/eip-20

### ERC-4626

https://eips.ethereum.org/EIPS/eip-4626

## OpenZeppelin

https://docs.openzeppelin.com/contracts/

Use the current documented library APIs rather than relying on old code samples.

## ERC-3643

https://docs.erc3643.org/

This is a useful reference for permissioned-token identity/compliance architecture. YieldLine MVP does not require full ERC-3643 implementation.

## Verification note

This project is a software prototype. The references above describe external systems and standards; they do not imply endorsement, partnership, legal approval, or integration authorization.
