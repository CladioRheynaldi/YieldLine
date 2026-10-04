import { mockUsdcAbi } from "@yieldline/shared";
import type { Address } from "viem";

import { chain } from "./network";
import { previewRisk } from "./risk-math";
import type { ProtocolView, RawState } from "./use-protocol";
import type { TxStep } from "./use-tx";

/** Why writes are unavailable right now, or null when the wallet can transact. */
export function writeGate(view: ProtocolView): string | null {
  if (view.mode === "demo") return "Demo snapshot — deploy the contracts to submit transactions.";
  if (view.readError) return view.readError;
  if (!view.account) return "Connect a wallet to submit transactions.";
  if (!view.connected) return `Switch the wallet to ${chain.name} to submit.`;
  if (view.loading || !view.raw) return "Loading onchain state…";
  return null;
}

/** Prepends an ERC-20 approval when the current allowance does not cover `amount`. */
export function withApproval(
  token: Address,
  spender: Address,
  amount: bigint,
  allowance: bigint,
  symbol: string,
  step: TxStep,
): TxStep[] {
  const approve: TxStep = {
    label: `Approve ${symbol}`,
    address: token,
    abi: mockUsdcAbi,
    functionName: "approve",
    args: [spender, amount],
  };
  return allowance >= amount ? [step] : [approve, step];
}

/** Largest collateral withdrawal that keeps debt within borrow capacity. */
export function maxSafeWithdrawal(raw: RawState): bigint {
  if (raw.debt === 0n) return raw.collateral;
  if (!raw.oracleValid || raw.risk.freshnessBps === 0n) return 0n;

  const { price, liquidityFactorBps, settlementFactorBps, freshnessBps, baseLtvBps } = raw.risk;
  const denominator = price * liquidityFactorBps * settlementFactorBps * freshnessBps * baseLtvBps;
  if (denominator === 0n) return 0n;
  const debtValue = raw.debt * 10n ** 12n;
  const scale = 10n ** 18n * 10_000n ** 4n;
  let required = (debtValue * scale + denominator - 1n) / denominator;
  // Integer division in the engine can shave a few wei; step up until the check passes.
  for (let i = 0; i < 1_000 && previewRisk(raw.risk, required, raw.debt).borrowCapacity < debtValue; i++) {
    required += 1n;
  }
  return raw.collateral > required ? raw.collateral - required : 0n;
}
