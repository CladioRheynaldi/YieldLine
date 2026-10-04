# Compliance and Permissioned-Asset Design

## 1. Scope

YieldLine does not perform real KYC in the workshop MVP.

It models the **onchain consequence** of compliance:

> some addresses are eligible to hold or receive an asset and others are not.

## 2. MVP registry

```solidity
mapping(address asset =>
    mapping(address account => bool)
) public eligible;
```

API:

```solidity
setEligibility(asset, account, eligible)
isEligible(asset, account)
```

## 3. Deposit rules

For a permissioned asset:

```text
borrower eligible?
        ↓ no
reject

vault eligible?
        ↓ no
underlying token transfer may fail

both eligible
        ↓
accept collateral
```

For `MockTBILL`, enforce both sides in the token transfer hook.

## 4. Withdrawal rules

Before withdrawal:

- borrower still eligible
- transfer is permitted
- remaining position stays healthy

If a borrower loses eligibility while collateral is locked, production behavior is issuer- and jurisdiction-specific.

MVP behavior:

- repayment remains possible
- standard withdrawal may be blocked if mock token requires eligibility
- admin recovery path can exist only if explicitly documented and tested

Do not invent real legal behavior.

## 5. Liquidation eligibility

A production restricted token may not be transferable to any random liquidator.

YieldLine therefore separates:

```text
permissionless market liquidation
permissioned market liquidation
issuer/redemption liquidation
```

The MVP focuses on redemption-style deferred liquidation.

## 6. Adapter architecture

```solidity
interface IComplianceAdapter {
    function isEligible(
        address asset,
        address account
    ) external view returns (bool);
}
```

Future adapters may point to:

- issuer allowlist
- ERC-3643 identity/compliance contracts
- custom institutional registry

## 7. Privacy

Do not store:

- names
- identity documents
- passports
- personal addresses
- KYC records

onchain.

Store only eligibility state or references designed for public-chain use.

## 8. UI

Display:

```text
Eligibility: Verified for demo
```

not:

```text
KYC passed by YieldLine
```

unless YieldLine actually runs such a process.

For workshop assets, label the status:

> Demo allowlist only. This is not real KYC/KYB verification.

## 9. Production integration checklist

Before supporting an actual permissioned RWA:

- confirm vault can be approved/whitelisted
- confirm transfer rules
- confirm lender/borrower restrictions
- confirm liquidator/redemption actor requirements
- confirm redemption API/contract semantics
- confirm jurisdictional restrictions with issuer/legal counsel
- confirm oracle source and update process
- confirm terms permit use as collateral
