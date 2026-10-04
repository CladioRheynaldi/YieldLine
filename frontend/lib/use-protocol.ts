"use client";

import {
  complianceRegistryAbi,
  creditVaultAbi,
  liquidityVaultAbi,
  mockOracleAbi,
  mockTbillAbi,
  mockUsdcAbi,
  oracleAdapterAbi,
  registryAbi,
} from "@yieldline/shared";
import { useEffect, useState } from "react";
import { keccak256, toBytes, zeroAddress, type Address } from "viem";
import { useConnection, useReadContracts } from "wagmi";

import { demoView } from "./demo-data";
import {
  TBILL_DECIMALS,
  formatAge,
  formatBps,
  formatHealthFactor,
  formatToken,
  formatUsdWad,
  formatUsdc,
} from "./format";
import { chain, deployment } from "./network";
import { healthTone, wadToUsdcFloor, type RiskInputs } from "./risk-math";

export type Tone = "healthy" | "warning" | "danger" | "neutral";
export type PositionStage = "NONE" | "ACTIVE" | "WARNING" | "LIQUIDATION_PENDING" | "CLOSED";

export type ProtocolView = {
  mode: "demo" | "live";
  loading: boolean;
  connected: boolean;
  account: Address | undefined;
  market: {
    asset: string;
    model: string;
    nav: string;
    priceType: string;
    oracleStatus: string;
    oracleAge: string;
    oracleTone: Tone;
    baseLtv: string;
    liquidationLtv: string;
    liquidityFactor: string;
    settlementFactor: string;
    freshnessFactor: string;
    effectiveLtv: string;
    redemptionDelay: string;
    permissioned: string;
    borrowingEnabled: boolean;
    paused: boolean;
  };
  position: {
    collateral: string;
    rawValue: string;
    effectiveValue: string;
    borrowCapacity: string;
    debt: string;
    availableBorrow: string;
    liquidationCapacity: string;
    healthFactor: string;
    status: string;
    stage: PositionStage;
    tone: Tone;
  };
  pool: {
    totalSupplied: string;
    availableLiquidity: string;
    borrowed: string;
    utilization: string;
    borrowApr: string;
    supplyApr: string;
    badDebt: string;
  };
  wallet: {
    tbill: string;
    usdc: string;
    shareValue: string;
    maxWithdraw: string;
    eligible: boolean | null;
  };
  /** Exact onchain values for transaction forms; null in demo mode or while loading. */
  raw: RawState | null;
  roles: {
    oracleUpdater: boolean;
    complianceAdmin: boolean;
    riskAdmin: boolean;
    protocolAdmin: boolean;
    liquidationOperator: boolean;
    minter: boolean;
  };
};

export type RawState = {
  risk: RiskInputs;
  oracleValid: boolean;
  canBorrow: boolean;
  liquidatable: boolean;
  collateral: bigint;
  debt: bigint;
  status: number;
  borrowCapacity: bigint;
  liquidationCapacity: bigint;
  healthFactor: bigint;
  availableLiquidity: bigint;
  tbillBalance: bigint;
  usdcBalance: bigint;
  tbillAllowance: bigint;
  usdcAllowanceCredit: bigint;
  usdcAllowancePool: bigint;
  maxWithdraw: bigint;
  eligible: boolean;
};

const role = (name: string) => keccak256(toBytes(name));
const ROLES = {
  oracleUpdater: role("ORACLE_UPDATER_ROLE"),
  complianceAdmin: role("COMPLIANCE_ADMIN_ROLE"),
  riskAdmin: role("RISK_ADMIN_ROLE"),
  protocolAdmin: role("PROTOCOL_ADMIN_ROLE"),
  liquidationOperator: role("LIQUIDATION_OPERATOR_ROLE"),
  minter: role("MINTER_ROLE"),
};

const dash = "—";
const STATUS_LABELS =["No position", "Active", "Liquidation pending", "Closed"] as const;
const STATUS_STAGES: PositionStage[] = ["NONE", "ACTIVE", "LIQUIDATION_PENDING", "CLOSED"];

/** Seconds since epoch, updated every 15s on the client only (avoids hydration mismatch). */
export function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Math.floor(Date.now() / 1000));
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

