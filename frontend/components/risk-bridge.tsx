"use client";

import { ArrowRight } from "lucide-react";

import { useProtocol } from "@/lib/use-protocol";

export function RiskBridge() {
  const { market } = useProtocol();
  const factors = [market.liquidityFactor, market.settlementFactor, market.freshnessFactor]
    .map((value) => value.replace(/\.00%$/, "%"))
    .join(" × ");

  return (
    <div className="risk-bridge" aria-label="Risk adjustment calculation">
      <div>
        <span>Base LTV</span>
        <strong>{market.baseLtv}</strong>
      </div>
      <ArrowRight aria-hidden="true" />
      <div>
        <span>RWA factors · liquidity × settlement × freshness</span>
        <strong>{factors}</strong>
      </div>
      <ArrowRight aria-hidden="true" />
      <div>
        <span>Effective LTV</span>
        <strong>{market.effectiveLtv}</strong>
      </div>
    </div>
  );
}
