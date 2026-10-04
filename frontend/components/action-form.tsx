"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { formatUnits, parseUnits } from "viem";

import { useTx, type TxStep } from "@/lib/use-tx";

import { TxStatus } from "./tx-status";

function parseAmount(value: string, decimals: number): bigint | null {
  if (!/^\d*\.?\d*$/.test(value.trim()) || value.trim() === "" || value.trim() === ".") return null;
  try {
    return parseUnits(value.trim(), decimals);
  } catch {
    return null;
  }
}

export function ActionForm({
  title,
  label,
  unit,
  decimals,
  action,
  helper,
  max,
  validate,
  preview,
  steps,
  disabledReason,
}: {
  title: string;
  label: string;
  unit: string;
  decimals: number;
  action: string;
  helper: string;
  /** Exact amount the Max button fills in. */
  max?: bigint;
  /** Returns a reason when the contract is predicted to revert. */
  validate?: (amount: bigint) => string | null;
  preview?: (amount: bigint | null) => ReactNode;
  steps?: (amount: bigint) => TxStep[];
  /** Shown instead of submitting, e.g. in demo mode or with no wallet. */
  disabledReason?: string | null;
}) {
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const tx = useTx();
  const fieldId = `${title.toLowerCase().replaceAll(" ", "-")}-amount`;

  const amount = parseAmount(value, decimals);
  const invalid = amount === null || amount === 0n;
  const predicted = !invalid && validate ? validate(amount) : null;
  const inputError = touched && value !== "" && invalid ? "Enter an amount greater than zero." : predicted;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (disabledReason || invalid || predicted || !steps) return;
    const ok = await tx.run(steps(amount));
    if (ok) setValue("");
  };

  const idleMessage = inputError ?? disabledReason ?? helper;

  return (
    <form className="action-form" onSubmit={submit}>
      <h2>{title}</h2>
      <div className="action-form__label-row">
        <label htmlFor={fieldId}>{label}</label>
        {max !== undefined && !disabledReason ? (
          <button
            className="text-button"
            onClick={() => {
              setValue(formatUnits(max, decimals));
              setTouched(true);
              tx.reset();
            }}
            type="button"
          >
            Max
          </button>
        ) : null}
      </div>
      <div className="amount-input" data-state={inputError ? "error" : tx.busy ? "loading" : "idle"}>
        <input
          aria-describedby={`${fieldId}-message`}
          aria-invalid={Boolean(inputError)}
          id={fieldId}
          inputMode="decimal"
          onChange={(event) => {
            setValue(event.target.value);
            setTouched(true);
            if (!tx.busy) tx.reset();
          }}
          placeholder="0.00"
          value={value}
        />
        <span>{unit}</span>
      </div>
      {preview ? <div className="action-form__preview">{preview(invalid ? null : amount)}</div> : null}
      <div id={`${fieldId}-message`}>
        {tx.state.status === "idle" || inputError ? (
          <p className="field-message" data-state={inputError ? "error" : "idle"} role={inputError ? "alert" : "status"}>
            {idleMessage}
          </p>
        ) : (
          <TxStatus state={tx.state} />
        )}
      </div>
      <button
        className="button button--primary button--wide"
        data-state={tx.busy ? "loading" : tx.state.status === "success" ? "success" : "idle"}
        disabled={tx.busy || Boolean(disabledReason) || Boolean(predicted)}
        type="submit"
      >
        {tx.busy ? "Working…" : action}
      </button>
    </form>
  );
}
