// Mirrors RWARiskEngine so the UI can preview a transaction before the wallet prompt.
// The contract remains the final authority; every write is also simulated onchain.

const BPS = 10_000n;
const WAD = 10n ** 18n;
const USDC_TO_WAD = 10n ** 12n;

export type RiskInputs = {
  price: bigint;
  freshnessBps: bigint;
  liquidityFactorBps: bigint;
  settlementFactorBps: bigint;
  baseLtvBps: bigint;
  liquidationLtvBps: bigint;
};

export type RiskPreview = {
  effectiveCollateralValue: bigint;
  borrowCapacity: bigint;
  liquidationCapacity: bigint;
  debtValue: bigint;
  healthFactor: bigint;
};

export const MAX_HEALTH_FACTOR = 2n ** 256n - 1n;

export function previewRisk(inputs: RiskInputs, collateral: bigint, debt: bigint): RiskPreview {
  const raw = (collateral * inputs.price) / WAD;
  let effective = (raw * inputs.liquidityFactorBps) / BPS;
  effective = (effective * inputs.settlementFactorBps) / BPS;
  effective = (effective * inputs.freshnessBps) / BPS;
  const borrowCapacity = (effective * inputs.baseLtvBps) / BPS;
  const liquidationCapacity = (effective * inputs.liquidationLtvBps) / BPS;
  const debtValue = debt * USDC_TO_WAD;
  return {
    effectiveCollateralValue: effective,
    borrowCapacity,
    liquidationCapacity,
    debtValue,
    healthFactor: debtValue === 0n ? MAX_HEALTH_FACTOR : (liquidationCapacity * WAD) / debtValue,
  };
}

/** Largest MockUSDC amount (6 decimals) whose 1e18 value fits in `capacity`. */
export function wadToUsdcFloor(value: bigint): bigint {
  return value / USDC_TO_WAD;
}

export function healthTone(healthFactor: bigint, liquidatable: boolean) {
  if (liquidatable || healthFactor < WAD) return "danger" as const;
  if (healthFactor < (WAD * 12n) / 10n) return "warning" as const;
  return "healthy" as const;
}
