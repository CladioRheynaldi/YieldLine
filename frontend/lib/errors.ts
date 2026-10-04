import {
  complianceRegistryAbi,
  creditVaultAbi,
  liquidityVaultAbi,
  mockOracleAbi,
  mockTbillAbi,
  mockUsdcAbi,
  oracleAdapterAbi,
  registryAbi,
  riskEngineAbi,
} from "@yieldline/shared";
import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
  type Abi,
} from "viem";

type AbiError = Extract<Abi[number], { type: "error" }>;

/** Every custom error any protocol contract can raise, so nested reverts decode by name. */
export const protocolErrorsAbi: readonly AbiError[] = (() => {
  const seen = new Set<string>();
  const errors: AbiError[] = [];
  const abis: Abi[] = [
    complianceRegistryAbi,
    creditVaultAbi,
    liquidityVaultAbi,
    mockOracleAbi,
    mockTbillAbi,
    mockUsdcAbi,
    oracleAdapterAbi,
    registryAbi,
    riskEngineAbi,
  ];
  for (const abi of abis) {
    for (const item of abi) {
      if (item.type !== "error") continue;
      const signature = `${item.name}(${item.inputs.map((input) => input.type).join(",")})`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      errors.push(item);
    }
  }
  return errors;
})();

const messages: Record<string, string> = {
  AccountNotEligible: "This wallet is not eligible for the selected mock RWA.",
  OracleHardStale: "The RWA valuation is too old for new borrowing.",
  OracleInvalid: "The oracle currently reports an invalid price.",
  InsufficientCollateral: "This would move the position beyond its borrowing limit.",
  UnsafeWithdrawal: "This withdrawal would leave the position above its borrowing limit.",
  InsufficientLiquidity: "The lending pool does not currently have enough available MockUSDC.",
  BorrowingDisabled: "Borrowing is disabled for this asset.",
  UnsupportedAsset: "This asset is not enabled as collateral.",
  SupplyCapExceeded: "This deposit would exceed the collateral supply cap.",
  PositionInLiquidation: "The position is pending liquidation and is locked.",
  PositionNotActive: "There is no active position for this action.",
  PositionNotInLiquidation: "The position is not pending liquidation.",
  NotLiquidatable: "The position is not liquidatable at the current valid price.",
  ZeroAmount: "Enter an amount greater than zero.",
  EnforcedPause: "The protocol is paused for new risk.",
  AccessControlUnauthorizedAccount: "This wallet does not hold the required admin role.",
  ERC20InsufficientBalance: "The wallet balance is too low for this amount.",
  ERC20InsufficientAllowance: "The token allowance is too low. Approve and try again.",
  ERC4626ExceededMaxWithdraw: "This exceeds what can be withdrawn right now.",
  ERC4626ExceededMaxRedeem: "This exceeds what can be redeemed right now.",
  InvalidTimestamp: "The oracle timestamp must be in the past.",
  InvalidPrice: "The NAV must be greater than zero.",
};

export function describeError(error: unknown): string {
  if (error instanceof BaseError) {
    if (error.walk((cause) => cause instanceof UserRejectedRequestError)) {
      return "The wallet request was rejected.";
    }
    const reverted = error.walk((cause) => cause instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName;
      if (name && messages[name]) return messages[name];
      if (name) return `The contract rejected the transaction (${name}).`;
      if (reverted.reason) return reverted.reason;
    }
    return error.shortMessage;
  }
  return error instanceof Error ? error.message : "The transaction failed.";
}
