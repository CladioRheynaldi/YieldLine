"use client";

import { chain } from "@/lib/network";
import type { ProtocolView } from "@/lib/use-protocol";

export function ModeNotice({ view }: { view: ProtocolView }) {
  let message: string | null = null;
  if (view.mode === "demo") {
    message = `Demo snapshot · no ${chain.name} deployment is configured, so values show the documented scenario.`;
  } else if (!view.account) {
    message = `Live ${chain.name} data · connect a wallet to see and manage your position.`;
  } else if (!view.connected) {
    message = `Wallet is on another network · switch to ${chain.name}.`;
  } else if (view.market.paused) {
    message = "Protocol paused · new deposits and borrows are blocked; repay and withdraw remain open.";
  }
  if (!message) return null;

  return (
    <p className="mode-notice" data-mode={view.mode} role="status">
      <span className="status-dot" aria-hidden="true" />
      {message}
    </p>
  );
}
