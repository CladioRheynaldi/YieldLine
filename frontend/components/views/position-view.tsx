"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { BorrowerInterest } from "@/components/borrower-interest";
import { TransactionHistory } from "@/components/transaction-history";
import { Metric } from "@/components/metric";
import { ModeNotice } from "@/components/mode-notice";
import { PageHeading } from "@/components/page-heading";
import { RiskTable } from "@/components/risk-table";
import { useProtocol, type PositionStage } from "@/lib/use-protocol";

const stages: { key: PositionStage; title: string; detail: string }[] = [
  { key: "ACTIVE", title: "Active", detail: "Borrow and repay are available." },
  { key: "WARNING", title: "Warning", detail: "Health factor is below 1.2000. Add collateral or repay." },
  {
    key: "LIQUIDATION_PENDING",
    title: "Liquidation pending",
    detail: "Borrow and withdrawal are locked while redemption settles. Full repayment cures it.",
  },
  { key: "CLOSED", title: "Closed", detail: "Settlement records surplus or bad debt." },
];

export function PositionView() {
  const view = useProtocol();
  const { position } = view;

  return (
    <div className="page-shell page-shell--subpage">
      <PageHeading
        title="Borrower position"
        description="Raw value, effective collateral, debt, and settlement status for the connected wallet."
        aside={
          <span className="state-badge" data-tone={position.tone}>
            {position.status}
          </span>
        }
      />
      <ModeNotice view={view} />

      <section className="metrics-strip">
        <Metric label="Collateral" value={position.collateral} detail={position.rawValue} />
        <Metric label="Debt" value={position.debt} detail="Principal + accrued interest" />
        <Metric
          label="Borrow capacity"
          value={position.borrowCapacity}
          detail={`${position.availableBorrow} available`}
        />
        <Metric
          label="Health factor"
          value={position.healthFactor}
          tone={position.tone}
          detail="Liquidates below 1.0000"
        />
      </section>

      <section className="split-content split-content--wide-right">
        <div className="plain-panel">
          <h2>Settlement state</h2>
          <ol className="state-timeline">
            {stages.map((stage) => (
              <li data-current={stage.key === position.stage} key={stage.key}>
                <strong>{stage.title}</strong>
                <span>{stage.detail}</span>
              </li>
            ))}
          </ol>
          <p className="field-message">
            RWA collateral may require issuer redemption or an eligible counterparty. YieldLine
            therefore models liquidation as deferred settlement rather than an instant DEX sale.
          </p>
          <Link className="button button--quiet" href="/borrow">
            Manage position <ArrowUpRight aria-hidden="true" size={16} />
          </Link>
        </div>
        <RiskTable />
      </section>
      <BorrowerInterest view={view} />
      <TransactionHistory account={view.account} kind="borrower" />
    </div>
  );
}
