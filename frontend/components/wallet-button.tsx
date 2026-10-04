"use client";

import { useConnect, useConnection, useDisconnect, useSwitchChain } from "wagmi";

import { shortAddress } from "@/lib/format";
import { chain } from "@/lib/network";

export function WalletButton() {
  const account = useConnection();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();

  if (account.isConnected && account.chainId !== chain.id) {
    return (
      <button
        className="button button--primary"
        disabled={switchChain.isPending}
        onClick={() => switchChain.mutate({ chainId: chain.id })}
        type="button"
      >
        {switchChain.isPending ? "Switching…" : `Switch to ${chain.name}`}
      </button>
    );
  }

  if (account.isConnected && account.address) {
    return (
      <button
        aria-label={`Disconnect wallet ${account.address}`}
        className="button button--quiet mono"
        onClick={() => disconnect.mutate()}
        type="button"
      >
        {shortAddress(account.address)}
      </button>
    );
  }

  return (
    <div className="wallet-control">
      <button
        className="button button--primary"
        disabled={connect.isPending || connect.connectors.length === 0}
        onClick={() => {
          const connector = connect.connectors[0];
          if (connector) connect.mutate({ connector });
        }}
        type="button"
      >
        {connect.isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {connect.error ? (
        <span className="wallet-control__error" role="alert">
          Wallet connection failed. Unlock the wallet and try again.
        </span>
      ) : null}
    </div>
  );
}
