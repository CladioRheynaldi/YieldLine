"use client";

import { chain } from "@/lib/network";
import { useProtocol } from "@/lib/use-protocol";

export function NetworkChip() {
  const { market, mode } = useProtocol();
  return (
    <>
      {market.paused ? (
        <span className="network-chip" data-tone="danger">
          <span aria-hidden="true" /> Paused
        </span>
      ) : null}
      <span className="network-chip" data-mode={mode} title={mode === "demo" ? "No deployment configured" : undefined}>
        <span aria-hidden="true" /> {chain.name}
        {mode === "demo" ? " · demo" : ""}
      </span>
    </>
  );
}
