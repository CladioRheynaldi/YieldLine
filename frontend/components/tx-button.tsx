"use client";

import type { ReactNode } from "react";

import { useTx, type TxStep } from "@/lib/use-tx";

import { TxStatus } from "./tx-status";

/** A button that runs a fixed transaction sequence and reports its own status. */
export function TxButton({
  children,
  steps,
  disabledReason,
  variant = "quiet",
}: {
  children: ReactNode;
  steps: () => TxStep[];
  disabledReason?: string | null;
  variant?: "primary" | "quiet";
}) {
  const tx = useTx();
  return (
    <div className="tx-button">
      <button
        className={`button button--${variant}`}
        disabled={tx.busy || Boolean(disabledReason)}
        onClick={() => void tx.run(steps())}
        title={disabledReason ?? undefined}
        type="button"
      >
        {tx.busy ? "Working…" : children}
      </button>
      <TxStatus state={tx.state} />
    </div>
  );
}
