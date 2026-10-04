"use client";

import { ArrowUpRight, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Metric } from "@/components/metric";
import { ModeNotice } from "@/components/mode-notice";
import { RiskBridge } from "@/components/risk-bridge";
import { RiskTable } from "@/components/risk-table";
import { chain } from "@/lib/network";
import { useProtocol } from "@/lib/use-protocol";

export function DashboardView() {
  const view = useProtocol();
  const { market, pool, position, wallet } = view;
  const BadgeIcon = position.tone === "danger" || position.tone === "warning" ? ShieldAlert : ShieldCheck;

  return (
    <div className="page-shell">
      <section className="hero-workbench">
        <div className="hero-workbench__copy">
          <div className="status-line">
            <span className="status-dot" aria-hidden="true" />
            {view.mode === "live" ? `Live on ${chain.name} · mock assets only` : "Documented workshop scenario · not live funds"}
          </div>
          <h1>Risk-adjusted RWA credit.</h1>
          <p>
            Deposit a permissioned, NAV-priced mock Treasury asset. See each haircut before
            borrowing MockUSDC. When settlement cannot be atomic, move the position through a
            visible deferred-liquidation state.
          </p>
          <div className="button-row">
            <Link className="button button--primary" href="/borrow">
              Open borrow flow <ArrowUpRight aria-hidden="true" size={16} />
            </Link>
            <Link className="button button--quiet" href="/admin-simulator">
              Run risk scenario
            </Link>
          </div>
          <p className="legal-note">
            MockTBILL is a test token. It is not a Treasury security, investment product, or
            production OpenEden integration.
          </p>
        </div>

        <div className="position-console" aria-label="Borrower position">
          <div className="position-console__head">
            <div>
              <span>Borrower position</span>
              <strong>MockTBILL / MockUSDC</strong>
            </div>
            <span className="state-badge" data-tone={position.tone}>
              <BadgeIcon aria-hidden="true" size={15} /> {position.status}
            </span>
          </div>
          <div className="position-console__primary">
            <span>Health factor</span>
            <strong>{position.healthFactor}</strong>
            <small>Liquidation threshold · 1.0000</small>
          </div>
          <dl className="position-console__rows">
            <div>
              <dt>Collateral</dt>
              <dd>{position.collateral}</dd>
            </div>
            <div>
              <dt>Debt</dt>
              <dd>{position.debt}</dd>
            </div>
            <div>
              <dt>Available borrow</dt>
              <dd>{position.availableBorrow}</dd>
            </div>
            <div>
              <dt>Oracle</dt>
              <dd>{market.oracleStatus} · {market.oracleAge}</dd>
            </div>
          </dl>
        </div>
      </section>

      <ModeNotice view={view} />

      <section className="metrics-strip" aria-label="Your wallet and position">
        <Metric label="Wallet MockTBILL" value={wallet.tbill} detail="Permissioned collateral" />
        <Metric label="Wallet MockUSDC" value={wallet.usdc} detail="Settlement asset" />
        <Metric label="Borrow capacity" value={position.borrowCapacity} detail="After RWA factors" />
        <Metric label="Health factor" value={position.healthFactor} tone={position.tone} detail={position.status} />
      </section>

      <section className="metrics-strip" aria-label="Protocol metrics">
        <Metric label="Raw collateral" value={position.rawValue} detail="NAV × token amount" />
        <Metric label="Effective collateral" value={position.effectiveValue} detail="After RWA factors" />
        <Metric label="Pool liquidity" value={pool.availableLiquidity} detail="Withdrawable now" />
        <Metric label="Utilization" value={pool.utilization} detail="Borrowed ÷ vault assets" />
      </section>

      <section className="workbench-section">
        <div className="section-heading">
          <h2>From headline LTV to usable credit</h2>
          <p>
            YieldLine keeps price, transfer eligibility, liquidity, settlement, and oracle age
            separate so a mentor can inspect each assumption.
          </p>
        </div>
        <RiskBridge />
        <RiskTable />
      </section>

      <section className="dark-band">
        <div>
          <h2>Stale data stops new risk.</h2>
          <p>
            Between 24 and 72 hours, borrowing power declines linearly. At hard stale, new
            borrowing stops—but the old price alone does not trigger liquidation.
          </p>
        </div>
        <Link className="button button--on-dark" href="/admin-simulator">
          Inspect the policy <ArrowUpRight aria-hidden="true" size={16} />
        </Link>
      </section>
    </div>
  );
}
