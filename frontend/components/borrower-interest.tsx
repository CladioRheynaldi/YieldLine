"use client";

import { formatUsdc } from "@/lib/format";
import { borrowerInterest } from "@/lib/history";
import { useHistory } from "@/lib/use-history";
import type { ProtocolView } from "@/lib/use-protocol";

export function BorrowerInterest({ view }: { view: ProtocolView }) {
  const history = useHistory(view.account);
  const lifetime = view.raw && !view.readError ? borrowerInterest(history.rows, history.complete, view.raw.debt) : null;
  return <section className="plain-panel">
    <h2>Interest accounting</h2>
    <dl className="key-values">
      <div><dt>Current principal + interest debt</dt><dd>{view.position.debt}</dd></div>
      <div><dt>Interest since the last pool rate checkpoint</dt><dd>{view.position.accruedInterest}</dd></div>
      <div><dt>Gross lifetime interest accrued</dt><dd>{lifetime === null ? "Unavailable" : formatUsdc(lifetime)}</dd></div>
      <div><dt>Current contract borrow APR</dt><dd>{view.pool.borrowApr}</dd></div>
    </dl>
    <p className="field-message">The checkpoint figure resets when pool activity starts a new rate interval. Lifetime interest requires complete events and includes interest already paid or written off plus micro-USDC borrowing rounding. It is not an additional amount owed.</p>
  </section>;
}
