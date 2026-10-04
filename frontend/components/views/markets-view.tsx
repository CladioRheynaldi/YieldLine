"use client";

import { ModeNotice } from "@/components/mode-notice";
import { PageHeading } from "@/components/page-heading";
import { chain, deployment, explorerAddressUrl } from "@/lib/network";
import { useProtocol } from "@/lib/use-protocol";

export function MarketsView() {
  const view = useProtocol();
  const { market } = view;
  const rows = [
    ["Asset", market.asset],
    ["Model", market.model],
    ["Price type", market.priceType],
    ["NAV", market.nav],
    ["Oracle status", `${market.oracleStatus} · ${market.oracleAge}`],
    ["Base LTV", market.baseLtv],
    ["Liquidation LTV", market.liquidationLtv],
    ["Liquidity factor", market.liquidityFactor],
    ["Settlement factor", market.settlementFactor],
    ["Freshness factor", market.freshnessFactor],
    ["Effective LTV", market.effectiveLtv],
    ["Redemption delay", market.redemptionDelay],
    ["Permissioned", market.permissioned],
    ["Borrowing", market.borrowingEnabled ? "Enabled" : "Disabled"],
  ] as const;
  const tokenLink = deployment ? explorerAddressUrl(deployment.mockTBILL) : null;

  return (
    <div className="page-shell page-shell--subpage">
      <PageHeading
        title="Collateral market"
        description="One mock asset, one inspectable policy. Multi-asset complexity waits until the complete lifecycle works."
        aside={
          <span
            className="state-badge"
            data-tone={market.borrowingEnabled && !market.paused ? "healthy" : "warning"}
          >
            {market.paused ? "Paused" : market.borrowingEnabled ? "Enabled" : "Borrowing off"}
          </span>
        }
      />
      <ModeNotice view={view} />

      <section className="market-sheet">
        <div className="market-sheet__head">
          <div>
            <span className="asset-symbol">mT</span>
            <div>
              <h2>MockTBILL</h2>
              <p>
                {chain.name} · simulation
                {tokenLink ? (
                  <>
                    {" · "}
                    <a href={tokenLink} rel="noreferrer" target="_blank">
                      contract
                    </a>
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <span className="state-badge" data-tone={market.oracleTone}>
            Oracle · {market.oracleStatus}
          </span>
        </div>
        <dl className="market-sheet__rows">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="reference-note">
        <h2>Production reference path</h2>
        <p>
          An OpenEden TBILL panel may be added as a separate, read-only Arbitrum One source after
          its current address and ABI are re-verified. It must never be merged visually with this
          workshop position.
        </p>
      </section>
    </div>
  );
}
