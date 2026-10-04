"use client";

import { formatUnits } from "viem";
import { useQuery } from "@tanstack/react-query";
import { formatToken, shortAddress } from "@/lib/format";
import { OPENEDEN_REFERENCE as reference, type ReferenceSnapshot } from "@/lib/openeden";

export function OpenEdenReference() {
  const query = useQuery({
    queryKey: ["openeden-production-reference"],
    queryFn: async () => {
      const response = await fetch("/api/openeden", { cache: "no-store" });
      if (!response.ok) throw new Error("Reference service unavailable.");
      return await response.json() as ReferenceSnapshot;
    },
    refetchInterval: 60_000, staleTime: 30_000, retry: 1,
  });
  const data = query.data;
  const readable = data && data.status !== "unavailable" && !query.isError;
  return <section className="plain-panel production-reference" aria-label="OpenEden production reference">
    <div className="section-heading">
      <div><h2>OpenEden TBILL · production reference</h2><p>Arbitrum One · read only · separate from your YieldLine testnet position</p></div>
      <span className="state-badge" data-tone={query.isError || data?.status === "unavailable" ? "warning" : data?.status === "stale" ? "warning" : "neutral"}>{query.isPending ? "Loading" : query.isError ? "Unavailable" : data?.status ?? "Unavailable"}</span>
    </div>
    <p>This panel does not represent your collateral or ownership of production TBILL. It provides no deposit, approval, borrowing, or redemption action.</p>
    {query.isPending ? <p role="status">Reading the production token and price oracle…</p> : null}
    {query.isError ? <p role="alert">Reference service unavailable. No testnet values are substituted.</p> : data ? <p className="field-message">{data.message}</p> : null}
    <dl className="key-values">
      <div><dt>Network</dt><dd>{reference.network} · {reference.chainId}</dd></div>
      <div><dt>NAV per TBILL{data?.status === "stale" ? " (stale)" : ""}</dt><dd>{readable && data.nav !== undefined && data.oracleDecimals !== undefined ? "$"+formatUnits(BigInt(data.nav), data.oracleDecimals) : "Unavailable"}</dd></div>
      <div><dt>Outstanding token supply</dt><dd>{readable && data.totalSupply !== undefined && data.tokenDecimals !== undefined ? formatToken(BigInt(data.totalSupply), data.tokenDecimals, "TBILL") : "Unavailable"}</dd></div>
      <div><dt>Oracle update</dt><dd>{readable && data.oracleUpdatedAt ? new Date(Number(data.oracleUpdatedAt)*1000).toISOString() : "Unavailable"}</dd></div>
      <div><dt>Observed at</dt><dd>{data?.observedAt ?? "Unavailable"}</dd></div>
      <div><dt>Source block</dt><dd>{readable ? data.blockNumber : "Unavailable"}</dd></div>
      <div><dt>TBILL vault</dt><dd><a href={"https://arbiscan.io/address/"+reference.vault} target="_blank" rel="noreferrer">{shortAddress(reference.vault)} ↗</a></dd></div>
      <div><dt>Price oracle</dt><dd><a href={"https://arbiscan.io/address/"+reference.oracle} target="_blank" rel="noreferrer">{shortAddress(reference.oracle)} ↗</a></dd></div>
    </dl>
    <p className="field-message">NAV age above 72 hours is flagged for this reference display; this display threshold does not define the issuer redemption policy. This panel does not publish an inferred yield or convert token supply into claimed TVL.</p>
    <div className="button-row">
      <a className="button button--quiet" href={reference.source} target="_blank" rel="noreferrer">Official address source ↗</a>
      <button className="button button--quiet" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh reference</button>
    </div>
  </section>;
}
