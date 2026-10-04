import { getLiveDeployment, type YieldLineNetwork } from "@yieldline/shared";
import { anvil, arbitrumSepolia } from "wagmi/chains";

export const network: YieldLineNetwork =
  process.env.NEXT_PUBLIC_YIELDLINE_NETWORK === "anvil" ? "anvil" : "arbitrumSepolia";

export const chain = network === "anvil" ? anvil : arbitrumSepolia;

export const rpcUrls = {
  [anvil.id]: process.env.NEXT_PUBLIC_ANVIL_RPC_URL || "http://127.0.0.1:8545",
  [arbitrumSepolia.id]:
    process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
};

/** Null until `DeployYieldLine.s.sol` has run and `pnpm deployments:sync` has been executed. */
export const deployment = getLiveDeployment(network);

export function explorerTxUrl(hash: string): string | null {
  const explorer = chain.blockExplorers?.default.url;
  return explorer ? `${explorer}/tx/${hash}` : null;
}

export function explorerAddressUrl(address: string): string | null {
  const explorer = chain.blockExplorers?.default.url;
  return explorer ? `${explorer}/address/${address}` : null;
}
