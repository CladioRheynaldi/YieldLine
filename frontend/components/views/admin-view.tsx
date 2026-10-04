"use client";

import {
  complianceRegistryAbi,
  creditVaultAbi,
  mockOracleAbi,
  mockTbillAbi,
  mockUsdcAbi,
  registryAbi,
} from "@yieldline/shared";
import { useState, type ReactNode } from "react";
import { isAddress, parseUnits, type Address } from "viem";
import { useReadContracts } from "wagmi";

import { ActionForm } from "@/components/action-form";
import { ModeNotice } from "@/components/mode-notice";
import { PageHeading } from "@/components/page-heading";
import { RiskSimulator } from "@/components/risk-simulator";
import { TxButton } from "@/components/tx-button";
import { withApproval, writeGate } from "@/lib/actions";
import {
  TBILL_DECIMALS,
  USDC_DECIMALS,
  formatHealthFactor,
  formatUsdc,
  shortAddress,
} from "@/lib/format";
import { chain, deployment } from "@/lib/network";
import { useProtocol } from "@/lib/use-protocol";
import type { TxStep } from "@/lib/use-tx";

type Preset = { name: string; nav: string; ageHours: number; detail: string };

const presets: Preset[] = [
  { name: "Healthy", nav: "1.05", ageHours: 0, detail: "Fresh NAV at $1.05" },
  { name: "Oracle degraded", nav: "1.05", ageHours: 48, detail: "48 h old · freshness 50%" },
  { name: "Oracle hard stale", nav: "1.05", ageHours: 73, detail: "73 h old · borrowing off" },
  { name: "NAV shock", nav: "0.60", ageHours: 0, detail: "Fresh NAV at $0.60 · HF < 1" },
];

const STATUS = ["No position", "Active", "Liquidation pending", "Closed"];

/** Oracle timestamp for a backdated update; only called from click handlers. */
function timestampHoursAgo(hours: number, chainTimestamp: bigint): bigint {
  return chainTimestamp - BigInt(hours * 3600);
}

function Card({ title, role, children }: { title: string; role: string; children: ReactNode }) {
  return (
    <section className="admin-card">
      <div className="admin-card__head">
        <h2>{title}</h2>
        <span className="mono">{role}</span>
      </div>
      {children}
    </section>
  );
}

function AddressField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const invalid = value !== "" && !isAddress(value);
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className="amount-input" data-state={invalid ? "error" : "idle"}>
        <input
          aria-invalid={invalid}
          className="mono"
          id={id}
          onChange={(event) => onChange(event.target.value.trim())}
          placeholder="0x…"
          spellCheck={false}
          value={value}
        />
      </div>
    </>
  );
}