// Demo borrow APR model from 10_LIQUIDITY_VAULT.md. Interest does not accrue onchain in the MVP.
function estimateAprs(utilizationBps: bigint) {
  const utilization = Number(utilizationBps) / 10_000;
  const borrow = 0.03 + utilization * 0.08;
  return { borrow: borrow * 100, supply: borrow * utilization * 100 };
}

export function useProtocol(): ProtocolView {
  const { address, isConnected, chainId } = useConnection();
  const now = useNow();
  const d = deployment;
  const account = address ?? zeroAddress;
  const enabled = Boolean(d);
  const query = { enabled, refetchInterval: 10_000 };
  const contracts = d ?? {
    mockTBILL: zeroAddress,
    mockUSDC: zeroAddress,
    registry: zeroAddress,
    oracleAdapter: zeroAddress,
    liquidityVault: zeroAddress,
    creditVault: zeroAddress,
    complianceRegistry: zeroAddress,
    mockOracle: zeroAddress,
  };
  const tbill = contracts.mockTBILL;

  const market = useReadContracts({
    allowFailure: false,
    query,
    contracts: [
      { address: contracts.registry, abi: registryAbi, functionName: "getAssetConfig", args: [tbill], chainId: chain.id },
      { address: contracts.oracleAdapter, abi: oracleAdapterAbi, functionName: "latestPrice", args: [tbill], chainId: chain.id },
      { address: contracts.liquidityVault, abi: liquidityVaultAbi, functionName: "totalAssets", chainId: chain.id },
      { address: contracts.liquidityVault, abi: liquidityVaultAbi, functionName: "availableLiquidity", chainId: chain.id },
      { address: contracts.liquidityVault, abi: liquidityVaultAbi, functionName: "totalBorrowed", chainId: chain.id },
      { address: contracts.liquidityVault, abi: liquidityVaultAbi, functionName: "utilizationBps", chainId: chain.id },
      { address: contracts.liquidityVault, abi: liquidityVaultAbi, functionName: "totalBadDebt", chainId: chain.id },
      { address: contracts.creditVault, abi: creditVaultAbi, functionName: "paused", chainId: chain.id },
      { address: contracts.liquidityVault, abi: liquidityVaultAbi, functionName: "totalSupply", chainId: chain.id },
    ],
  });

  const user = useReadContracts({
    allowFailure: false,
    query,
    contracts: [
      { address: contracts.creditVault, abi: creditVaultAbi, functionName: "getPosition", args: [account, tbill], chainId: chain.id },
      { address: contracts.creditVault, abi: creditVaultAbi, functionName: "getAccountRisk", args: [account, tbill], chainId: chain.id },
      { address: tbill, abi: mockTbillAbi, functionName: "balanceOf", args: [account], chainId: chain.id },
      { address: contracts.mockUSDC, abi: mockUsdcAbi, functionName: "balanceOf", args: [account], chainId: chain.id },
      { address: tbill, abi: mockTbillAbi, functionName: "allowance", args: [account, contracts.creditVault], chainId: chain.id },
      { address: contracts.mockUSDC, abi: mockUsdcAbi, functionName: "allowance", args: [account, contracts.creditVault], chainId: chain.id },
      { address: contracts.mockUSDC, abi: mockUsdcAbi, functionName: "allowance", args: [account, contracts.liquidityVault], chainId: chain.id },
      { address: contracts.liquidityVault, abi: liquidityVaultAbi, functionName: "balanceOf", args: [account], chainId: chain.id },
      { address: contracts.liquidityVault, abi: liquidityVaultAbi, functionName: "maxWithdraw", args: [account], chainId: chain.id },
      { address: contracts.complianceRegistry, abi: complianceRegistryAbi, functionName: "isEligible", args: [tbill, account], chainId: chain.id },
    ],
  });

  const roles = useReadContracts({
    allowFailure: false,
    query: { ...query, enabled: enabled && Boolean(address) },
    contracts: [
      { address: contracts.mockOracle, abi: mockOracleAbi, functionName: "hasRole", args: [ROLES.oracleUpdater, account], chainId: chain.id },
      { address: contracts.complianceRegistry, abi: complianceRegistryAbi, functionName: "hasRole", args: [ROLES.complianceAdmin, account], chainId: chain.id },
      { address: contracts.registry, abi: registryAbi, functionName: "hasRole", args: [ROLES.riskAdmin, account], chainId: chain.id },
      { address: contracts.creditVault, abi: creditVaultAbi, functionName: "hasRole", args: [ROLES.protocolAdmin, account], chainId: chain.id },
      { address: contracts.creditVault, abi: creditVaultAbi, functionName: "hasRole", args: [ROLES.liquidationOperator, account], chainId: chain.id },
      { address: contracts.mockUSDC, abi: mockUsdcAbi, functionName: "hasRole", args: [ROLES.minter, account], chainId: chain.id },
    ],
  });

  const connected = isConnected && chainId === chain.id;

  if (!d) return { ...demoView, connected, account: address };

  const loading = !market.data || !user.data;
  const [oracleUpdater, complianceAdmin, riskAdmin, protocolAdmin, liquidationOperator, minter] =
    roles.data ?? [false, false, false, false, false, false];
  const roleView = { oracleUpdater, complianceAdmin, riskAdmin, protocolAdmin, liquidationOperator, minter };

  if (loading) {
    return { ...placeholderView, loading: true, connected, account: address, roles: roleView };
  }

  const [config, price, totalAssets, available, borrowed, utilizationBps, badDebt, paused, totalShares] =
    market.data;
  const [position, risk, tbillBalance, usdcBalance, tbillAllowance, usdcAllowanceCredit, usdcAllowancePool, shares, maxWithdraw, eligible] =
    user.data;
  // ERC-4626 convertToAssets with the vault's 3-decimal virtual offset.
  const shareValue = (shares * (totalAssets + 1n)) / (totalShares + 1000n);

  const age = now === null || price.updatedAt === 0n ? null : Math.max(0, now - Number(price.updatedAt));
  const hardStale = age !== null && age >= config.hardStaleAge;
  const degraded = age !== null && age > config.maxOracleAge;
  const oracleStatus = !risk.oracleValid ? "Invalid" : hardStale ? "Hard stale" : degraded ? "Degraded" : "Fresh";
  const oracleTone: Tone = !risk.oracleValid || hardStale ? "danger" : degraded ? "warning" : "healthy";

  const factorProduct =
    (BigInt(config.liquidityFactorBps) * BigInt(config.settlementFactorBps) * risk.freshnessFactorBps) /
    10_000n / 10_000n;
  const effectiveLtvBps = (factorProduct * BigInt(config.baseLtvBps)) / 10_000n;

  const hasPosition = connected && position.status !== 0;
  const hasDebt = position.debtAmount > 0n;
  const tone: Tone =
    !hasPosition
      ? "neutral"
      : position.status === 2
        ? "danger"
        : hasDebt
          ? healthTone(risk.healthFactor, risk.liquidatable)
          : "healthy";
  const stage: PositionStage =
    position.status === 1 && hasDebt && tone !== "healthy" ? "WARNING" : STATUS_STAGES[position.status] ?? "NONE";
  const status = !connected
    ? "Connect wallet"
    : position.status === 1 && risk.liquidatable
      ? "Liquidatable"
      : stage === "WARNING"
        ? "Warning"
        : position.status === 1 && !hasDebt
          ? "Active · no debt"
          : position.status === 1
            ? "Healthy"
            : STATUS_LABELS[position.status] ?? "Unknown";

  const headroom = risk.borrowCapacity > risk.debtValue ? risk.borrowCapacity - risk.debtValue : 0n;
  const aprs = estimateAprs(utilizationBps);

  return {
    mode: "live",
    loading: false,
    connected,
    account: address,
    market: {
      asset: "MockTBILL",
      model: "Tokenized Treasury simulation",
      nav: formatUsdWad(price.price),
      priceType: "NAV",
      oracleStatus,
      oracleAge: age === null ? dash : formatAge(age),
      oracleTone,
      baseLtv: formatBps(config.baseLtvBps),
      liquidationLtv: formatBps(config.liquidationLtvBps),
      liquidityFactor: formatBps(config.liquidityFactorBps),
      settlementFactor: formatBps(config.settlementFactorBps),
      freshnessFactor: formatBps(risk.freshnessFactorBps),
      effectiveLtv: formatBps(effectiveLtvBps),
      redemptionDelay: `${Math.round(config.redemptionDelay / 3600)} h simulated`,
      permissioned: config.permissioned ? "Yes — demo allowlist" : "No",
      borrowingEnabled: config.borrowingEnabled,
      paused,
    },
    position: {
      collateral: connected ? formatToken(position.collateralAmount, TBILL_DECIMALS, "mTBILL") : dash,
      rawValue: connected ? formatUsdWad(risk.rawCollateralValue) : dash,
      effectiveValue: connected ? formatUsdWad(risk.effectiveCollateralValue) : dash,
      borrowCapacity: connected ? formatUsdWad(risk.borrowCapacity) : dash,
      debt: connected ? formatUsdc(position.debtAmount) : dash,
      availableBorrow: connected ? formatUsdc(wadToUsdcFloor(headroom)) : dash,
      liquidationCapacity: connected ? formatUsdWad(risk.liquidationCapacity) : dash,
      healthFactor: connected && hasDebt ? formatHealthFactor(risk.healthFactor) : dash,
      status,
      stage: connected ? stage : "NONE",
      tone,
    },
    pool: {
      totalSupplied: formatUsdc(totalAssets),
      availableLiquidity: formatUsdc(available),
      borrowed: formatUsdc(borrowed),
      utilization: formatBps(utilizationBps),
      borrowApr: `${aprs.borrow.toFixed(2)}% model`,
      supplyApr: `${aprs.supply.toFixed(2)}% model`,
      badDebt: formatUsdc(badDebt),
    },
    wallet: {
      tbill: connected ? formatToken(tbillBalance, TBILL_DECIMALS) : dash,
      usdc: connected ? formatUsdc(usdcBalance) : dash,
      shareValue: connected ? formatUsdc(shareValue) : dash,
      maxWithdraw: connected ? formatUsdc(maxWithdraw) : dash,
      eligible: connected ? eligible : null,
    },
    raw: connected
      ? {
          risk: {
            price: price.price,
            freshnessBps: risk.freshnessFactorBps,
            liquidityFactorBps: BigInt(config.liquidityFactorBps),
            settlementFactorBps: BigInt(config.settlementFactorBps),
            baseLtvBps: BigInt(config.baseLtvBps),
            liquidationLtvBps: BigInt(config.liquidationLtvBps),
          },
          oracleValid: risk.oracleValid,
          canBorrow: risk.canBorrow,
          liquidatable: risk.liquidatable,
          collateral: position.collateralAmount,
          debt: position.debtAmount,
          status: position.status,
          borrowCapacity: risk.borrowCapacity,
          liquidationCapacity: risk.liquidationCapacity,
          healthFactor: risk.healthFactor,
          availableLiquidity: available,
          tbillBalance,
          usdcBalance,
          tbillAllowance,
          usdcAllowanceCredit,
          usdcAllowancePool,
          maxWithdraw,
          eligible,
        }
      : null,
    roles: roleView,
  };
}

const placeholderView: ProtocolView = {
  ...demoView,
  mode: "live",
  market: {
    ...demoView.market,
    nav: dash,
    oracleStatus: "Loading",
    oracleAge: dash,
    oracleTone: "neutral",
    baseLtv: dash,
    liquidationLtv: dash,
    liquidityFactor: dash,
    settlementFactor: dash,
    freshnessFactor: dash,
    effectiveLtv: dash,
    redemptionDelay: dash,
    permissioned: dash,
  },
  position: {
    collateral: dash,
    rawValue: dash,
    effectiveValue: dash,
    borrowCapacity: dash,
    debt: dash,
    availableBorrow: dash,
    liquidationCapacity: dash,
    healthFactor: dash,
    status: "Loading",
    stage: "NONE",
    tone: "neutral",
  },
  pool: {
    totalSupplied: dash,
    availableLiquidity: dash,
    borrowed: dash,
    utilization: dash,
    borrowApr: dash,
    supplyApr: dash,
    badDebt: dash,
  },
  wallet: { tbill: dash, usdc: dash, shareValue: dash, maxWithdraw: dash, eligible: null },
};
