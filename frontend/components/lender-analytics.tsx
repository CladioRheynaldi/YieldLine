"use client";

import { formatUsdc } from "@/lib/format";
import { lenderCashFlows } from "@/lib/history";
import { useHistory } from "@/lib/use-history";
import type { ProtocolView } from "@/lib/use-protocol";

export function LenderAnalytics({ view }: { view: ProtocolView }) {
  const history = useHistory(view.account);
  const values = view.raw && !view.readError ? lenderCashFlows(history.rows, history.complete, view.raw.shareValue) : null;
  return <section className="plain-panel">
    <h2>Your lender analytics</h2>
    <dl className="key-values">
      <div><dt>Deposits credited to your shares</dt><dd>{values ? formatUsdc(values.deposits) : "Unavailable"}</dd></div>
      <div><dt>Withdrawals charged to your shares</dt><dd>{values ? formatUsdc(values.withdrawals) : "Unavailable"}</dd></div>
      <div><dt>Current share value</dt><dd>{view.wallet.shareValue}</dd></div>
      <div><dt>Withdrawable now</dt><dd>{view.wallet.maxWithdraw}</dd></div>
      <div><dt>Net gain / loss including current shares</dt><dd>{values ? formatUsdc(values.netResult) : "Unavailable"}</dd></div>
    </dl>
    <p className="field-message">{values ? "Net result = current share value + withdrawals − deposits. It includes losses and unpaid loan interest; it is not guaranteed cash yield." : "Lifetime figures require complete deployment-to-current events and no lender-share transfers. Load older history below. Transferred shares require a cost basis that this demo does not track."}</p>
  </section>;
}
