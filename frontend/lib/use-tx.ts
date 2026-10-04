"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { Abi, Address, Hash } from "viem";
import { useConfig, useConnection } from "wagmi";
import { getAccount, simulateContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";

import { describeError, protocolErrorsAbi } from "./errors";
import { chain } from "./network";

export type TxStep = {
  label: string;
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
};

export type TxState =
  | { status: "idle" }
  | { status: "signing" | "confirming"; label: string; step: number; total: number; hash?: Hash }
  | { status: "success"; hash: Hash }
  | { status: "error"; message: string; hash?: Hash };

/**
 * Runs one or more contract writes in order: simulate (so predictable reverts never reach the
 * wallet), request a signature, wait for the receipt, then refetch every contract read.
 */
export function useTx() {
  const config = useConfig();
  const queryClient = useQueryClient();
  const { address } = useConnection();
  const [state, setState] = useState<TxState>({ status: "idle" });

  const run = useCallback(
    async (steps: TxStep[]) => {
      if (!address) {
        setState({ status: "error", message: "Connect a wallet first." });
        return false;
      }
      if (!steps.length) {
        setState({ status: "error", message: "No transaction steps were provided." });
        return false;
      }
      let hash: Hash | undefined;
      try {
        for (const [index, step] of steps.entries()) {
          hash = undefined;
          const active = getAccount(config);
          if (active.address?.toLowerCase() !== address.toLowerCase()) throw new Error("Wallet account changed. Restart the action.");
          if (active.chainId !== chain.id) throw new Error("Wallet network changed. Switch to the configured demo network and retry.");
          const base = { label: step.label, step: index + 1, total: steps.length };
          setState({ status: "signing", ...base });
          const { request } = await simulateContract(config, {
            abi: [...step.abi, ...protocolErrorsAbi],
            address: step.address,
            functionName: step.functionName,
            args: step.args,
            account: address,
            chainId: chain.id,
          });
          hash = await writeContract(config, request);
          setState({ status: "confirming", ...base, hash });
          const receipt = await waitForTransactionReceipt(config, { hash, chainId: chain.id });
          hash = receipt.transactionHash;
          if (receipt.status !== "success") throw new Error(`${step.label} reverted onchain.`);
        }
        setState({ status: "success", hash: hash! });
        return true;
      } catch (error) {
        setState({ status: "error", message: describeError(error), hash });
        return false;
      } finally {
        await queryClient.invalidateQueries();
      }
    },
    [address, config, queryClient],
  );

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, run, reset, busy: state.status === "signing" || state.status === "confirming" };
}
