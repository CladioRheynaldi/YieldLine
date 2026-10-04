"use client";

import { useProtocol } from "@/lib/use-protocol";

export function RiskTable() {
  const { market, position } = useProtocol();
  const rows = [
    ["NAV", market.nav, "1e18 normalized"],
    ["Oracle age", market.oracleAge, market.oracleStatus],
    ["Base LTV", market.baseLtv, "registry"],
    ["Liquidation LTV", market.liquidationLtv, "registry"],
    ["Liquidity factor", market.liquidityFactor, "realizability"],
    ["Settlement factor", market.settlementFactor, "redemption friction"],
    ["Freshness factor", market.freshnessFactor, "time-sensitive"],
    ["Raw collateral", position.rawValue, position.collateral],
    ["Effective collateral", position.effectiveValue, "after factors"],
    ["Liquidation capacity", position.liquidationCapacity, "health factor numerator"],
  ] as const;

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Risk input</th>
            <th scope="col">Current value</th>
            <th scope="col">Interpretation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value, detail]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value}</td>
              <td>{detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
