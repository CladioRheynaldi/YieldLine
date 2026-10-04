"use client";

import { creditVaultAbi } from "@yieldline/shared";

import { ActionForm } from "@/components/action-form";
import { Metric } from "@/components/metric";
import { ModeNotice } from "@/components/mode-notice";
import { PageHeading } from "@/components/page-heading";
import { RiskBridge } from "@/components/risk-bridge";
import { maxSafeWithdrawal, withApproval, writeGate } from "@/lib/actions";
import {
  TBILL_DECIMALS,
  USDC_DECIMALS,
  formatHealthFactor,
  formatUsdWad,
  formatUsdc,
} from "@/lib/format";
import { deployment } from "@/lib/network";
import { previewRisk, wadToUsdcFloor } from "@/lib/risk-math";
import { useProtocol, type RawState } from "@/lib/use-protocol";

const min = (a: bigint, b: bigint) => (a < b ? a : b);

function PreviewRows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="preview-rows">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function hf(raw: RawState, collateral: bigint, debt: bigint) {
  return debt === 0n ? "—" : formatHealthFactor(previewRisk(raw.risk, collateral, debt).healthFactor);
}

export function BorrowView() {
  const view = useProtocol();
  const { market, position, wallet } = view;
  const gate = writeGate(view);
  const raw = view.raw;
  const d = deployment;
  const pending = raw?.status === 2;
  const pendingReason = pending ? "The position is pending liquidation and is locked." : null;

  const eligibility =
    wallet.eligible === null ? "Connect wallet" : wallet.eligible ? "Eligible" : "Not eligible";

  return (
    <div className="page-shell page-shell--subpage">
      <PageHeading
        title="Borrow workbench"
        description="Approve collateral, deposit MockTBILL, and borrow MockUSDC against the contract-computed risk result."
        aside={
          <span
            className="state-badge"
            data-tone={wallet.eligible === false ? "danger" : wallet.eligible ? "healthy" : "neutral"}
          >
            {view.mode === "demo" ? "Eligible · demo" : eligibility}
          </span>
        }
      />
      <ModeNotice view={view} />

      {wallet.eligible === false ? (
        <p className="policy-message" data-tone="danger" role="alert">
          This wallet is not on the MockTBILL allowlist. A compliance admin can allowlist it from
          the admin simulator.
        </p>
      ) : null}

      <section className="metrics-strip">
        <Metric label="Wallet MockTBILL" value={wallet.tbill} detail="Available to deposit" />
        <Metric label="Borrow capacity" value={position.borrowCapacity} detail={`${market.effectiveLtv} effective LTV`} />
        <Metric label="Debt" value={position.debt} detail={`${position.availableBorrow} available`} />
        <Metric label="Health factor" value={position.healthFactor} tone={position.tone} detail={position.status} />
      </section>

      <RiskBridge />

      <section className="action-grid">
        <ActionForm
          title="Deposit collateral"
          label="Collateral amount"
          unit="mTBILL"
          decimals={TBILL_DECIMALS}
          action="Approve & deposit"
          helper="Approval and deposit are separate wallet transactions."
          disabledReason={gate}
          max={raw?.tbillBalance}
          validate={(amount) => {
            if (!raw) return null;
            if (!raw.eligible) return "This wallet is not eligible for the selected mock RWA.";
            if (pendingReason) return pendingReason;
            if (market.paused) return "The protocol is paused for new risk.";
            if (amount > raw.tbillBalance) return "Amount exceeds the wallet balance.";
            return null;
          }}
          preview={(amount) =>
            raw ? (
              <PreviewRows
                rows={[
                  ["Collateral value", formatUsdWad(((raw.collateral + (amount ?? 0n)) * raw.risk.price) / 10n ** 18n)],
                  ["Borrow capacity", `${formatUsdWad(raw.borrowCapacity)} → ${formatUsdWad(previewRisk(raw.risk, raw.collateral + (amount ?? 0n), raw.debt).borrowCapacity)}`],
                ]}
              />
            ) : null
          }
          steps={(amount) =>
            withApproval(d!.mockTBILL, d!.creditVault, amount, raw!.tbillAllowance, "MockTBILL", {
              label: "Deposit collateral",
              address: d!.creditVault,
              abi: creditVaultAbi,
              functionName: "depositCollateral",
              args: [d!.mockTBILL, amount],
            })
          }
        />

        <ActionForm
          title="Borrow liquidity"
          label="Borrow amount"
          unit="mUSDC"
          decimals={USDC_DECIMALS}
          action="Borrow"
          helper={`New borrowing requires a valid, non-hard-stale oracle. Current status: ${market.oracleStatus}.`}
          disabledReason={gate}
          max={
            raw
              ? min(
                  wadToUsdcFloor(raw.borrowCapacity > raw.debt * 10n ** 12n ? raw.borrowCapacity - raw.debt * 10n ** 12n : 0n),
                  raw.availableLiquidity,
                )
              : undefined
          }
          validate={(amount) => {
            if (!raw) return null;
            if (raw.status === 0 || raw.status === 3) return "Deposit collateral before borrowing.";
            if (pendingReason) return pendingReason;
            if (market.paused) return "The protocol is paused for new risk.";
            if (!raw.eligible) return "This wallet is not eligible for the selected mock RWA.";
            if (!market.borrowingEnabled) return "Borrowing is disabled for this asset.";
            if (!raw.oracleValid) return "The oracle currently reports an invalid price.";
            if (raw.risk.freshnessBps === 0n) return "The RWA valuation is too old for new borrowing.";
            if ((raw.debt + amount) * 10n ** 12n > raw.borrowCapacity) {
              return "This borrow would move the position beyond its borrowing limit.";
            }
            if (amount > raw.availableLiquidity) {
              return "The lending pool does not currently have enough available MockUSDC.";
            }
            return null;
          }}
          preview={(amount) =>
            raw ? (
              <PreviewRows
                rows={[
                  ["Debt", `${formatUsdc(raw.debt)} → ${formatUsdc(raw.debt + (amount ?? 0n))}`],
                  ["Health factor", `${hf(raw, raw.collateral, raw.debt)} → ${hf(raw, raw.collateral, raw.debt + (amount ?? 0n))}`],
                  ["Pool liquidity", formatUsdc(raw.availableLiquidity)],
                ]}
              />
            ) : null
          }
          steps={(amount) => [
            {
              label: "Borrow MockUSDC",
              address: d!.creditVault,
              abi: creditVaultAbi,
              functionName: "borrow",
              args: [d!.mockTBILL, amount],
            },
          ]}
        />

        <ActionForm
          title="Repay debt"
          label="Repayment amount"
          unit="mUSDC"
          decimals={USDC_DECIMALS}
          action="Approve & repay"
          helper="Repayment stays open while paused. Repaying in full during pending liquidation cures the position."
          disabledReason={gate}
          max={raw ? min(raw.debt, raw.usdcBalance) : undefined}
          validate={(amount) => {
            if (!raw) return null;
            if (raw.debt === 0n) return "There is no debt to repay.";
            if (min(amount, raw.debt) > raw.usdcBalance) return "Amount exceeds the wallet balance.";
            return null;
          }}
          preview={(amount) =>
            raw ? (
              <PreviewRows
                rows={[
                  ["Debt", `${formatUsdc(raw.debt)} → ${formatUsdc(raw.debt - min(amount ?? 0n, raw.debt))}`],
                  ["Health factor", `${hf(raw, raw.collateral, raw.debt)} → ${hf(raw, raw.collateral, raw.debt - min(amount ?? 0n, raw.debt))}`],
                ]}
              />
            ) : null
          }
          steps={(amount) => {
            const paid = min(amount, raw!.debt);
            return withApproval(d!.mockUSDC, d!.creditVault, paid, raw!.usdcAllowanceCredit, "MockUSDC", {
              label: "Repay debt",
              address: d!.creditVault,
              abi: creditVaultAbi,
              functionName: "repay",
              args: [d!.mockTBILL, paid],
            });
          }}
        />

        <ActionForm
          title="Withdraw collateral"
          label="Withdrawal amount"
          unit="mTBILL"
          decimals={TBILL_DECIMALS}
          action="Withdraw"
          helper="The remaining position must stay inside its borrow limit."
          disabledReason={gate}
          max={raw ? maxSafeWithdrawal(raw) : undefined}
          validate={(amount) => {
            if (!raw) return null;
            if (pendingReason) return pendingReason;
            if (raw.status !== 1) return "There is no active position to withdraw from.";
            if (amount > raw.collateral) return "Amount exceeds deposited collateral.";
            if (raw.debt > 0n && (!raw.oracleValid || raw.risk.freshnessBps === 0n)) {
              return "Withdrawals with debt need a valid, non-hard-stale oracle.";
            }
            if (amount > maxSafeWithdrawal(raw)) {
              return "This withdrawal would leave the position above its borrowing limit.";
            }
            return null;
          }}
          preview={(amount) =>
            raw ? (
              <PreviewRows
                rows={[
                  ["Health factor", `${hf(raw, raw.collateral, raw.debt)} → ${hf(raw, raw.collateral - min(amount ?? 0n, raw.collateral), raw.debt)}`],
                  ["Max safe withdrawal", `${(Number(maxSafeWithdrawal(raw)) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 2 })} mTBILL`],
                ]}
              />
            ) : null
          }
          steps={(amount) => [
            {
              label: "Withdraw collateral",
              address: d!.creditVault,
              abi: creditVaultAbi,
              functionName: "withdrawCollateral",
              args: [d!.mockTBILL, amount],
            },
          ]}
        />
      </section>
    </div>
  );
}