export function AdminView() {
  const view = useProtocol();
  const gate = writeGate(view);
  const d = deployment;
  const { roles } = view;

  const [nav, setNav] = useState("1.05");
  const [ageHours, setAgeHours] = useState(0);
  const [target, setTarget] = useState("");
  const targetAddress = (isAddress(target) ? target : view.account) as Address | undefined;

  const need = (has: boolean, role: string) => gate ?? (has ? null : `Requires ${role} for this wallet.`);

  const oracleSteps = (navValue: string, age: number): TxStep[] => {
    const price = parseUnits(navValue, 18);
    const steps: TxStep[] = [];
    if (view.raw && !view.raw.oracleValid) {
      steps.push({
        label: "Mark oracle valid",
        address: d!.mockOracle,
        abi: mockOracleAbi,
        functionName: "setValid",
        args: [d!.mockTBILL, true],
      });
    }
    steps.push(
      age === 0
        ? {
            label: "Update NAV",
            address: d!.mockOracle,
            abi: mockOracleAbi,
            functionName: "setCurrentPrice",
            args: [d!.mockTBILL, price],
          }
        : {
            label: "Update NAV",
            address: d!.mockOracle,
            abi: mockOracleAbi,
            functionName: "setPrice",
            args: [d!.mockTBILL, price, timestampHoursAgo(age, view.raw!.chainTimestamp)],
          },
    );
    return steps;
  };

  const navValid = /^\d+(\.\d{1,18})?$/.test(nav) && Number(nav) > 0;
  const oracleGate = need(roles.oracleUpdater, "ORACLE_UPDATER_ROLE");

  const targetReads = useReadContracts({
    allowFailure: false,
    query: { enabled: Boolean(d && targetAddress), refetchInterval: 10_000 },
    contracts: [
      {
        address: d?.creditVault,
        abi: creditVaultAbi,
        functionName: "getPosition",
        args: [targetAddress!, d?.mockTBILL as Address],
        chainId: chain.id,
      },
      {
        address: d?.creditVault,
        abi: creditVaultAbi,
        functionName: "getAccountRisk",
        args: [targetAddress!, d?.mockTBILL as Address],
        chainId: chain.id,
      },
      {
        address: d?.complianceRegistry,
        abi: complianceRegistryAbi,
        functionName: "isEligible",
        args: [d?.mockTBILL as Address, targetAddress!],
        chainId: chain.id,
      },
    ],
  });
  const [targetPosition, targetRisk, targetEligible] = targetReads.data ?? [];

  const liveMode = view.mode === "live";

  return (
    <div className="page-shell page-shell--subpage">
      <PageHeading
        title="Risk simulator"
        description="Change the mock NAV and oracle age to demonstrate freshness haircuts, hard-stale borrowing policy, and deferred-liquidation eligibility."
        aside={
          <span className="state-badge" data-tone="warning">
            Admin · mock
          </span>
        }
      />
      <ModeNotice view={view} />

      {liveMode ? (
        <>
          <Card title="Oracle scenarios" role="ORACLE_UPDATER_ROLE">
            <p className="field-message">
              Current: {view.market.nav} · {view.market.oracleStatus} · {view.market.oracleAge} ·
              freshness {view.market.freshnessFactor}
            </p>
            <div className="scenario-row" aria-label="Scenario presets">
              {presets.map((preset) => (
                <TxButton
                  disabledReason={oracleGate}
                  key={preset.name}
                  steps={() => oracleSteps(preset.nav, preset.ageHours)}
                >
                  {preset.name}
                  <small>{preset.detail}</small>
                </TxButton>
              ))}
            </div>
            <div className="admin-card__grid">
              <div>
                <label htmlFor="admin-nav">Mock NAV</label>
                <div className="amount-input" data-state={navValid ? "idle" : "error"}>
                  <input
                    id="admin-nav"
                    inputMode="decimal"
                    onChange={(event) => setNav(event.target.value)}
                    value={nav}
                  />
                  <span>USD</span>
                </div>
                <label htmlFor="admin-age">Oracle age · {ageHours} hours</label>
                <input
                  className="range-input"
                  id="admin-age"
                  max="96"
                  min="0"
                  onChange={(event) => setAgeHours(Number(event.target.value))}
                  type="range"
                  value={ageHours}
                />
                <TxButton
                  disabledReason={oracleGate ?? (navValid ? null : "Enter a NAV greater than zero.")}
                  steps={() => oracleSteps(nav, ageHours)}
                  variant="primary"
                >
                  Push oracle update
                </TxButton>
              </div>
              <div>
                <p className="field-message">
                  An invalid source blocks borrowing and never triggers liquidation by itself.
                </p>
                <TxButton
                  disabledReason={oracleGate}
                  steps={() => [
                    {
                      label: view.raw?.oracleValid === false ? "Mark oracle valid" : "Mark oracle invalid",
                      address: d!.mockOracle,
                      abi: mockOracleAbi,
                      functionName: "setValid",
                      args: [d!.mockTBILL, view.raw?.oracleValid === false],
                    },
                  ]}
                >
                  {view.raw?.oracleValid === false ? "Mark oracle valid" : "Mark oracle invalid"}
                </TxButton>
              </div>
            </div>
          </Card>

          <Card title="Liquidation" role="LIQUIDATION_OPERATOR_ROLE settles">
            <AddressField
              id="admin-target"
              label={`Borrower · defaults to connected wallet${view.account ? ` (${shortAddress(view.account)})` : ""}`}
              onChange={setTarget}
              value={target}
            />
            {targetPosition && targetRisk ? (
              <dl className="preview-rows">
                <div><dt>Status</dt><dd>{STATUS[targetPosition.status] ?? "Unknown"}</dd></div>
                <div><dt>Debt</dt><dd>{formatUsdc(targetPosition.debtAmount)}</dd></div>
                <div>
                  <dt>Health factor</dt>
                  <dd>{targetPosition.debtAmount === 0n ? "—" : formatHealthFactor(targetRisk.healthFactor)}</dd>
                </div>
                <div><dt>Liquidatable</dt><dd>{targetRisk.liquidatable ? "Yes" : "No"}</dd></div>
                <div><dt>Eligible</dt><dd>{targetEligible ? "Yes" : "No"}</dd></div>
              </dl>
            ) : null}
            <TxButton
              disabledReason={
                gate ??
                (!targetPosition
                  ? "Loading position…"
                  : targetPosition.status !== 1
                    ? "Only active positions can enter liquidation."
                    : !targetRisk?.liquidatable
                      ? "The position is not liquidatable at the current valid price."
                      : null)
              }
              steps={() => [
                {
                  label: "Initiate liquidation",
                  address: d!.creditVault,
                  abi: creditVaultAbi,
                  functionName: "initiateLiquidation",
                  args: [targetAddress!, d!.mockTBILL],
                },
              ]}
              variant="primary"
            >
              Initiate liquidation
            </TxButton>
            <ActionForm
              action="Approve & settle"
              decimals={USDC_DECIMALS}
              disabledReason={
                need(roles.liquidationOperator, "LIQUIDATION_OPERATOR_ROLE") ??
                (targetPosition?.status !== 2 ? "The position is not pending liquidation." : null)
              }
              helper="Simulates issuer redemption proceeds. Proceeds above debt return to the borrower; any shortfall is recognized as bad debt."
              label="Settlement proceeds"
              max={targetPosition?.debtAmount}
              preview={(amount) => {
                if (!targetPosition || amount === null) return null;
                const debt = targetPosition.debtAmount;
                return (
                  <dl className="preview-rows">
                    <div><dt>Debt repaid</dt><dd>{formatUsdc(amount > debt ? debt : amount)}</dd></div>
                    <div><dt>Borrower surplus</dt><dd>{formatUsdc(amount > debt ? amount - debt : 0n)}</dd></div>
                    <div><dt>Bad debt</dt><dd>{formatUsdc(debt > amount ? debt - amount : 0n)}</dd></div>
                  </dl>
                );
              }}
              steps={(amount) =>
                withApproval(d!.mockUSDC, d!.creditVault, amount, view.raw?.usdcAllowanceCredit ?? 0n, "MockUSDC", {
                  label: "Settle liquidation",
                  address: d!.creditVault,
                  abi: creditVaultAbi,
                  functionName: "settleLiquidation",
                  args: [targetAddress!, d!.mockTBILL, amount],
                })
              }
              title="Settle redemption"
              unit="mUSDC"
              validate={(amount) =>
                view.raw && amount > view.raw.usdcBalance
                  ? "The operator wallet needs this much MockUSDC. Use the faucet below."
                  : null
              }
            />
          </Card>

          <Card title="Compliance & policy" role="COMPLIANCE / RISK / PROTOCOL admin">
            <p className="field-message">
              Target: {targetAddress ? shortAddress(targetAddress) : "connect a wallet"} ·{" "}
              {targetEligible === undefined ? "—" : targetEligible ? "eligible" : "not eligible"} for MockTBILL
            </p>
            <div className="button-row">
              <TxButton
                disabledReason={need(roles.complianceAdmin, "COMPLIANCE_ADMIN_ROLE") ?? (targetAddress ? null : "Enter an address.")}
                steps={() => [
                  {
                    label: targetEligible ? "Revoke eligibility" : "Allowlist wallet",
                    address: d!.complianceRegistry,
                    abi: complianceRegistryAbi,
                    functionName: "setEligibility",
                    args: [d!.mockTBILL, targetAddress!, !targetEligible],
                  },
                ]}
              >
                {targetEligible ? "Revoke eligibility" : "Allowlist wallet"}
              </TxButton>
              <TxButton
                disabledReason={need(roles.riskAdmin, "RISK_ADMIN_ROLE")}
                steps={() => [
                  {
                    label: view.market.borrowingEnabled ? "Disable borrowing" : "Enable borrowing",
                    address: d!.registry,
                    abi: registryAbi,
                    functionName: "setBorrowingEnabled",
                    args: [d!.mockTBILL, !view.market.borrowingEnabled],
                  },
                ]}
              >
                {view.market.borrowingEnabled ? "Disable borrowing" : "Enable borrowing"}
              </TxButton>
              <TxButton
                disabledReason={need(roles.protocolAdmin, "PROTOCOL_ADMIN_ROLE")}
                steps={() => [
                  {
                    label: view.market.paused ? "Unpause protocol" : "Pause protocol",
                    address: d!.creditVault,
                    abi: creditVaultAbi,
                    functionName: view.market.paused ? "unpause" : "pause",
                    args: [],
                  },
                ]}
              >
                {view.market.paused ? "Unpause protocol" : "Pause protocol"}
              </TxButton>
            </div>
          </Card>

          <Card title="Demo faucet" role="MINTER_ROLE">
            <p className="field-message">
              Mints to the target address. MockTBILL can only be minted to allowlisted wallets.
            </p>
            <div className="action-grid">
              <ActionForm
                action="Mint MockUSDC"
                decimals={USDC_DECIMALS}
                disabledReason={need(roles.minter, "MINTER_ROLE") ?? (targetAddress ? null : "Enter an address.")}
                helper="Test settlement asset for lenders, borrowers, and the liquidation operator."
                label="Amount"
                steps={(amount) => [
                  {
                    label: "Mint MockUSDC",
                    address: d!.mockUSDC,
                    abi: mockUsdcAbi,
                    functionName: "mint",
                    args: [targetAddress!, amount],
                  },
                ]}
                title="MockUSDC"
                unit="mUSDC"
              />
              <ActionForm
                action="Mint MockTBILL"
                decimals={TBILL_DECIMALS}
                disabledReason={
                  need(roles.minter, "MINTER_ROLE") ??
                  (!targetAddress ? "Enter an address." : targetEligible === false ? "Allowlist the target first." : null)
                }
                helper="Permissioned mock RWA. Not a Treasury security."
                label="Amount"
                steps={(amount) => [
                  {
                    label: "Mint MockTBILL",
                    address: d!.mockTBILL,
                    abi: mockTbillAbi,
                    functionName: "mint",
                    args: [targetAddress!, amount],
                  },
                ]}
                title="MockTBILL"
                unit="mTBILL"
              />
            </div>
          </Card>

          <div className="section-heading">
            <h2>What-if calculator</h2>
            <p>Offline model of the documented position. Nothing here is sent onchain.</p>
          </div>
        </>
      ) : null}

      <RiskSimulator />
    </div>
  );
}
