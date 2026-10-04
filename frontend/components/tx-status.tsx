"use client";

import { ArrowUpRight } from "lucide-react";

import { explorerTxUrl } from "@/lib/network";
import type { TxState } from "@/lib/use-tx";

export function TxStatus({ state, idle }: { state: TxState; idle?: string }) {
  const hash = state.status === "idle" ? undefined : state.hash;
  const link = hash ? explorerTxUrl(hash) : null;

  let message = idle ?? "";
  let tone: "idle" | "loading" | "success" | "error" = "idle";
  if (state.status === "signing") {
    tone = "loading";
    message = `${state.total > 1 ? `Step ${state.step}/${state.total} · ` : ""}Confirm “${state.label}” in your wallet…`;
  } else if (state.status === "confirming") {
    tone = "loading";
    message = `${state.total > 1 ? `Step ${state.step}/${state.total} · ` : ""}Waiting for “${state.label}” to confirm…`;
  } else if (state.status === "success") {
    tone = "success";
    message = "Confirmed onchain.";
  } else if (state.status === "error") {
    tone = "error";
    message = state.message;
  }

  if (!message) return null;

  return (
    <p className="field-message" data-state={tone} role={tone === "error" ? "alert" : "status"}>
      {message}
      {hash ? (
        link ? (
          <a className="tx-link" href={link} rel="noreferrer" target="_blank">
            View transaction <ArrowUpRight aria-hidden="true" size={13} />
          </a>
        ) : (
          <span className="tx-link mono">{`${hash.slice(0, 10)}…`}</span>
        )
      ) : null}
    </p>
  );
}
