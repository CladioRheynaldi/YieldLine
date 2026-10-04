"use client";

import { useState } from "react";
import type { Address } from "viem";
import { formatToken, shortAddress } from "@/lib/format";
import { explorerTxUrl } from "@/lib/network";
import { useHistory } from "@/lib/use-history";

export function TransactionHistory({ account, kind = "all" }: { account?: Address; kind?: "all" | "lender" | "borrower" }) {
  const history = useHistory(account);
  const [visible, setVisible] = useState(20);
  const rows = history.rows.filter(r => kind === "all" || (kind === "lender" ? ["Deposit","Withdraw","Transfer"].includes(r.event) : !["Deposit","Withdraw","Transfer"].includes(r.event)));
  return (
    <section className="plain-panel activity-panel" aria-label="Transaction history">
      <div className="section-heading">
        <div><h2>Transaction history</h2><p>Confirmed events for this wallet on the selected demo network.</p></div>
        <button className="button button--quiet" onClick={() => void history.refetch()} disabled={!account || !history.configured || history.isFetching}>Refresh</button>
      </div>
      {!account ? <p className="field-message">Connect a wallet to view its history.</p> :
        !history.configured ? <p className="field-message">History requires a deployment address and deployment block.</p> :
        history.isPending ? <p role="status">Loading contract events…</p> : null}
      {history.isError ? <p className="field-message" role="alert">History RPC request failed. Loaded rows may be incomplete. Retry with Refresh; earnings are unavailable until the complete history loads.</p> : null}
      {account && history.configured && !history.isPending && !history.isError && !rows.length ? <p className="field-message">{history.complete ? "No transactions found for this wallet." : "No matching events in the loaded range. Load older events to continue."}</p> : null}
      {rows.length > 0 ? <div className="history-scroll"><table className="activity-table">
        <thead><tr><th>Action</th><th>Amount</th><th>Time</th><th>Status</th><th>Transaction</th></tr></thead>
        <tbody>{rows.slice(0, visible).map(row => {
          const link = explorerTxUrl(row.hash);
          return <tr key={row.id}>
            <td>{row.label}</td>
            <td>{formatToken(row.amount, row.decimals, row.unit)}</td>
            <td>{row.timestamp === null ? "Timestamp unavailable" : new Date(Number(row.timestamp)*1000).toISOString().replace("T"," ").replace(".000Z"," UTC")}</td>
            <td><span className="state-badge" data-tone="healthy">Confirmed</span></td>
            <td>{link ? <a href={link} target="_blank" rel="noreferrer">{shortAddress(row.hash)} ↗</a> : <span className="mono" title={row.hash}>{shortAddress(row.hash)} · local</span>}</td>
          </tr>;
        })}</tbody>
      </table></div> : null}
      <div className="button-row">
        {rows.length > visible ? <button className="button button--quiet" onClick={() => setVisible(v => v+20)}>Show more rows</button> : null}
        {history.hasNextPage ? <button className="button button--quiet" disabled={history.isFetching} onClick={() => void history.fetchNextPage()}>{history.isFetchingNextPage ? "Loading…" : "Load older events"}</button> : null}
      </div>
      {history.data ? <p className="field-message">{history.complete ? "History loaded from the deployment block." : "Partial history. Load older events before interpreting lifetime earnings."} Failed or rejected wallet requests do not emit events; their status is shown in the action form.</p> : null}
    </section>
  );
}
