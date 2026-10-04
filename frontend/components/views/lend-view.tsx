"use client";

import { liquidityVaultAbi } from "@yieldline/shared";

import { ActionForm } from "@/components/action-form";
import { LenderAnalytics } from "@/components/lender-analytics";
import { TransactionHistory } from "@/components/transaction-history";
import { Metric } from "@/components/metric";
import { ModeNotice } from "@/components/mode-notice";
import { PageHeading } from "@/components/page-heading";
import { withApproval, writeGate } from "@/lib/actions";
import { USDC_DECIMALS } from "@/lib/format";
import { deployment } from "@/lib/network";
import { useProtocol } from "@/lib/use-protocol";

export function LendView() {
  const view = useProtocol();
  const { pool, wallet } = view;
  const gate = writeGate(view);
  const raw = view.raw;
  const d = deployment;

  return (
    <div className="page-shell page-shell--subpage">
      <PageHeading
        title="MockUSDC liquidity pool"
        description="Lenders receive ERC-4626 shares. Economic assets include outstanding loans, while withdrawals remain bounded by liquid MockUSDC."
        aside={<span className="state-badge">ERC-4626</span>}
      />
      <ModeNotice view={view} />

      <section className="metrics-strip">
        <Metric label="Vault assets" value={pool.totalSupplied} detail="Cash + receivables" />
        <Metric label="Available now" value={pool.availableLiquidity} detail="Immediate withdrawals" />
        <Metric label="Borrowed" value={pool.borrowed} detail="Principal + accrued interest" />
        <Metric label="Utilization" value={pool.utilization} detail="Borrowed ÷ vault assets" />
      </section>

      <section className="action-grid">
        <ActionForm
          title="Supply liquidity"
          label="Deposit amount"
          unit="mUSDC"
          decimals={USDC_DECIMALS}
          action="Approve & supply"
          helper="The vault mints shares using ERC-4626 conversion rules."
          disabledReason={gate}
          max={raw?.usdcBalance}
          validate={(amount) =>
            raw && amount > raw.usdcBalance ? "Amount exceeds the wallet balance." : null
          }
          steps={(amount) =>
            withApproval(d!.mockUSDC, d!.liquidityVault, amount, raw!.usdcAllowancePool, "MockUSDC", {
              label: "Supply MockUSDC",
              address: d!.liquidityVault,
              abi: liquidityVaultAbi,
              functionName: "deposit",
              args: [amount, view.account!],
            })
          }
        />
        <ActionForm
          title="Withdraw liquidity"
          label="Withdrawal amount"
          unit="mUSDC"
          decimals={USDC_DECIMALS}
          action="Withdraw"
          helper="Withdrawals are limited to MockUSDC not currently lent out."
          disabledReason={gate}
          max={raw?.maxWithdraw}
          validate={(amount) =>
            raw && amount > raw.maxWithdraw ? "This exceeds what can be withdrawn right now." : null
          }
          steps={(amount) => [
            {
              label: "Withdraw MockUSDC",
              address: d!.liquidityVault,
              abi: liquidityVaultAbi,
              functionName: "withdraw",
              args: [amount, view.account!, view.account!],
            },
          ]}
        />
      </section>

      <section className="split-content">
        <div className="plain-panel">
          <h2>Your position</h2>
          <dl className="key-values">
            <div><dt>Wallet MockUSDC</dt><dd>{wallet.usdc}</dd></div>
            <div><dt>Share value</dt><dd>{wallet.shareValue}</dd></div>
            <div><dt>Max withdraw now</dt><dd>{wallet.maxWithdraw}</dd></div>
          </dl>
        </div>
        <div className="plain-panel">
          <h2>Liquidity is not the same as value.</h2>
          <p>
            A lender can own economically valuable shares while some MockUSDC is lent out.
            YieldLine reports vault assets and immediately available cash separately.
          </p>
          <dl className="key-values">
            <div><dt>Borrow APR (contract)</dt><dd>{pool.borrowApr}</dd></div>
            <div><dt>Indicative supply APR (contract)</dt><dd>{pool.supplyApr}</dd></div>
            <div><dt>Recognized bad debt</dt><dd>{pool.badDebt}</dd></div>
          </dl>
          <p className="field-message">
            Rates come from the contracts. Borrow APR is checkpointed after pool activity;
            supply APR is indicative. Earned receivables may be written off if a borrower defaults.
          </p>
        </div>
      </section>
      <LenderAnalytics view={view} />
      <TransactionHistory account={view.account} kind="lender" />
    </div>
  );
}
